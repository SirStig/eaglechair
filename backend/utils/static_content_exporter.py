"""
Static Content Exporter

Exports CMS content from database to JavaScript files for instant frontend loading.
This provides performance benefits by eliminating API calls for static content
like hero images, site settings, reps, gallery images, etc.

Handles both development and production environments.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class StaticContentExporter:
    """
    Exports database content to static JavaScript files in the frontend.
    
    Flow:
    1. Admin updates content in CMS
    2. Content saved to database
    3. This exporter generates/updates JS file in frontend/src/data/
    4. Frontend imports and uses the static file (no API call needed)
    """
    
    def __init__(self, frontend_path: Optional[str] = None):
        """
        Initialize the exporter.
        
        Args:
            frontend_path: Path to frontend directory. If None, auto-detect.
        """
        self.frontend_path = self._resolve_frontend_path(frontend_path)
        self.data_dir = self.frontend_path / "src" / "data"
        self.content_file = self.data_dir / "contentData.js"
        
        # Ensure data directory exists
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"StaticContentExporter initialized: {self.content_file}")
    
    def _resolve_frontend_path(self, custom_path: Optional[str] = None) -> Path:
        """
        Resolve the frontend directory path.
        
        Supports:
        - Custom path (for testing)
        - Environment variable FRONTEND_PATH
        - Auto-detection relative to backend directory
        - Production: assumes /www.eaglechair.com/ structure
        
        Args:
            custom_path: Optional custom path override
            
        Returns:
            Path to frontend directory
        """
        if custom_path:
            return Path(custom_path)
        
        # Check environment variable
        env_path = os.getenv("FRONTEND_PATH")
        if env_path:
            return Path(env_path)
        
        # Auto-detect based on backend location
        backend_dir = Path(__file__).resolve().parent.parent
        
        # Development: backend is sibling to frontend
        frontend_dev = backend_dir.parent / "frontend"
        if frontend_dev.exists():
            logger.info(f"Using development frontend path: {frontend_dev}")
            return frontend_dev
        
        # Production: assume /www.eaglechair.com/backend and /www.eaglechair.com/frontend
        # or built version at /www.eaglechair.com/dist
        production_paths = [
            backend_dir.parent / "frontend",
            backend_dir.parent / "dist",
            Path("/var/www/eaglechair.com/frontend"),
            Path("/var/www/eaglechair.com/dist"),
        ]
        
        for path in production_paths:
            if path.exists():
                logger.info(f"Using production frontend path: {path}")
                return path
        
        # Fallback to development path (will be created if needed)
        logger.warning(f"Frontend path not found, using: {frontend_dev}")
        return frontend_dev
    
    def _json_to_js_value(self, value: Any) -> str:
        """
        Convert Python value to JavaScript literal.
        
        Args:
            value: Python value to convert
            
        Returns:
            JavaScript literal as string
        """
        if value is None:
            return "null"
        elif isinstance(value, bool):
            return "true" if value else "false"
        elif isinstance(value, (int, float)):
            return str(value)
        elif isinstance(value, str):
            # Escape special characters
            escaped = value.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
            return f'"{escaped}"'
        elif isinstance(value, list):
            items = [self._json_to_js_value(item) for item in value]
            return f"[{', '.join(items)}]"
        elif isinstance(value, dict):
            items = [f'{key}: {self._json_to_js_value(val)}' for key, val in value.items()]
            return f"{{{', '.join(items)}}}"
        else:
            # Fallback to JSON serialization
            return json.dumps(value)
    
    def _format_js_object(self, obj: Dict[str, Any], indent: int = 2) -> str:
        """
        Format a dictionary as a pretty JavaScript object.
        
        Args:
            obj: Dictionary to format
            indent: Indentation spaces
            
        Returns:
            Formatted JavaScript object string
        """
        lines = ["{"]
        indent_str = " " * indent
        
        for i, (key, value) in enumerate(obj.items()):
            # Handle nested objects and arrays with proper formatting
            if isinstance(value, dict):
                value_str = self._format_js_object(value, indent + 2)
            elif isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                # Array of objects - format nicely
                value_str = "[\n"
                for j, item in enumerate(value):
                    value_str += " " * (indent + 2) + self._format_js_object(item, indent + 4)
                    if j < len(value) - 1:
                        value_str += ","
                    value_str += "\n"
                value_str += " " * indent + "]"
            else:
                value_str = self._json_to_js_value(value)
            
            comma = "," if i < len(obj) - 1 else ""
            lines.append(f"{indent_str}{key}: {value_str}{comma}")
        
        lines.append("}")
        return "\n".join(lines)
    
    def export_all_content(self, content_data: Dict[str, Any]) -> bool:
        """
        Export all CMS content to contentData.js file.
        
        This is the main method called after content updates.
        
        Args:
            content_data: Dictionary containing all content sections:
                - siteSettings: Site-wide settings
                - heroSlides: Homepage hero carousel
                - companyInfo: About us sections
                - teamMembers: Team/leadership
                - companyValues: Company values
                - companyMilestones: Company timeline
                - salesReps: Sales representative data
                - galleryImages: Installation gallery
                - clientLogos: Client/partner logos
                - features: Why choose us features
                - contactLocations: Contact locations
                
        Returns:
            True if successful, False otherwise
        """
        try:
            # Generate the JavaScript file content
            js_content = self._generate_js_file(content_data)
            
            # Write to file with atomic operation
            temp_file = self.content_file.with_suffix('.tmp')
            
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(js_content)
            
            # Atomic rename
            temp_file.replace(self.content_file)
            
            logger.info(f"Successfully exported content to {self.content_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export content: {e}", exc_info=True)
            return False
    
    def _generate_js_file(self, content_data: Dict[str, Any]) -> str:
        """
        Generate the complete JavaScript file content.
        
        Args:
            content_data: Content sections dictionary
            
        Returns:
            Complete JavaScript file content as string
        """
        timestamp = datetime.utcnow().isoformat()
        
        # File header
        lines = [
            "/**",
            " * Static CMS Content Data",
            " * ",
            " * AUTO-GENERATED - DO NOT EDIT MANUALLY",
            f" * Last updated: {timestamp}",
            " * Generated by: StaticContentExporter",
            " * ",
            " * This file contains CMS content exported from the database.",
            " * It provides instant loading without API calls for static content.",
            " * Products and dynamic data still use API calls.",
            " */",
            "",
        ]
        
        # Export each content section
        sections = [
            ("siteSettings", "Site Settings - Company branding, contact info, social media"),
            ("heroSlides", "Hero Slides - Homepage carousel"),
            ("companyInfo", "Company Information - About us sections"),
            ("teamMembers", "Team Members - Leadership and staff"),
            ("companyValues", "Company Values - Core values and principles"),
            ("companyMilestones", "Company Milestones - Timeline and history"),
            ("salesReps", "Sales Representatives - Find a rep data"),
            ("galleryImages", "Gallery Images - Installation showcase"),
            ("clientLogos", "Client Logos - Partner/client logos"),
            ("features", "Features - Why choose us / benefits"),
            ("contactLocations", "Contact Locations - Office and showroom locations"),
            ("pageContent", "Page Content - Dynamic page sections"),
        ]
        
        for key, description in sections:
            if key in content_data:
                lines.append(f"// {description}")
                lines.append(f"export const {key} = {self._json_to_js_value(content_data[key])};")
                lines.append("")
        
        # Add helper functions
        lines.extend([
            "// Helper: Get site setting by key",
            "export const getSiteSetting = (key, defaultValue = null) => {",
            "  return siteSettings?.[key] ?? defaultValue;",
            "};",
            "",
            "// Helper: Get rep by state code",
            "export const getRepByState = (stateCode) => {",
            "  return salesReps?.find(rep => ",
            "    rep.states_covered?.includes(stateCode)",
            "  ) ?? null;",
            "};",
            "",
            "// Helper: Get page content by slug and section",
            "export const getPageContent = (pageSlug, sectionKey) => {",
            "  return pageContent?.find(content => ",
            "    content.page_slug === pageSlug && content.section_key === sectionKey",
            "  ) ?? null;",
            "};",
            "",
            "// Content metadata",
            "export const CONTENT_METADATA = {",
            f"  lastUpdated: '{timestamp}',",
            "  version: '1.0.0',",
            "  generatedBy: 'StaticContentExporter'",
            "};",
        ])
        
        return "\n".join(lines)
    
    def export_site_settings(self, settings: Dict[str, Any]) -> bool:
        """
        Export just site settings (for quick updates).
        
        Args:
            settings: Site settings dictionary
            
        Returns:
            True if successful
        """
        # Read existing content
        existing = self._read_existing_content()
        existing['siteSettings'] = settings
        return self.export_all_content(existing)
    
    def export_hero_slides(self, slides: List[Dict[str, Any]]) -> bool:
        """
        Export hero slides.
        
        Args:
            slides: List of hero slide dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['heroSlides'] = slides
        return self.export_all_content(existing)
    
    def export_sales_reps(self, reps: List[Dict[str, Any]]) -> bool:
        """
        Export sales representatives.
        
        Args:
            reps: List of sales rep dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['salesReps'] = reps
        return self.export_all_content(existing)
    
    def export_gallery_images(self, images: List[Dict[str, Any]]) -> bool:
        """
        Export gallery/installation images.
        
        Args:
            images: List of installation image dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['galleryImages'] = images
        return self.export_all_content(existing)
    
    def _read_existing_content(self) -> Dict[str, Any]:
        """
        Read existing content file to preserve data during partial updates.
        
        Returns:
            Existing content dictionary or empty dict
        """
        if not self.content_file.exists():
            return {}
        
        try:
            # Parse existing JS file (simple parsing - looks for export const)
            # For simplicity, we'll maintain a JSON cache file
            cache_file = self.data_dir / ".contentData.json"
            if cache_file.exists():
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Could not read existing content: {e}")
        
        return {}
    
    def _update_cache(self, content_data: Dict[str, Any]):
        """
        Update the JSON cache file for easier reading.
        
        Args:
            content_data: Content to cache
        """
        try:
            cache_file = self.data_dir / ".contentData.json"
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(content_data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not update cache: {e}")


# Singleton instance
_exporter_instance: Optional[StaticContentExporter] = None


def get_exporter() -> StaticContentExporter:
    """
    Get or create the singleton exporter instance.
    
    Returns:
        StaticContentExporter instance
    """
    global _exporter_instance
    if _exporter_instance is None:
        _exporter_instance = StaticContentExporter()
    return _exporter_instance


async def export_content_after_update(content_type: str, data: Any) -> bool:
    """
    Convenience function to export content after database update.
    
    This should be called after successful database commits.
    
    Args:
        content_type: Type of content (siteSettings, heroSlides, salesReps, etc.)
        data: The data to export (dict or list)
        
    Returns:
        True if export successful
    """
    try:
        exporter = get_exporter()
        
        # Route to appropriate export method
        export_methods = {
            'siteSettings': exporter.export_site_settings,
            'heroSlides': exporter.export_hero_slides,
            'salesReps': exporter.export_sales_reps,
            'galleryImages': exporter.export_gallery_images,
        }
        
        if content_type in export_methods:
            return export_methods[content_type](data)
        else:
            # Generic export - update and export all
            existing = exporter._read_existing_content()
            existing[content_type] = data
            return exporter.export_all_content(existing)
            
    except Exception as e:
        logger.error(f"Export failed for {content_type}: {e}", exc_info=True)
        return False
