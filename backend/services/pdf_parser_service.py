"""
PDF Parser Service
Production service for parsing manufacturer PDF catalogs
Based on test_pdf_parser_v4.py findings
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
from backend.models.tmp_catalog import (
    CatalogUpload,
    TmpChair,
    TmpProductFamily,
    TmpProductImage,
    TmpProductVariation,
)

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
    """Extract model numbers with variations from text"""
    if not text:
        return []
    
    # Pattern: 4 digits + suffix (letters, dashes, numbers)
    pattern = re.compile(r'\b(\d{4})([A-Z][\w-]*)\b')
    
    models = []
    seen = set()
    
    for match in pattern.finditer(text):
        full_model = match.group(0)
        
        if not is_false_positive(full_model) and full_model not in seen:
            base_model = match.group(1)
            suffix = match.group(2)
            
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
    """Extract product dimensions from text"""
    dims = {}
    
    # Dimensions pattern
    dim_pattern = re.compile(r'(\d+\.?\d*)"')
    dim_matches = dim_pattern.findall(text)
    
    # Weight
    weight_pattern = re.compile(r'(\d+)#')
    weight_match = weight_pattern.search(text)
    if weight_match:
        dims['weight'] = float(weight_match.group(1))
    
    # Volume
    volume_pattern = re.compile(r'([\d.]+)\s*cu\.?\s*ft', re.IGNORECASE)
    volume_match = volume_pattern.search(text)
    if volume_match:
        dims['volume'] = float(volume_match.group(1))
    
    # Yardage
    yardage_pattern = re.compile(r'([\d.]+)y\b')
    yardage_match = yardage_pattern.search(text)
    if yardage_match:
        dims['yardage'] = float(yardage_match.group(1))
    
    # Assign first 3 dimensions (height, width, depth)
    if len(dim_matches) >= 3:
        dims['height'] = float(dim_matches[0])
        dims['width'] = float(dim_matches[1])
        dims['depth'] = float(dim_matches[2])
    
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


class CatalogParserService:
    """Service for parsing PDF catalogs"""
    
    def __init__(self, db_session, tmp_images_dir: Optional[str] = None):
        self.db = db_session
        # Use FRONTEND_PATH/tmp/images by default
        if tmp_images_dir is None:
            frontend_path = Path(settings.FRONTEND_PATH)
            tmp_images_dir = str(frontend_path / "tmp" / "images")
        self.tmp_images_dir = Path(tmp_images_dir)
        self.tmp_images_dir.mkdir(parents=True, exist_ok=True)
    
    def parse_catalog(
        self,
        pdf_path: str,
        upload_record: CatalogUpload,
        max_pages: Optional[int] = None
    ) -> Dict:
        """
        Parse entire catalog PDF
        Returns summary of extracted data
        """
        upload_id = upload_record.upload_id
        
        # Update status
        upload_record.status = 'parsing'
        upload_record.started_at = datetime.utcnow()
        upload_record.current_step = 'Analyzing PDF structure'
        self.db.commit()
        
        # Open PDF and get page count
        logger.info(f"Opening PDF for catalog upload {upload_id}")
        with pdfplumber.open(pdf_path) as pdf:
            total_pages = len(pdf.pages)
            upload_record.total_pages = total_pages
            self.db.commit()
        
        logger.info(f"Processing {total_pages} pages for upload {upload_id}")
        
        # Limit pages if specified
        pages_to_process = min(max_pages, total_pages) if max_pages else total_pages
        
        all_families = []
        all_products = []
        all_variations = []
        all_images = []
        
        # Progress logging throttle (log every 5 seconds max)
        last_log_time = time.time()
        start_time = time.time()
        
        # Parse each page
        for page_num in range(1, pages_to_process + 1):
            try:
                # Update progress
                progress_pct = int((page_num / pages_to_process) * 90)
                upload_record.current_step = f'Parsing page {page_num}/{pages_to_process}'
                upload_record.progress_percentage = progress_pct
                upload_record.pages_processed = page_num
                
                # Throttled logging - only log every 5 seconds
                current_time = time.time()
                if current_time - last_log_time >= 5.0:
                    elapsed = int(current_time - start_time)
                    pages_per_sec = page_num / elapsed if elapsed > 0 else 0
                    eta_seconds = int((pages_to_process - page_num) / pages_per_sec) if pages_per_sec > 0 else 0
                    logger.info(
                        f"Upload {upload_id}: Progress {progress_pct}% "
                        f"(page {page_num}/{pages_to_process}, "
                        f"{pages_per_sec:.1f} pages/sec, ETA: {eta_seconds}s)"
                    )
                    last_log_time = current_time
                
                # Commit progress to DB (but not every page - every 10 pages)
                if page_num % 10 == 0 or page_num == pages_to_process:
                    self.db.commit()
                
                # Parse page
                page_data = parse_catalog_page(pdf_path, page_num, upload_id, self.tmp_images_dir)
                
                # Create family (one per page)
                if page_data['products']:  # Only if products found
                    family = self._create_tmp_family(page_data, upload_id, page_num)
                    all_families.append(family)
                    
                    # Collect all product image URLs for this page
                    product_image_urls = [img['url'] for img in page_data['product_images']]
                    
                    # Distribute images across products on the page
                    num_products = len(page_data['products'])
                    images_per_product = max(1, len(product_image_urls) // num_products) if num_products > 0 else 0
                    
                    # Create products and variations
                    for idx, product_data in enumerate(page_data['products']):
                        # Assign images to this product
                        start_idx = idx * images_per_product
                        end_idx = start_idx + images_per_product if idx < num_products - 1 else len(product_image_urls)
                        product_images = product_image_urls[start_idx:end_idx]
                        
                        product = self._create_tmp_product(
                            product_data, family, upload_id, page_num, product_images
                        )
                        all_products.append(product)
                        
                        # Create variations
                        for var_data in product_data['variations']:
                            variation = self._create_tmp_variation(
                                var_data, product, upload_id
                            )
                            all_variations.append(variation)
                    
                    # Create image records (still maintain TmpProductImage table for metadata)
                    for idx, img_data in enumerate(page_data['product_images']):
                        # Determine which product this image belongs to
                        product_idx = min(idx // images_per_product, num_products - 1) if images_per_product > 0 else 0
                        product = all_products[-num_products + product_idx] if num_products > 0 else None
                        
                        image = self._create_tmp_image(
                            img_data, product, upload_id, page_num
                        )
                        all_images.append(image)
                
            except Exception as e:
                logger.error(f"Error parsing page {page_num}: {e}")
                continue
        
        # Final commit
        self.db.commit()
        
        # Update final status
        total_time = int(time.time() - start_time)
        logger.info(
            f"Upload {upload_id} completed: {len(all_families)} families, "
            f"{len(all_products)} products, {len(all_variations)} variations, "
            f"{len(all_images)} images in {total_time}s"
        )
        
        upload_record.status = 'completed'
        upload_record.completed_at = datetime.utcnow()
        upload_record.progress_percentage = 100
        upload_record.current_step = 'Completed'
        upload_record.families_found = len(all_families)
        upload_record.products_found = len(all_products)
        upload_record.variations_found = len(all_variations)
        upload_record.images_extracted = len(all_images)
        upload_record.expires_at = datetime.utcnow() + timedelta(hours=48)
        
        self.db.commit()
        
        return {
            'families': len(all_families),
            'products': len(all_products),
            'variations': len(all_variations),
            'images': len(all_images),
        }
    
    def _create_tmp_family(self, page_data: Dict, upload_id: str, page_num: int) -> TmpProductFamily:
        """Create temporary family record"""
        family_info = page_data.get('family_info', {})
        
        # Get family name images - use first as family_image, second as banner if available
        family_name_image_urls = [img['url'] for img in page_data.get('family_name_images', [])]
        family_image = family_name_image_urls[0] if len(family_name_image_urls) > 0 else None
        banner_image = family_name_image_urls[1] if len(family_name_image_urls) > 1 else None
        
        family = TmpProductFamily(
            upload_id=upload_id,
            name='Unknown',  # Family names are images
            slug=f"unknown-family-page-{page_num}",
            source_page=page_num,
            features=family_info.get('features'),
            wood_species=family_info.get('wood_species'),
            standard_info=family_info.get('standard'),
            options=family_info.get('options'),
            environmental_info=family_info.get('environmental'),
            extraction_notes=page_data.get('notes', []),
            family_image=family_image,  # First family name image as main image
            banner_image_url=banner_image,  # Second family name image as banner (if exists)
            extraction_confidence=60,
            requires_review=True,
            expires_at=datetime.utcnow() + timedelta(hours=48),
        )
        
        self.db.add(family)
        self.db.flush()
        return family
    
    def _calculate_product_confidence(self, product_data: Dict, image_count: int = 0) -> int:
        """
        Calculate extraction confidence score (0-100) based on data completeness
        
        Factors:
        - Model number present: +30
        - Dimensions present: +20
        - Has at least one image: +20
        - Has variations: +15
        - Multiple images: +10
        - Complete dimensions (all 6 fields): +5
        """
        score = 0
        
        # Model number is mandatory - if missing, low confidence
        if product_data.get('base_model'):
            score += 30
        else:
            return 10  # Very low confidence without model number
        
        # Dimensions - check if any are present
        dims = product_data.get('dimensions', {})
        if dims:
            present_dims = sum(1 for v in dims.values() if v is not None and v > 0)
            if present_dims > 0:
                score += 20
            
            # Bonus for complete dimensions
            if present_dims >= 6:  # height, width, depth, weight, volume, yardage
                score += 5
        
        # Images
        if image_count > 0:
            score += 20
            if image_count > 1:
                score += 10
        
        # Variations
        variations = product_data.get('variations', [])
        if len(variations) > 0:
            score += 15
        
        return min(100, score)
    
    def _create_tmp_product(
        self, product_data: Dict, family: TmpProductFamily, upload_id: str, page_num: int, image_urls: List[str] = None
    ) -> TmpChair:
        """Create temporary product record"""
        dims = product_data.get('dimensions', {})
        
        # Use provided image URLs or empty list
        images = image_urls if image_urls else []
        primary_image = images[0] if images else None
        
        # Calculate confidence score based on extracted data
        confidence = self._calculate_product_confidence(product_data, len(images))
        
        product = TmpChair(
            upload_id=upload_id,
            family_id=family.id,
            model_number=product_data['base_model'],
            name=product_data.get('model_name', 'Unknown'),
            slug=f"model-{product_data['base_model']}-{upload_id}",
            source_page=page_num,
            height=dims.get('height'),
            width=dims.get('width'),
            depth=dims.get('depth'),
            weight=dims.get('weight'),
            volume=dims.get('volume'),
            yardage=dims.get('yardage'),
            frame_material='Unknown',
            stock_status='Unknown',
            images=images,  # Store image URLs in JSON column
            primary_image_url=primary_image,
            extraction_confidence=confidence,  # Dynamic confidence calculation
            requires_review=True,
            expires_at=datetime.utcnow() + timedelta(hours=48),
        )
        
        self.db.add(product)
        self.db.flush()
        return product
    
    def _create_tmp_variation(
        self, var_data: Dict, product: TmpChair, upload_id: str
    ) -> TmpProductVariation:
        """Create temporary variation record"""
        sku = var_data['full_model']
        
        variation = TmpProductVariation(
            upload_id=upload_id,
            product_id=product.id,
            sku=sku,
            suffix=var_data.get('suffix'),
            suffix_description=f"Variation {var_data.get('suffix', 'Unknown')}",
            stock_status='Unknown',
            extraction_confidence=75,
            expires_at=datetime.utcnow() + timedelta(hours=48),
        )
        
        self.db.add(variation)
        self.db.flush()
        return variation
    
    def _create_tmp_image(
        self, img_data: Dict, product: TmpChair, upload_id: str, page_num: int
    ) -> TmpProductImage:
        """Create temporary image record"""
        image = TmpProductImage(
            upload_id=upload_id,
            product_id=product.id if product else None,
            image_url=img_data['url'],
            image_type=img_data['type'],
            image_classification=img_data['type'],
            source_page=page_num,
            width=img_data.get('width'),
            height=img_data.get('height'),
            file_size=img_data.get('file_size'),
            format=img_data.get('format'),
            original_filename=img_data.get('filename'),
            expires_at=datetime.utcnow() + timedelta(hours=48),
        )
        
        self.db.add(image)
        self.db.flush()
        return image
