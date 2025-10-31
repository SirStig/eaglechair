"""
Upload Routes - API v1

Handles file uploads (images, documents, etc.)
"""

import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.api.dependencies import get_current_admin
from backend.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Upload"])

# Base upload directory
# For production with separated server directories:
# Backend: /home/dh_wmujeb/api.eaglechair.com
# Frontend: /home/dh_wmujeb/joshua.eaglechair.com
# Files need to be uploaded to frontend's uploads directory
# In dev: Use project root /uploads (where main.py serves from)
# In prod: Use FRONTEND_PATH from settings + /uploads
def get_upload_base_dir() -> Path:
    """Get the base upload directory path for dev/prod"""
    frontend_path = Path(settings.FRONTEND_PATH)
    
    # If FRONTEND_PATH is an absolute path (production), use it + /uploads
    if frontend_path.is_absolute():
        # Production: Frontend is in separate directory, uploads go to frontend/uploads
        uploads_path = frontend_path / "uploads"
        logger.info(f"Using production upload path: {uploads_path}")
        return uploads_path
    
    # Development: Use project root /uploads (where main.py serves from)
    # upload.py is at: backend/api/v1/routes/admin/upload.py
    # main.py is at: backend/main.py
    # main.py uses: Path(__file__).parent.parent / "uploads" = project_root/uploads
    # So from upload.py we need to go: admin -> routes -> v1 -> api -> backend -> project_root
    current_file = Path(__file__).resolve()
    # Go up 6 levels: admin -> routes -> v1 -> api -> backend -> project_root
    project_root = current_file.parent.parent.parent.parent.parent.parent
    uploads_path = project_root / "uploads"
    logger.info(f"Using development upload path: {uploads_path}")
    return uploads_path

UPLOAD_BASE_DIR = get_upload_base_dir()
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".zip"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_PDF_SIZE = 1 * 1024 * 1024 * 1024  # 1GB for PDFs


class DeleteImageRequest(BaseModel):
    """Request to delete an image"""
    url: str


@router.post(
    "/image",
    summary="Upload an image",
    description="Upload an image file to the server (Admin only)"
)
async def upload_image(
    file: UploadFile = File(...),
    subfolder: str = Form("products"),
    current_admin = Depends(get_current_admin)
):
    """
    Upload an image file.
    
    **Admin only** - Requires admin authentication.
    
    - **file**: The image file to upload
    - **subfolder**: Subfolder to organize images (e.g., 'products', 'team', 'hero')
    - **filename**: Optional custom filename (will be sanitized)
    """
    try:
        # Validate filename exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        # Create upload directory
        upload_dir = UPLOAD_BASE_DIR / "images" / subfolder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename with timestamp
        timestamp = int(time.time())
        file_ext = Path(file.filename).suffix.lower()
        base_name = Path(file.filename).stem
        # Sanitize base name
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        filename = f"{base_name}_{timestamp}{file_ext}"
        
        # Full file path
        file_path = upload_dir / filename
        
        # Write file
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Generate URL path
        url_path = f"/uploads/images/{subfolder}/{filename}"
        
        logger.info(f"Image uploaded: {url_path} by admin {current_admin.id}")
        
        return {
            "success": True,
            "url": url_path,
            "filename": filename,
            "size": len(content),
            "message": "Image uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload failed")


@router.delete(
    "/image",
    summary="Delete an image",
    description="Delete an image file from the server (Admin only)"
)
async def delete_image(
    request: DeleteImageRequest,
    current_admin = Depends(get_current_admin)
):
    """
    Delete an image file.
    
    **Admin only** - Requires admin authentication.
    """
    try:
        # Extract path from URL (e.g., "/uploads/images/products/image.jpg")
        url_path = request.url
        if url_path.startswith('/'):
            url_path = url_path[1:]  # Remove leading slash
        
        # Security check - ensure path is within uploads directory
        if not url_path.startswith('uploads/'):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        # Construct full file path using UPLOAD_BASE_DIR
        # Remove "uploads/" prefix and use the rest as relative path
        relative_path = url_path.replace('uploads/', '', 1)  # Remove first occurrence
        file_path = UPLOAD_BASE_DIR / relative_path
        
        # Additional security check - ensure resolved path is still within UPLOAD_BASE_DIR
        try:
            file_path = file_path.resolve()
            base_resolved = UPLOAD_BASE_DIR.resolve()
            if not str(file_path).startswith(str(base_resolved)):
                raise HTTPException(status_code=400, detail="Invalid file path - outside upload directory")
        except (ValueError, OSError):
            raise HTTPException(status_code=400, detail="Invalid file path")
        
        # Check if file exists
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Delete file
        file_path.unlink()
        
        logger.info(f"Image deleted: {url_path} by admin {current_admin.id}")
        
        return {
            "success": True,
            "message": "Image deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image deletion failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Deletion failed")


@router.post(
    "/document",
    summary="Upload a document (PDF, etc.)",
    description="Upload a document file to the server (Admin only)"
)
async def upload_document(
    file: UploadFile = File(...),
    subfolder: str = Form("catalogs"),
    current_admin = Depends(get_current_admin)
):
    """
    Upload a document file (PDF, etc.).
    
    **Admin only** - Requires admin authentication.
    
    - **file**: The document file to upload
    - **subfolder**: Subfolder to organize documents (e.g., 'catalogs', 'guides')
    """
    try:
        # Validate filename exists
        if not file.filename:
            raise HTTPException(status_code=400, detail="Filename is required")
        
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_DOCUMENT_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_DOCUMENT_EXTENSIONS)}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate file size (larger limit for PDFs)
        max_size = MAX_PDF_SIZE if file_ext == ".pdf" else MAX_FILE_SIZE
        if len(content) > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {max_size / 1024 / 1024}MB"
            )
        
        # Create upload directory
        upload_dir = UPLOAD_BASE_DIR / "documents" / subfolder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename with timestamp
        timestamp = int(time.time())
        file_ext = Path(file.filename).suffix.lower()
        base_name = Path(file.filename).stem
        # Sanitize base name
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        filename = f"{base_name}_{timestamp}{file_ext}"
        
        # Full file path
        file_path = upload_dir / filename
        
        # Write file
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Generate URL path
        url_path = f"/uploads/documents/{subfolder}/{filename}"
        
        logger.info(f"Document uploaded: {url_path} by admin {current_admin.id}")
        
        return {
            "success": True,
            "url": url_path,
            "filename": filename,
            "size": len(content),
            "message": "Document uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Upload failed")

