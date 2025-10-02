#!/usr/bin/env python3
"""
EagleChair Backend Development Server Runner

Run this script to start the development server with hot reload
"""

import uvicorn
from backend.core.config import settings

if __name__ == "__main__":
    print("🚀 Starting EagleChair Backend Development Server...")
    print(f"📍 URL: http://{settings.HOST}:{settings.PORT}")
    print(f"📚 Docs: http://{settings.HOST}:{settings.PORT}/docs")
    print(f"🔄 Hot reload: {'Enabled' if settings.RELOAD else 'Disabled'}")
    print(f"🐛 Debug mode: {'Enabled' if settings.DEBUG else 'Disabled'}\n")
    
    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        reload_dirs=["backend"],
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
    )
