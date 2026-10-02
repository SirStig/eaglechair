"""
PDF parsing helpers for the offline catalog scripts in backend/scripts/
(catalog_fill_utils, manual_catalog_fixes). The admin PDF import that used
to live here has been removed.
"""

import io
import logging
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import fitz  # PyMuPDF
import pdfplumber
from PIL import Image, ImageEnhance

from backend.core.config import settings

logger = logging.getLogger(__name__)

# Patterns to exclude from model numbers
EXCLUDE_PATTERNS = [
    r'^\d{4}$',  # Just years (1984, 2024)
    r'copyright|reserved|inc\.|allrightsreserved',
    r'^\d{1,2}#$',  # Weight indicators
    r'^\d{1,2}"$',  # Dimension measurements
    r'^\d+\.?\d*y$',  # Yardage
    r'^\d+\.?\d*cu\.?ft$',  # Volume
    r'gototop',
]


def is_false_positive(text: str) -> bool:
    """Check if text matches false positive patterns"""
    text_clean = text.strip().lower()
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, text_clean, re.IGNORECASE):
            return True
    return False


def classify_image(width: int, height: int, page_width: float, page_height: float) -> str:
    """
    Classify image type based on dimensions
    Returns: 'background', 'product', 'family_name', 'icon'
    """
    aspect_ratio = width / height if height > 0 else 0
    
    # Very large images are backgrounds
    if width > 2000 or height > 2000:
        return 'background'
    
    # Very small images are icons/logos
    if width < 50 or height < 50:
        return 'icon'
    
    # Wide, short images are likely family name text (rendered as image)
    if aspect_ratio > 3 and height < 150 and width > 300:
        return 'family_name'
    
    # Medium-sized images with reasonable aspect ratio are products
    if 0.5 <= aspect_ratio <= 2.0 and 100 < width < 1000 and 100 < height < 1000:
        return 'product'
    
    # Tall images (chairs are usually vertical)
    if aspect_ratio < 0.8 and 150 < height < 800:
        return 'product'
    
    return 'unknown'


def process_product_image(image_bytes: bytes, image_ext: str) -> bytes:
    """
    Process product image to remove background and improve quality.
    
    - Convert to RGBA (supports transparency)
    - Remove black/dark backgrounds with white blotches
    - Enhance contrast and sharpness
    - Save as PNG with transparency
    """
    try:
        # Load image from bytes
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGBA for transparency support
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Get image data
        data = img.getdata()
        new_data = []
        
        # Remove ONLY pure black (0,0,0) and pure white (255,255,255) backgrounds
        # This preserves dark and light colors in the actual product
        for item in data:
            # Check if pixel is pure black or pure white
            # RGB values: (R, G, B, A)
            r, g, b, a = item
            
            # If pixel is pure black (exact background) - make transparent
            if r < 10 and g < 10 and b < 10:
                new_data.append((255, 255, 255, 0))  # Transparent
            # If pixel is pure white (exact blotches) - make transparent
            elif r > 250 and g > 250 and b > 250:
                new_data.append((255, 255, 255, 0))  # Transparent
            else:
                # Keep the pixel (it's the actual product)
                new_data.append(item)
        
        img.putdata(new_data)
        
        # Enhance sharpness slightly
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.2)
        
        # Enhance contrast slightly
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.1)
        
        # Save to bytes as PNG
        output = io.BytesIO()
        img.save(output, format='PNG', optimize=True)
        return output.getvalue()
        
    except Exception as e:
        logger.warning(f"Failed to process image: {e}, using original")
        return image_bytes


def extract_images_from_page(
    pdf_path: str,
    page_number: int,
    output_dir: Path,
    upload_id: str
) -> Tuple[List[Dict], List[Dict]]:
    """
    Extract and classify images from a PDF page
    Returns: (product_images, family_name_images)
    """
    product_images = []
    family_name_images = []
    
    # Create upload-specific subdirectory
    upload_output_dir = output_dir / upload_id
    upload_output_dir.mkdir(parents=True, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    page = doc[page_number - 1]
    page_width = page.rect.width
    page_height = page.rect.height
    
    image_list = page.get_images(full=True)
    
    for img_index, img_info in enumerate(image_list):
        xref = img_info[0]
        
        try:
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]
            width = base_image.get("width", 0)
            height = base_image.get("height", 0)
            
            # Classify image
            img_type = classify_image(width, height, page_width, page_height)
            
            # Skip icons and backgrounds
            if img_type in ['icon', 'background']:
                continue
            
            # Process product images to remove background and improve quality
            if img_type == 'product':
                processed_bytes = process_product_image(image_bytes, image_ext)
                # Always save processed images as PNG for transparency support
                image_ext = 'png'
            else:
                processed_bytes = image_bytes
            
            # Generate filename
            timestamp = int(datetime.now().timestamp())
            filename = f"{upload_id}_page{page_number}_{img_type}_{timestamp}_{img_index}.{image_ext}"
            filepath = upload_output_dir / filename
            
            # Save processed image
            with open(filepath, "wb") as img_file:
                img_file.write(processed_bytes)
            
            image_data = {
                'filename': filename,
                'filepath': str(filepath),
                'url': f"/tmp/images/{upload_id}/{filename}",
                'width': width,
                'height': height,
                'format': image_ext,
                'type': img_type,
                'file_size': len(processed_bytes),
            }
            
            if img_type == 'product':
                product_images.append(image_data)
            elif img_type == 'family_name':
                family_name_images.append(image_data)
            
        except Exception as e:
            print(f"Error extracting image {img_index} from page {page_number}: {e}")
            continue
    
    doc.close()
    return product_images, family_name_images


def extract_model_variations(text: str) -> List[Dict]:
    """Extract model numbers with variations from text. Matches 6246WB.P, 6246-22WB.BX, 5242-22WB.BX style."""
    if not text:
        return []
    
    pattern = re.compile(r'\b(\d{4})(-[A-Z0-9][\w.]*|[A-Z][\w.-]*)\b')
    models = []
    seen = set()

    for match in pattern.finditer(text):
        full_model = match.group(0)
        base_model = match.group(1)
        suffix = match.group(2)
        if base_model.isdigit() and 2010 <= int(base_model) <= 2030:
            continue
        if is_false_positive(full_model) or full_model in seen:
            continue
        models.append({
            'base_model': base_model,
            'suffix': suffix,
            'full_model': full_model,
        })
        seen.add(full_model)

    return models


def extract_family_info(text: str) -> Dict:
    """Extract family-level information from text"""
    if not text:
        return {}
    
    info = {
        'features': [],
        'wood_species': [],
        'standard': [],
        'options': [],
        'environmental': [],
    }
    
    lines = text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        line_lower = line.lower()
        
        # Detect sections
        if 'features' in line_lower and len(line) < 50:
            current_section = 'features'
            continue
        elif 'wood species' in line_lower:
            current_section = 'wood_species'
            continue
        elif line_lower == 'standard':
            current_section = 'standard'
            continue
        elif line_lower == 'options':
            current_section = 'options'
            continue
        elif 'environmental' in line_lower:
            current_section = 'environmental'
            continue
        
        # Add to current section
        if current_section and not is_false_positive(line):
            if current_section in info and isinstance(info[current_section], list):
                clean_line = line.strip()
                if len(clean_line) > 3:
                    info[current_section].append(clean_line)
    
    return info


def extract_dimensions(text: str) -> Dict:
    """Extract product dimensions from text. Accepts both \" and 'inches'."""
    dims = {}
    text_lower = text.lower()

    inch_pattern = re.compile(r'(\d+\.?\d*)\s*(?:"|inches?)', re.IGNORECASE)
    inch_matches = inch_pattern.findall(text)

    weight_pattern = re.compile(r'(\d+)#')
    weight_match = weight_pattern.search(text)
    if weight_match:
        dims['weight'] = float(weight_match.group(1))

    volume_pattern = re.compile(r'([\d.]+)\s*cu\.?\s*ft', re.IGNORECASE)
    volume_match = volume_pattern.search(text)
    if volume_match:
        dims['volume'] = float(volume_match.group(1))

    yardage_pattern = re.compile(r'(\d+\.?\d*)\s*y(?:ards?|d)?\b', re.IGNORECASE)
    yardage_match = yardage_pattern.search(text)
    if yardage_match:
        dims['yardage'] = float(yardage_match.group(1))
    if 'yardage' not in dims:
        yardage_simple = re.search(r'([\d.]+)y\b', text)
        if yardage_simple:
            dims['yardage'] = float(yardage_simple.group(1))

    for label, key in [
        (r'seat\s+height[:\s]*(\d+\.?\d*)', 'seat_height'),
        (r'seat\s+depth[:\s]*(\d+\.?\d*)', 'seat_depth'),
        (r'overall\s+height[:\s]*(\d+\.?\d*)', 'height'),
        (r'overall\s+width[:\s]*(\d+\.?\d*)', 'width'),
        (r'(?<!seat\s)height[:\s]*(\d+\.?\d*)', 'height'),
        (r'width[:\s]*(\d+\.?\d*)', 'width'),
        (r'(?<!seat\s)depth[:\s]*(\d+\.?\d*)', 'depth'),
    ]:
        m = re.search(label, text_lower, re.IGNORECASE)
        if m and dims.get(key) is None:
            dims[key] = float(m.group(1))

    if len(inch_matches) >= 3 and dims.get('height') is None:
        dims['height'] = float(inch_matches[0])
    if len(inch_matches) >= 2 and dims.get('width') is None:
        dims['width'] = float(inch_matches[1])
    if len(inch_matches) >= 3 and dims.get('depth') is None:
        dims['depth'] = float(inch_matches[2])

    return dims


def parse_catalog_page(
    pdf_path: str,
    page_number: int,
    upload_id: str,
    output_dir: Path
) -> Dict:
    """
    Parse a single catalog page
    Returns structured data for family, products, variations, images
    """
    page_data = {
        'page_number': page_number,
        'family_name': 'Unknown',  # Default since names are images
        'family_info': {},
        'products': [],
        'product_images': [],
        'family_name_images': [],
        'notes': [],
    }
    
    # Extract text
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_number - 1]
        text = page.extract_text()
        
        if not text:
            page_data['notes'].append("No text found on page")
            return page_data
        
        # Extract models
        models = extract_model_variations(text)
        
        # Extract family info
        family_info = extract_family_info(text)
        page_data['family_info'] = family_info
        
        # Extract dimensions
        dimensions = extract_dimensions(text)
        
        # Group models by base number
        base_models = defaultdict(list)
        for model in models:
            base_models[model['base_model']].append(model)
        
        # Create product entries
        for base_model, variations in base_models.items():
            product = {
                'base_model': base_model,
                'model_name': f"Model {base_model}",  # Default name
                'variations': variations,
                'dimensions': dimensions,
            }
            page_data['products'].append(product)
    
    # Extract images
    product_images, family_name_images = extract_images_from_page(
        pdf_path, page_number, output_dir, upload_id
    )
    
    page_data['product_images'] = product_images
    page_data['family_name_images'] = family_name_images
    
    if family_name_images:
        page_data['notes'].append("Family name detected as image - set to 'Unknown'")
    
    return page_data
