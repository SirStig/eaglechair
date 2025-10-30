"""
Upload Routes - API v1

Handles file uploads (images, documents, etc.)
"""

import logging
import os
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from backend.api.dependencies import get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Upload"])

# Base upload directory
# For production with separated server directories:
# Backend: /home/dh_wmujeb/api.eaglechair.com
# Frontend: /home/dh_wmujeb/joshua.eaglechair.com
# Files need to be uploaded to frontend's uploads directory
FRONTEND_UPLOAD_PATH = os.getenv(
    "FRONTEND_UPLOAD_PATH", 
    "/home/dh_wmujeb/joshua.eaglechair.com/uploads"
)
UPLOAD_BASE_DIR = Path(FRONTEND_UPLOAD_PATH) if os.path.isabs(FRONTEND_UPLOAD_PATH) else Path("uploads")
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


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
        # Extract path from URL
        url_path = request.url
        if url_path.startswith('/'):
            url_path = url_path[1:]
        
        # Construct file path
        file_path = Path(url_path)
        
        # Security check - ensure path is within uploads directory
        if not str(file_path).startswith('uploads/'):
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

