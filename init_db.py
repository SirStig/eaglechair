#!/usr/bin/env python3
"""
Database Initialization Script

Creates all tables for the EagleChair application using SQLAlchemy.
This script should be run after creating the database.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_path = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_path))

from backend.database.base import init_db
from backend.core.config import settings

async def main():
    """Initialize the database with all tables"""
    print("Initializing EagleChair database...")
    print(f"Database URL: {settings.database_url_async}")

    try:
        await init_db()
        print("✅ Database initialized successfully!")
        print("All tables have been created.")
    except Exception as e:
        print(f"❌ Error initializing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
