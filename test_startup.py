"""
Quick startup test to verify the application initializes correctly
"""

import sys
import asyncio

async def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    
    try:
        # Core modules
        from backend.core import config, security, exceptions, error_handlers, logging_config
        print("✓ Core modules imported")
        
        # Database
        from backend.database import base
        print("✓ Database module imported")
        
        # Models
        from backend.models import company, chair, legal, content, quote
        print("✓ Model modules imported")
        
        # Services
        from backend.services import AuthService, ProductService, QuoteService, ContentService
        print("✓ Service modules imported")
        
        # API
        from backend.api import dependencies, versioning
        from backend.api.v1 import router
        from backend.api.v1.routes import auth, products, quotes, content
        print("✓ API modules imported")
        
        # Utils
        from backend.utils import slug, pagination, validators
        print("✓ Utility modules imported")
        
        # Main app
        from backend import main
        print("✓ Main app imported")
        
        print("\n✅ All imports successful!")
        return True
        
    except Exception as e:
        print(f"\n❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_app_creation():
    """Test FastAPI app creation"""
    print("\nTesting app creation...")
    
    try:
        from backend.main import app
        
        # Check app attributes
        assert app.title, "App title not set"
        assert app.version, "App version not set"
        
        # Check routes are loaded
        routes = [route.path for route in app.routes]
        
        # Check for key endpoints
        expected_prefixes = ["/api/v1/auth", "/api/v1/products", "/api/v1/cart", "/api/v1/faq"]
        
        print(f"  Found {len(routes)} routes")
        print(f"  App title: {app.title}")
        print(f"  App version: {app.version}")
        
        print("\n✅ App created successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ App creation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("="*60)
    print("EagleChair Backend Startup Test")
    print("="*60)
    print()
    
    # Test imports
    imports_ok = await test_imports()
    
    if not imports_ok:
        print("\n⚠️  Stopping tests due to import errors")
        return False
    
    # Test app creation
    app_ok = await test_app_creation()
    
    # Summary
    print("\n" + "="*60)
    if imports_ok and app_ok:
        print("✅ ALL TESTS PASSED - Backend is ready!")
    else:
        print("❌ SOME TESTS FAILED - Check errors above")
    print("="*60)
    
    return imports_ok and app_ok


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)

