"""
Upload Routes - API v1

Handles file uploads (images, documents, etc.)
"""

import logging
import mimetypes
import time
from pathlib import Path
from urllib.parse import urlparse

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

# Allowed file types with MIME type mapping
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
ALLOWED_IMAGE_MIMES = {
    "image/jpeg", "image/jpg", "image/png", "image/gif", 
    "image/webp", "image/svg+xml"
}

ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".doc", ".docx", ".zip"}
ALLOWED_DOCUMENT_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip"
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_PDF_SIZE = 1 * 1024 * 1024 * 1024  # 1GB for PDFs


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal attacks.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename safe for use in file paths
    """
    # Remove any path components (path traversal protection)
    filename = Path(filename).name
    
    # Remove leading dots and slashes
    filename = filename.lstrip('.\\/')
    
    # Remove or replace dangerous characters
    dangerous_chars = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
    for char in dangerous_chars:
        filename = filename.replace(char, '_')
    
    return filename


def sanitize_subfolder(subfolder: str) -> str:
    """
    Sanitize subfolder name to prevent path traversal.
    
    Args:
        subfolder: Subfolder name
        
    Returns:
        Sanitized subfolder name
    """
    # Remove path components
    subfolder = Path(subfolder).name
    
    # Only allow alphanumeric, dash, and underscore
    subfolder = "".join(c for c in subfolder if c.isalnum() or c in "-_")
    
    return subfolder or "default"


MIME_TO_IMAGE_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
}


def detect_mime_from_content(content: bytes, filename: str) -> str | None:
    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        return "image/png"
    if content.startswith(b'\xff\xd8\xff'):
        return "image/jpeg"
    if content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
        return "image/gif"
    if content.startswith(b'RIFF') and b'WEBP' in content[:12]:
        return "image/webp"
    if content.startswith(b'%PDF'):
        return "application/pdf"
    if content.startswith(b'PK\x03\x04'):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document" if filename.lower().endswith('.docx') else "application/zip"
    if content.startswith(b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'):
        return "application/msword"
    content_start = content.lstrip()
    if content_start.startswith(b'\xef\xbb\xbf'):
        content_start = content_start[3:]
    if content_start.startswith(b'<?xml') or content_start.startswith(b'<svg') or content_start.startswith(b'<!DOCTYPE'):
        return "image/svg+xml"
    detected, _ = mimetypes.guess_type(filename)
    return detected


def validate_mime_type(content: bytes, expected_mimes: set, filename: str) -> bool:
    detected_mime = detect_mime_from_content(content, filename)
    return detected_mime in expected_mimes if detected_mime else False


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
        content = await file.read()
        if len(content) < 1:
            raise HTTPException(status_code=400, detail="File is empty")
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB"
            )

        detected_mime = detect_mime_from_content(content, file.filename or "")
        if not detected_mime or detected_mime not in ALLOWED_IMAGE_MIMES:
            if file.content_type and file.content_type.lower() in {m.lower() for m in ALLOWED_IMAGE_MIMES}:
                detected_mime = file.content_type.split(";")[0].strip().lower()
                if detected_mime == "image/jpg":
                    detected_mime = "image/jpeg"
            else:
                logger.warning(f"Image upload rejected: len={len(content)}, content_type={file.content_type}, filename={file.filename}, first_bytes={content[:16].hex() if len(content) >= 16 else content.hex()}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
                )

        file_ext = MIME_TO_IMAGE_EXT.get(detected_mime)
        if not file_ext:
            file_ext = Path(sanitize_filename(file.filename or "image")).suffix.lower()
        if file_ext not in ALLOWED_IMAGE_EXTENSIONS:
            file_ext = ".png"

        subfolder = sanitize_subfolder(subfolder)
        base_name = Path(sanitize_filename(file.filename or "image")).stem
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_") or "image"

        # Create upload directory
        upload_dir = UPLOAD_BASE_DIR / "images" / subfolder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure upload directory path is within UPLOAD_BASE_DIR (security check)
        upload_dir_resolved = upload_dir.resolve()
        base_resolved = UPLOAD_BASE_DIR.resolve()
        if not str(upload_dir_resolved).startswith(str(base_resolved)):
            raise HTTPException(status_code=400, detail="Invalid upload path")
        
        timestamp = int(time.time())
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
        raw = request.url.strip()
        if raw.startswith(("http://", "https://")):
            try:
                parsed = urlparse(raw)
                url_path = (parsed.path or "").lstrip("/")
            except Exception:
                url_path = raw
        else:
            url_path = raw.lstrip("/")
        if not url_path.startswith("uploads/"):
            raise HTTPException(status_code=400, detail="Invalid file path")
        relative_path = url_path.replace("uploads/", "", 1)
        file_path = UPLOAD_BASE_DIR / relative_path
        try:
            file_path = file_path.resolve()
            base_resolved = UPLOAD_BASE_DIR.resolve()
            if not str(file_path).startswith(str(base_resolved)):
                raise HTTPException(status_code=400, detail="Invalid file path - outside upload directory")
        except (ValueError, OSError):
            raise HTTPException(status_code=400, detail="Invalid file path")
        if file_path.exists():
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
        
        # Sanitize filename to prevent path traversal
        sanitized_filename = sanitize_filename(file.filename)
        if not sanitized_filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        # Sanitize subfolder to prevent path traversal
        subfolder = sanitize_subfolder(subfolder)
        
        # Validate file extension
        file_ext = Path(sanitized_filename).suffix.lower()
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
        
        # Validate MIME type matches extension (prevent file type spoofing)
        if not validate_mime_type(content, ALLOWED_DOCUMENT_MIMES, sanitized_filename):
            raise HTTPException(
                status_code=400,
                detail="File content does not match declared file type"
            )
        
        # Create upload directory
        upload_dir = UPLOAD_BASE_DIR / "documents" / subfolder
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Ensure upload directory path is within UPLOAD_BASE_DIR (security check)
        upload_dir_resolved = upload_dir.resolve()
        base_resolved = UPLOAD_BASE_DIR.resolve()
        if not str(upload_dir_resolved).startswith(str(base_resolved)):
            raise HTTPException(status_code=400, detail="Invalid upload path")
        
        # Generate unique filename with timestamp
        timestamp = int(time.time())
        base_name = Path(sanitized_filename).stem
        # Additional sanitization for base name
        base_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        if not base_name:
            base_name = "document"
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

