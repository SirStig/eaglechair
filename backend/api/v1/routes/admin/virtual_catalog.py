"""
Virtual Catalog Upload Admin Routes
Admin-only endpoints for uploading and parsing manufacturer catalogs
"""

import logging
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, joinedload

from backend.api.dependencies import get_current_admin
from backend.core.config import settings
from backend.database.base import get_db
from backend.models.chair import Chair, ProductFamily, ProductImage, ProductVariation
from backend.models.tmp_catalog import (
    CatalogUpload,
    TmpChair,
    TmpProductFamily,
    TmpProductImage,
    TmpProductVariation,
)
from backend.services.cleanup_service import cleanup_service
from backend.services.pdf_parser_service import CatalogParserService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Admin - Virtual Catalog"])


# Use FRONTEND_PATH for tmp directories
FRONTEND_PATH = Path(settings.FRONTEND_PATH)
TMP_UPLOAD_DIR = FRONTEND_PATH / "tmp" / "uploads"
TMP_IMAGES_DIR = FRONTEND_PATH / "tmp" / "images"

# Ensure directories exist
TMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
TMP_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


@router.post(
    "/upload",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload PDF Catalog"
)
async def upload_catalog(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="PDF catalog file"),
    max_pages: Optional[int] = Query(None, description="Limit parsing to N pages (for testing)"),
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Upload a manufacturer PDF catalog for parsing
    
    - **Admin only**
    - Accepts PDF files up to 1GB
    - Returns upload_id for tracking parse progress
    - Parsing happens asynchronously in background
    """
    # Validate filename exists
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is required"
        )
    
    # Sanitize filename to prevent path traversal
    from pathlib import Path as PathLib
    sanitized_filename = PathLib(file.filename).name
    # Remove dangerous characters
    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    for char in dangerous_chars:
        sanitized_filename = sanitized_filename.replace(char, '_')
    
    # Validate file extension
    if not sanitized_filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted"
        )
    
    # Validate file size before processing (check Content-Length header if available)
    # Note: We'll also check after reading, but this helps reject obviously large files early
    
    # Create upload record
    upload_record = CatalogUpload(
        filename=sanitized_filename,
        file_size=0,  # Will update after saving
        status='uploaded',
        uploaded_by=admin.email if admin else 'Unknown',
    )
    db.add(upload_record)
    await db.flush()
    
    upload_id = upload_record.upload_id
    
    # Save file with sanitized filename
    file_path = TMP_UPLOAD_DIR / f"{upload_id}_{sanitized_filename}"
    
    # Ensure file path is within TMP_UPLOAD_DIR (path traversal protection)
    file_path_resolved = file_path.resolve()
    tmp_dir_resolved = TMP_UPLOAD_DIR.resolve()
    if not str(file_path_resolved).startswith(str(tmp_dir_resolved)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    
    try:
        # Validate file size (1GB max for PDFs)
        MAX_PDF_SIZE = 1 * 1024 * 1024 * 1024  # 1GB
        
        logger.info(f"Saving uploaded file {sanitized_filename} for upload {upload_id}")
        
        # Read and validate file content
        content = await file.read()
        
        # Validate file size
        if len(content) > MAX_PDF_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size: {MAX_PDF_SIZE / 1024 / 1024 / 1024}GB"
            )
        
        # Validate MIME type - must be PDF
        if not content.startswith(b'%PDF'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match PDF format"
            )
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(content)
        
        # Update file size
        file_size = len(content)
        upload_record.file_size = file_size
        upload_record.file_path = str(file_path)
        await db.commit()
        
        logger.info(f"File saved ({file_size} bytes), starting background parsing for {upload_id}")
        
        # Start parsing in background
        background_tasks.add_task(
            parse_catalog_background,
            upload_id=upload_id,
            file_path=str(file_path),
            max_pages=max_pages
        )
        
        return {
            "success": True,
            "upload_id": upload_id,
            "filename": file.filename,
            "file_size": file_size,
            "status": "parsing",
            "message": "File uploaded successfully, parsing started in background. Use /upload/{upload_id}/status to check progress."
        }
    
    except Exception as e:
        logger.error(f"Upload failed for {upload_id}: {e}")
        upload_record.status = 'failed'
        upload_record.error_message = str(e)
        await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process catalog: {str(e)}"
        )


def parse_catalog_background(upload_id: str, file_path: str, max_pages: Optional[int] = None):
    """
    Background task for parsing catalog
    Runs independently with its own DB session
    """
    from backend.database.base import SessionLocal
    
    db = SessionLocal()
    try:
        logger.info(f"Background parsing started for upload {upload_id}")
        
        # Get upload record
        upload_record = db.query(CatalogUpload).filter(
            CatalogUpload.upload_id == upload_id
        ).first()
        
        if not upload_record:
            logger.error(f"Upload record {upload_id} not found")
            return
        
        # Parse catalog
        parser = CatalogParserService(db, tmp_images_dir=str(TMP_IMAGES_DIR))
        results = parser.parse_catalog(file_path, upload_record, max_pages=max_pages)
        
        logger.info(f"Background parsing completed for {upload_id}: {results}")
        
    except Exception as e:
        logger.error(f"Background parsing failed for {upload_id}: {e}", exc_info=True)
        
        # Update status to failed
        try:
            upload_record = db.query(CatalogUpload).filter(
                CatalogUpload.upload_id == upload_id
            ).first()
            if upload_record:
                upload_record.status = 'failed'
                upload_record.error_message = str(e)
                db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
    
    finally:
        db.close()


@router.get(
    "/uploads/recent",
    summary="List Recent Uploads"
)
async def list_recent_uploads(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    List recent catalog uploads with their status
    Returns non-expired uploads ordered by most recent
    """
    result = await db.execute(
        select(CatalogUpload)
        .where(
            or_(
                CatalogUpload.expires_at.is_(None),
                CatalogUpload.expires_at > datetime.utcnow()
            )
        )
        .order_by(CatalogUpload.created_at.desc())
        .limit(limit)
    )
    uploads = result.scalars().all()
    
    return {
        "uploads": [
            {
                "upload_id": u.upload_id,
                "filename": u.filename,
                "status": u.status,
                "progress": u.progress_percentage,
                "products_found": u.products_found,
                "created_at": u.created_at,
                "completed_at": u.completed_at,
            }
            for u in uploads
        ]
    }


@router.get(
    "/upload/{upload_id}/status",
    summary="Get Upload Status"
)
async def get_upload_status(
    upload_id: str,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Get status and progress of a catalog upload/parse operation
    """
    result = await db.execute(
        select(CatalogUpload).where(CatalogUpload.upload_id == upload_id)
    )
    upload = result.scalar_one_or_none()
    
    if not upload:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found"
        )
    
    return {
        "upload_id": upload.upload_id,
        "filename": upload.filename,
        "status": upload.status,
        "progress": upload.progress_percentage,
        "current_step": upload.current_step,
        "total_pages": upload.total_pages,
        "pages_processed": upload.pages_processed,
        "families_found": upload.families_found,
        "products_found": upload.products_found,
        "variations_found": upload.variations_found,
        "images_extracted": upload.images_extracted,
        "created_at": upload.created_at,
        "started_at": upload.started_at,
        "completed_at": upload.completed_at,
        "error_message": upload.error_message,
    }


@router.get(
    "/tmp/families",
    summary="List Temporary Families"
)
async def list_tmp_families(
    upload_id: Optional[str] = Query(None, description="Filter by upload session"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    List temporary product families pending review/import
    """
    stmt = select(TmpProductFamily).options(
        joinedload(TmpProductFamily.products)
    )
    
    if upload_id:
        stmt = stmt.where(TmpProductFamily.upload_id == upload_id)
    
    # Only show non-expired, non-imported records
    stmt = stmt.where(
        TmpProductFamily.expires_at > datetime.utcnow(),
        TmpProductFamily.import_status != 'imported'
    )
    
    # Get total count
    count_stmt = select(TmpProductFamily).where(
        TmpProductFamily.expires_at > datetime.utcnow(),
        TmpProductFamily.import_status != 'imported'
    )
    if upload_id:
        count_stmt = count_stmt.where(TmpProductFamily.upload_id == upload_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Get paginated results
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    families = result.scalars().unique().all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "families": [
            {
                "id": f.id,
                "upload_id": f.upload_id,
                "name": f.name,
                "slug": f.slug,
                "source_page": f.source_page,
                "products_count": len(f.products),
                "features": f.features,
                "wood_species": f.wood_species,
                "options": f.options,
                "extraction_confidence": f.extraction_confidence,
                "requires_review": f.requires_review,
                "import_status": f.import_status,
                "created_at": f.created_at,
            }
            for f in families
        ]
    }


@router.get(
    "/tmp/products",
    summary="List Temporary Products"
)
async def list_tmp_products(
    upload_id: Optional[str] = Query(None, description="Filter by upload session"),
    family_id: Optional[int] = Query(None, description="Filter by family"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    List temporary products pending review/import
    """
    stmt = select(TmpChair).options(
        joinedload(TmpChair.variations)
    )
    
    if upload_id:
        stmt = stmt.where(TmpChair.upload_id == upload_id)
    
    if family_id:
        stmt = stmt.where(TmpChair.family_id == family_id)
    
    # Only show non-expired, non-imported
    stmt = stmt.where(
        TmpChair.expires_at > datetime.utcnow(),
        TmpChair.import_status != 'imported'
    )
    
    # Get total count
    count_stmt = select(TmpChair).where(
        TmpChair.expires_at > datetime.utcnow(),
        TmpChair.import_status != 'imported'
    )
    if upload_id:
        count_stmt = count_stmt.where(TmpChair.upload_id == upload_id)
    if family_id:
        count_stmt = count_stmt.where(TmpChair.family_id == family_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Get paginated results
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    products = result.scalars().unique().all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "products": [
            {
                "id": p.id,
                "upload_id": p.upload_id,
                "model_number": p.model_number,
                "name": p.name,
                "family_id": p.family_id,
                "source_page": p.source_page,
                "dimensions": {
                    "height": p.height,
                    "width": p.width,
                    "depth": p.depth,
                    "weight": p.weight,
                    "volume": p.volume,
                    "yardage": p.yardage,
                },
                "variations_count": len(p.variations),
                "images": p.images if isinstance(p.images, list) else [],
                "images_count": len(p.images) if isinstance(p.images, list) else 0,
                "primary_image_url": p.primary_image_url,
                "extraction_confidence": p.extraction_confidence,
                "requires_review": p.requires_review,
                "import_status": p.import_status,
                "created_at": p.created_at,
            }
            for p in products
        ]
    }


@router.get(
    "/tmp/products/{product_id}",
    summary="Get Temporary Product Details"
)
async def get_tmp_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Get full details of a temporary product
    """
    stmt = select(TmpChair).options(
        joinedload(TmpChair.family),
        joinedload(TmpChair.variations)
    ).where(TmpChair.id == product_id)
    
    result = await db.execute(stmt)
    product = result.unique().scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Return ALL product fields for comprehensive editing
    return {
        "id": product.id,
        "upload_id": product.upload_id,
        
        # Family relationship
        "family": {
            "id": product.family.id if product.family else None,
            "name": product.family.name if product.family else None,
        } if product.family else None,
        "family_id": product.family_id,
        
        # Basic Information
        "model_number": product.model_number,
        "model_suffix": product.model_suffix,
        "suffix_description": product.suffix_description,
        "name": product.name,
        "slug": product.slug,
        "short_description": product.short_description,
        "full_description": product.full_description,
        
        # Categories
        "category_id": product.category_id,
        "subcategory_id": product.subcategory_id,
        
        # Pricing
        "base_price": product.base_price or 0,
        "msrp": product.msrp,
        
        # Dimensions
        "width": product.width,
        "depth": product.depth,
        "height": product.height,
        "seat_width": product.seat_width,
        "seat_depth": product.seat_depth,
        "seat_height": product.seat_height,
        "arm_height": product.arm_height,
        "back_height": product.back_height,
        
        # Weight & Volume
        "weight": product.weight,
        "shipping_weight": product.shipping_weight,
        "volume": product.volume,
        "yardage": product.yardage,
        
        # Materials & Construction
        "frame_material": product.frame_material,
        "construction_details": product.construction_details,
        
        # Features
        "features": product.features if isinstance(product.features, list) else [],
        
        # Available Options
        "available_finishes": product.available_finishes if isinstance(product.available_finishes, list) else [],
        "available_upholsteries": product.available_upholsteries if isinstance(product.available_upholsteries, list) else [],
        "available_colors": product.available_colors if isinstance(product.available_colors, list) else [],
        
        # Images
        "images": product.images if isinstance(product.images, list) else [],
        "primary_image_url": product.primary_image_url,
        "hover_image_url": product.hover_image_url,
        "thumbnail": product.thumbnail,
        
        # Additional Media
        "dimensional_drawing_url": product.dimensional_drawing_url,
        "cad_file_url": product.cad_file_url,
        "spec_sheet_url": product.spec_sheet_url,
        
        # Inventory & Availability
        "stock_status": product.stock_status,
        "lead_time_days": product.lead_time_days,
        "minimum_order_quantity": product.minimum_order_quantity,
        
        # Certifications & Standards
        "flame_certifications": product.flame_certifications if isinstance(product.flame_certifications, list) else [],
        "green_certifications": product.green_certifications if isinstance(product.green_certifications, list) else [],
        "ada_compliant": product.ada_compliant,
        
        # Usage & Application
        "recommended_use": product.recommended_use,
        "is_outdoor_suitable": product.is_outdoor_suitable,
        "warranty_info": product.warranty_info,
        "care_instructions": product.care_instructions,
        
        # SEO & Marketing
        "meta_title": product.meta_title,
        "meta_description": product.meta_description,
        "keywords": product.keywords if isinstance(product.keywords, list) else [],
        
        # Product Status
        "is_active": product.is_active,
        "is_featured": product.is_featured,
        "is_new": product.is_new,
        "is_custom_only": product.is_custom_only,
        
        # Display Order
        "display_order": product.display_order,
        
        # Variations
        "variations": [
            {
                "id": v.id,
                "sku": v.sku,
                "suffix": v.suffix,
                "suffix_description": v.suffix_description,
                "stock_status": v.stock_status,
                "lead_time_days": v.lead_time_days,
                "price_adjustment": v.price_adjustment,  # Fixed: was price_modifier
                "is_available": v.is_available,  # Fixed: was is_active
            }
            for v in product.variations
        ],
        
        # Tmp-specific metadata
        "source_page": product.source_page,
        "extraction_confidence": product.extraction_confidence,
        "extraction_notes": product.extraction_notes,
        "requires_review": product.requires_review,
        "import_status": product.import_status,
        "parsed_data": product.parsed_data,
        
        # Timestamps
        "created_at": product.created_at,
        "updated_at": product.updated_at,
        "expires_at": product.expires_at,
    }


@router.put(
    "/tmp/products/{product_id}",
    summary="Update Temporary Product"
)
async def update_tmp_product(
    product_id: int,
    updates: dict,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Update a temporary product before importing
    Allows comprehensive manual corrections and edits for all fields
    """
    stmt = select(TmpChair).where(TmpChair.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Update all allowed fields (comprehensive list matching TmpChair model)
    allowed_fields = [
        # Basic Information
        'model_number', 'model_suffix', 'suffix_description', 'name', 'slug',
        'short_description', 'full_description',
        
        # Categories
        'category_id', 'subcategory_id', 'family_id',
        
        # Pricing
        'base_price', 'msrp',
        
        # Dimensions
        'width', 'depth', 'height', 'seat_width', 'seat_depth', 'seat_height',
        'arm_height', 'back_height', 'additional_dimensions',
        
        # Weight & Volume
        'weight', 'shipping_weight', 'volume', 'yardage',
        
        # Materials & Construction
        'frame_material', 'construction_details',
        
        # Features
        'features',
        
        # Available Options
        'available_finishes', 'available_upholsteries', 'available_colors',
        
        # Images
        'images', 'primary_image_url', 'hover_image_url', 'thumbnail',
        
        # Additional Media
        'dimensional_drawing_url', 'cad_file_url', 'spec_sheet_url',
        
        # Inventory & Availability
        'stock_status', 'lead_time_days', 'minimum_order_quantity',
        
        # Certifications & Standards
        'flame_certifications', 'green_certifications', 'ada_compliant',
        
        # Usage & Application
        'recommended_use', 'is_outdoor_suitable', 'warranty_info', 'care_instructions',
        
        # SEO & Marketing
        'meta_title', 'meta_description', 'keywords',
        
        # Product Status
        'is_active', 'is_featured', 'is_new', 'is_custom_only',
        
        # Display Order
        'display_order',
        
        # Tmp-specific
        'extraction_confidence', 'requires_review', 'extraction_notes',
    ]
    
    # Handle variations separately if provided
    variations_data = updates.pop('variations', None)
    
    # Update product fields
    for field, value in updates.items():
        if field in allowed_fields and hasattr(product, field):
            setattr(product, field, value)
    
    # Update variations if provided
    if variations_data is not None:
        # Delete existing variations not in the new list
        existing_variation_ids = [v.id for v in product.variations]
        new_variation_ids = [v.get('id') for v in variations_data if v.get('id') and v['id'] < 9999999999]  # Exclude temp IDs
        
        for var_id in existing_variation_ids:
            if var_id not in new_variation_ids:
                stmt = delete(TmpProductVariation).where(TmpProductVariation.id == var_id)
                await db.execute(stmt)
        
        # Update or create variations
        for var_data in variations_data:
            var_id = var_data.get('id')
            
            # If ID is a timestamp (from frontend), create new variation
            if not var_id or var_id > 9999999999:
                new_var = TmpProductVariation(
                    product_id=product.id,
                    upload_id=product.upload_id,
                    sku=var_data.get('sku', ''),
                    suffix=var_data.get('suffix'),
                    suffix_description=var_data.get('suffix_description'),
                    stock_status=var_data.get('stock_status', 'Unknown'),
                    lead_time_days=var_data.get('lead_time_days'),
                    price_adjustment=var_data.get('price_adjustment', 0),
                    is_available=var_data.get('is_available', True),
                )
                db.add(new_var)
            else:
                # Update existing variation
                stmt = select(TmpProductVariation).where(TmpProductVariation.id == var_id)
                result = await db.execute(stmt)
                existing_var = result.scalar_one_or_none()
                
                if existing_var:
                    existing_var.sku = var_data.get('sku', existing_var.sku)
                    existing_var.suffix = var_data.get('suffix')
                    existing_var.suffix_description = var_data.get('suffix_description')
                    existing_var.stock_status = var_data.get('stock_status', existing_var.stock_status)
                    existing_var.lead_time_days = var_data.get('lead_time_days')
                    existing_var.price_adjustment = var_data.get('price_adjustment', existing_var.price_adjustment)
                    existing_var.is_available = var_data.get('is_available', existing_var.is_available)
    
    product.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(product)
    
    return {
        "success": True,
        "message": "Product updated successfully",
        "product_id": product.id
    }


@router.post(
    "/import",
    summary="Import Temporary Data to Production"
)
async def import_to_production(
    upload_id: str,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Import reviewed temporary data into production tables
    Moves tmp_* records to actual Chair, ProductFamily, etc.
    """
    # Get all tmp families for this upload
    stmt = select(TmpProductFamily).where(
        TmpProductFamily.upload_id == upload_id,
        TmpProductFamily.import_status == 'approved'
    )
    result = await db.execute(stmt)
    tmp_families = result.scalars().all()
    
    if not tmp_families:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No approved families found for this upload"
        )
    
    imported_counts = {
        'families': 0,
        'products': 0,
        'variations': 0,
        'images': 0,
    }
    
    try:
        for tmp_family in tmp_families:
            # Create production family
            family = ProductFamily(
                name=tmp_family.name,
                slug=tmp_family.slug,
                description=tmp_family.description,
                features=tmp_family.features,
                wood_species=tmp_family.wood_species,
                options=tmp_family.options,
                environmental_info=tmp_family.environmental_info,
            )
            db.add(family)
            db.flush()
            imported_counts['families'] += 1
            
            # Import products
            for tmp_product in tmp_family.products:
                if tmp_product.import_status != 'approved':
                    continue
                
                product = Chair(
                    family_id=family.id,
                    model_number=tmp_product.model_number,
                    name=tmp_product.name,
                    slug=tmp_product.slug,
                    description=tmp_product.description,
                    height=tmp_product.height,
                    width=tmp_product.width,
                    depth=tmp_product.depth,
                    weight=tmp_product.weight,
                    volume=tmp_product.volume,
                    yardage=tmp_product.yardage,
                    frame_material=tmp_product.frame_material,
                    stock_status=tmp_product.stock_status,
                )
                db.add(product)
                db.flush()
                imported_counts['products'] += 1
                
                # Import variations
                for tmp_var in tmp_product.variations:
                    variation = ProductVariation(
                        product_id=product.id,
                        sku=tmp_var.sku,
                        suffix=tmp_var.suffix,
                        suffix_description=tmp_var.suffix_description,
                        stock_status=tmp_var.stock_status,
                    )
                    db.add(variation)
                    imported_counts['variations'] += 1
                
                # Import images
                for tmp_img in tmp_product.images:
                    image = ProductImage(
                        product_id=product.id,
                        image_url=tmp_img.image_url,
                        image_type=tmp_img.image_type,
                        is_primary=tmp_img.is_primary,
                    )
                    db.add(image)
                    imported_counts['images'] += 1
                
                # Mark tmp product as imported
                tmp_product.import_status = 'imported'
            
            # Mark tmp family as imported
            tmp_family.import_status = 'imported'
        
        db.commit()
        
        # Update upload record
        stmt = select(CatalogUpload).where(
            CatalogUpload.upload_id == upload_id
        )
        result = await db.execute(stmt)
        upload = result.scalar_one_or_none()
        
        if upload:
            upload.status = 'imported'
        
        db.commit()
        
        return {
            "success": True,
            "message": "Import completed successfully",
            "imported": imported_counts
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Import failed: {str(e)}"
        )


@router.delete(
    "/tmp/products/{product_id}",
    summary="Delete Temporary Product"
)
async def delete_tmp_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Delete a temporary product (skip import)
    """
    stmt = select(TmpChair).where(TmpChair.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Mark as skipped instead of deleting (for audit trail)
    product.import_status = 'skipped'
    db.commit()
    
    return {
        "success": True,
        "message": "Product marked as skipped"
    }


@router.delete(
    "/upload/{upload_id}",
    summary="Delete Upload Session"
)
async def delete_upload_session(
    upload_id: str,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Delete an upload session and all associated data (products, families, images, files)
    This is a complete cleanup of a specific upload, not just clearing frontend state
    """
    try:
        import shutil
        from pathlib import Path
        
        # Find the upload
        stmt = select(CatalogUpload).where(CatalogUpload.upload_id == upload_id)
        result = await db.execute(stmt)
        upload = result.scalar_one_or_none()
        
        if not upload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload not found"
            )
        
        # Delete associated files
        files_deleted = 0
        
        # Delete uploaded PDF from tmp/uploads directory
        tmp_uploads_dir = TMP_UPLOAD_DIR / upload_id
        if tmp_uploads_dir.exists():
            shutil.rmtree(tmp_uploads_dir)
            logger.info(f"Deleted uploads directory: {tmp_uploads_dir}")
            files_deleted += 1
        
        # Also check if upload.file_path exists (legacy location)
        if upload.file_path:
            file_path = Path(upload.file_path)
            if file_path.exists():
                file_path.unlink()
                files_deleted += 1
                logger.info(f"Deleted PDF: {file_path}")
        
        # Delete images directory for this upload (from frontend tmp directory)
        tmp_images_dir = TMP_IMAGES_DIR / upload_id
        if tmp_images_dir.exists():
            shutil.rmtree(tmp_images_dir)
            logger.info(f"Deleted images directory: {tmp_images_dir}")
            files_deleted += 1
        
        # Delete database records (in correct order - children first)
        # 1. Images
        stmt = delete(TmpProductImage).where(TmpProductImage.upload_id == upload_id)
        result = await db.execute(stmt)
        images_deleted = result.rowcount
        
        # 2. Variations
        stmt = delete(TmpProductVariation).where(TmpProductVariation.upload_id == upload_id)
        result = await db.execute(stmt)
        variations_deleted = result.rowcount
        
        # 3. Products
        stmt = delete(TmpChair).where(TmpChair.upload_id == upload_id)
        result = await db.execute(stmt)
        products_deleted = result.rowcount
        
        # 4. Families
        stmt = delete(TmpProductFamily).where(TmpProductFamily.upload_id == upload_id)
        result = await db.execute(stmt)
        families_deleted = result.rowcount
        
        # 5. Upload record
        await db.delete(upload)
        
        await db.commit()
        
        logger.info(
            f"Deleted upload {upload_id}: {families_deleted} families, "
            f"{products_deleted} products, {variations_deleted} variations, "
            f"{images_deleted} images, {files_deleted} files"
        )
        
        return {
            "success": True,
            "upload_id": upload_id,
            "deleted": {
                "families": families_deleted,
                "products": products_deleted,
                "variations": variations_deleted,
                "images": images_deleted,
                "files": files_deleted
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete upload {upload_id}: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete upload: {str(e)}"
        )


@router.post(
    "/cleanup",
    summary="Clean Up Expired Temporary Data"
)
async def cleanup_expired_data(
    include_orphaned: bool = Query(True, description="Also cleanup orphaned files"),
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Remove expired temporary data (files and database records)
    Optionally also removes orphaned files without DB records
    """
    try:
        # Run cleanup using the service
        expired_stats = await cleanup_service.cleanup_expired_data(db)
        
        result = {
            "success": True,
            "expired": expired_stats
        }
        
        # Optionally cleanup orphaned files
        if include_orphaned:
            orphaned_stats = await cleanup_service.cleanup_orphaned_files()
            result["orphaned"] = orphaned_stats
        
        return result
        
    except Exception as e:
        logger.error(f"Cleanup failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}"
        )

