"""
Cleanup Service for Temporary Catalog Data
Handles scheduled cleanup of expired records and files
"""

import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.database.base import AsyncSessionLocal
from backend.models.tmp_catalog import (
    CatalogUpload,
    TmpChair,
    TmpProductFamily,
    TmpProductImage,
    TmpProductVariation,
)

logger = logging.getLogger(__name__)


class CleanupService:
    """Service for cleaning up expired temporary catalog data"""

    def __init__(self, tmp_upload_dir: Optional[str] = None, tmp_images_dir: Optional[str] = None):
        # Use FRONTEND_PATH/tmp by default
        frontend_path = Path(settings.FRONTEND_PATH)
        
        if tmp_upload_dir is None:
            tmp_upload_dir = str(frontend_path / "tmp" / "uploads")
        if tmp_images_dir is None:
            tmp_images_dir = str(frontend_path / "tmp" / "images")
            
        self.tmp_upload_dir = Path(tmp_upload_dir)
        self.tmp_images_dir = Path(tmp_images_dir)

    async def cleanup_expired_data(self, db: AsyncSession = None) -> Dict:
        """
        Clean up all expired temporary data (database records and files)
        
        Returns:
            Dict with cleanup statistics
        """
        close_db = False
        if db is None:
            db = AsyncSessionLocal()
            close_db = True

        try:
            now = datetime.utcnow()
            stats = {
                "uploads_deleted": 0,
                "families_deleted": 0,
                "products_deleted": 0,
                "variations_deleted": 0,
                "images_deleted": 0,
                "files_deleted": 0,
                "errors": []
            }

            # Find expired uploads
            stmt = select(CatalogUpload).where(CatalogUpload.expires_at < now)
            result = await db.execute(stmt)
            expired_uploads = result.scalars().all()

            logger.info(f"Found {len(expired_uploads)} expired uploads")

            for upload in expired_uploads:
                try:
                    # Delete associated files
                    if upload.file_path:
                        file_path = Path(upload.file_path)
                        if file_path.exists():
                            file_path.unlink()
                            stats["files_deleted"] += 1
                            logger.info(f"Deleted file: {file_path}")

                    # Delete images directory for this upload
                    upload_images_dir = self.tmp_images_dir / upload.upload_id
                    if upload_images_dir.exists():
                        shutil.rmtree(upload_images_dir)
                        logger.info(f"Deleted images directory: {upload_images_dir}")

                except Exception as e:
                    error_msg = f"Error deleting files for upload {upload.upload_id}: {e}"
                    logger.error(error_msg)
                    stats["errors"].append(error_msg)

            # Delete expired database records
            # Delete in correct order (children first)
            
            # 1. Images
            stmt = delete(TmpProductImage).where(TmpProductImage.expires_at < now)
            result = await db.execute(stmt)
            stats["images_deleted"] = result.rowcount

            # 2. Variations
            stmt = delete(TmpProductVariation).where(TmpProductVariation.expires_at < now)
            result = await db.execute(stmt)
            stats["variations_deleted"] = result.rowcount

            # 3. Products
            stmt = delete(TmpChair).where(TmpChair.expires_at < now)
            result = await db.execute(stmt)
            stats["products_deleted"] = result.rowcount

            # 4. Families
            stmt = delete(TmpProductFamily).where(TmpProductFamily.expires_at < now)
            result = await db.execute(stmt)
            stats["families_deleted"] = result.rowcount

            # 5. Uploads
            stats["uploads_deleted"] = len(expired_uploads)
            for upload in expired_uploads:
                db.delete(upload)

            await db.commit()

            logger.info(f"Cleanup completed: {stats}")
            return stats

        except Exception as e:
            logger.error(f"Cleanup failed: {e}", exc_info=True)
            await db.rollback()
            raise

        finally:
            if close_db:
                await db.close()

    async def cleanup_orphaned_files(self) -> Dict:
        """
        Clean up orphaned files (files without corresponding DB records)
        
        Returns:
            Dict with cleanup statistics
        """
        stats = {
            "uploads_scanned": 0,
            "images_scanned": 0,
            "orphaned_deleted": 0,
            "errors": []
        }

        db = AsyncSessionLocal()
        try:
            # Get all upload IDs from database
            stmt = select(CatalogUpload.upload_id)
            result = await db.execute(stmt)
            active_upload_ids = {row[0] for row in result.all()}

            # Check upload files
            if self.tmp_upload_dir.exists():
                for file_path in self.tmp_upload_dir.glob("*.pdf"):
                    stats["uploads_scanned"] += 1
                    # Extract upload_id from filename (assuming format: {upload_id}_{original_name}.pdf)
                    upload_id = file_path.stem.split("_")[0]
                    
                    if upload_id not in active_upload_ids:
                        try:
                            file_path.unlink()
                            stats["orphaned_deleted"] += 1
                            logger.info(f"Deleted orphaned file: {file_path}")
                        except Exception as e:
                            error_msg = f"Error deleting {file_path}: {e}"
                            logger.error(error_msg)
                            stats["errors"].append(error_msg)

            # Check image directories
            if self.tmp_images_dir.exists():
                for upload_dir in self.tmp_images_dir.iterdir():
                    if upload_dir.is_dir():
                        stats["images_scanned"] += 1
                        upload_id = upload_dir.name
                        
                        if upload_id not in active_upload_ids:
                            try:
                                shutil.rmtree(upload_dir)
                                stats["orphaned_deleted"] += 1
                                logger.info(f"Deleted orphaned directory: {upload_dir}")
                            except Exception as e:
                                error_msg = f"Error deleting {upload_dir}: {e}"
                                logger.error(error_msg)
                                stats["errors"].append(error_msg)

            logger.info(f"Orphaned file cleanup completed: {stats}")
            return stats

        finally:
            await db.close()


# Global instance
cleanup_service = CleanupService()


async def run_cleanup():
    """
    Run full cleanup (expired data + orphaned files)
    Can be called from scheduled job or manual trigger
    """
    logger.info("Starting scheduled cleanup")
    
    # Cleanup expired data
    expired_stats = await cleanup_service.cleanup_expired_data()
    
    # Cleanup orphaned files
    orphaned_stats = await cleanup_service.cleanup_orphaned_files()
    
    return {
        "expired": expired_stats,
        "orphaned": orphaned_stats
    }
