"""
Run All WordPress Migrations

Executes all migration scripts in the correct order:
1. migrate_products.py - Products, families, variations
2. migrate_content.py - Legal documents, pages
3. migrate_settings.py - (Future) Site settings, company info
4. migrate_media.py - (Future) Product images

Usage:
    python -m backend.scripts.migrations.run_all [--dry-run] [--skip SCRIPT]
    
Examples:
    # Run all migrations
    python -m backend.scripts.migrations.run_all
    
    # Dry run to preview
    python -m backend.scripts.migrations.run_all --dry-run
    
    # Skip specific migration
    python -m backend.scripts.migrations.run_all --skip content
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def run_migration(script_name: str, dry_run: bool = False) -> bool:
    """
    Run a specific migration script.
    
    Args:
        script_name: Name of migration module (e.g., 'migrate_products')
        dry_run: Whether to run in dry-run mode
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Import the migration module
        module_name = f"backend.scripts.migrations.{script_name}"
        module = __import__(module_name, fromlist=['main'])
        
        # Run the migration
        logger.info(f"\n{'='*70}")
        logger.info(f"RUNNING: {script_name}")
        logger.info(f"{'='*70}\n")
        
        await module.main(dry_run=dry_run)
        
        logger.info(f"\n✓ {script_name} completed successfully\n")
        return True
        
    except Exception as e:
        logger.error(f"\n✗ {script_name} failed: {e}\n", exc_info=True)
        return False


async def main(dry_run: bool = False, skip: list[str] = None):
    """Run all migrations in order."""
    skip = skip or []
    
    logger.info("="*70)
    logger.info("WORDPRESS TO EAGLECHAIR MIGRATION")
    logger.info("="*70)
    logger.info("")
    
    if dry_run:
        logger.warning("⚠️  RUNNING IN DRY-RUN MODE")
        logger.warning("⚠️  No changes will be made to the database\n")
    
    # Define migration order
    migrations = [
        ('migrate_products', 'Product families and products'),
        ('migrate_content', 'Legal documents and pages'),
        # Add more migrations as they're created:
        # ('migrate_settings', 'Site settings and company info'),
        # ('migrate_media', 'Product images and attachments'),
    ]
    
    logger.info("Migration order:")
    for i, (script, description) in enumerate(migrations, 1):
        skip_marker = " [SKIPPED]" if script in skip else ""
        logger.info(f"  {i}. {script} - {description}{skip_marker}")
    logger.info("")
    
    # Run migrations
    results = {}
    for script, description in migrations:
        if script in skip:
            logger.info(f"⊗ Skipping {script} (--skip specified)\n")
            results[script] = 'skipped'
            continue
        
        success = await run_migration(script, dry_run=dry_run)
        results[script] = 'success' if success else 'failed'
        
        if not success:
            logger.error(f"\n⚠️  Migration {script} failed. Stopping here.")
            logger.error("Fix the error and run again.\n")
            break
    
    # Summary
    logger.info("="*70)
    logger.info("MIGRATION SUMMARY")
    logger.info("="*70)
    logger.info("")
    
    for script, description in migrations:
        status = results.get(script, 'not run')
        icon = {
            'success': '✓',
            'failed': '✗',
            'skipped': '⊗',
            'not run': '○'
        }[status]
        
        logger.info(f"  {icon} {script}: {status}")
    
    logger.info("")
    
    if all(v in ['success', 'skipped'] for v in results.values()):
        logger.info("✓ All migrations completed successfully!")
        if dry_run:
            logger.info("\nThis was a dry run. Run without --dry-run to apply changes.")
    else:
        logger.error("✗ Some migrations failed. Check logs above.")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run all WordPress migrations")
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without making changes'
    )
    parser.add_argument(
        '--skip',
        action='append',
        help='Skip specific migration (can be used multiple times)'
    )
    
    args = parser.parse_args()
    
    asyncio.run(main(dry_run=args.dry_run, skip=args.skip or []))
