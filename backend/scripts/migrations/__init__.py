"""
WordPress to EagleChair Migration Scripts

Organized migration scripts to import data from eaglechair_com.sql:
- migrate_products.py - Product families, products, variations
- migrate_content.py - Pages, legal documents, blog posts
- migrate_settings.py - Site settings, company info, contact details
- migrate_media.py - Product images and attachments

Each script can be run independently or all together via run_all_migrations.py
"""

__all__ = [
    'migrate_products',
    'migrate_content',
    'migrate_settings',
    'migrate_media',
]
