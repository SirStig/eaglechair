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
from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

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
        
        # Also track dist directory for production builds
        self.dist_dir = self.frontend_path / "dist"
        self.dist_data_dir = self.dist_dir / "data"
        self.dist_content_file = self.dist_data_dir / "contentData.js"
        
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
        Writes to both src/data (for dev) and dist/data (for production).
        
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
                - pageContent: Flexible page sections
                - legalDocuments: Legal docs, policies, warranties
                - faqs: Frequently asked questions
                - faqCategories: FAQ categories
                - catalogs: Virtual catalogs and guides
                - finishes: Wood finish options
                - upholsteries: Upholstery fabric options
                - hardware: Hardware components and specs
                - laminates: Laminate brands and patterns
                
        Returns:
            True if successful, False otherwise
        """
        try:
            # Generate the JavaScript file content
            js_content = self._generate_js_file(content_data)
            
            # Write to src/data (for development)
            self._write_content_file(self.content_file, js_content)
            
            # Write to dist/data (for production builds) if dist exists
            if self.dist_dir.exists():
                self.dist_data_dir.mkdir(parents=True, exist_ok=True)
                self._write_content_file(self.dist_content_file, js_content)
                logger.info(f"Also exported to production dist: {self.dist_content_file}")
            
            # Update cache for easier reading
            self._update_cache(content_data)
            
            logger.info(f"Successfully exported content to {self.content_file}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export content: {e}", exc_info=True)
            return False
    
    def _write_content_file(self, file_path: Path, content: str):
        """
        Write content to file with atomic operation.
        
        Args:
            file_path: Path to write to
            content: Content to write
        """
        temp_file = file_path.with_suffix('.tmp')
        
        with open(temp_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Atomic rename with retry on Windows
        max_retries = 3
        for attempt in range(max_retries):
            try:
                temp_file.replace(file_path)
                break
            except PermissionError:
                if attempt < max_retries - 1:
                    import time
                    time.sleep(0.1)  # Brief delay before retry
                else:
                    # Fallback: try deleting first then renaming
                    try:
                        file_path.unlink(missing_ok=True)
                        temp_file.rename(file_path)
                    except Exception as e:
                        logger.error(f"Failed to write content file after {max_retries} attempts: {e}")
                        raise
    
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
            ("legalDocuments", "Legal Documents - Terms, policies, warranties"),
            ("faqs", "FAQs - Frequently asked questions"),
            ("faqCategories", "FAQ Categories - FAQ organization"),
            ("catalogs", "Catalogs - Virtual catalogs and guides"),
            ("finishes", "Finishes - Wood finish options and swatches"),
            ("upholsteries", "Upholsteries - Upholstery fabric options"),
            ("hardware", "Hardware - Hardware components and specifications"),
            ("laminates", "Laminates - Laminate brands and patterns"),
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
    
    def export_features(self, features_list: List[Dict[str, Any]]) -> bool:
        """
        Export features (Why Choose Us sections).
        
        Args:
            features_list: List of feature dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['features'] = features_list
        return self.export_all_content(existing)
    
    def export_company_values(self, values: List[Dict[str, Any]]) -> bool:
        """
        Export company values.
        
        Args:
            values: List of company value dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['companyValues'] = values
        return self.export_all_content(existing)
    
    def export_company_milestones(self, milestones: List[Dict[str, Any]]) -> bool:
        """
        Export company milestones.
        
        Args:
            milestones: List of milestone dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['companyMilestones'] = milestones
        return self.export_all_content(existing)
    
    def export_team_members(self, team: List[Dict[str, Any]]) -> bool:
        """
        Export team members.
        
        Args:
            team: List of team member dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['teamMembers'] = team
        return self.export_all_content(existing)
    
    def export_client_logos(self, logos: List[Dict[str, Any]]) -> bool:
        """
        Export client logos.
        
        Args:
            logos: List of client logo dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['clientLogos'] = logos
        return self.export_all_content(existing)
    
    def export_company_info(self, info: List[Dict[str, Any]]) -> bool:
        """
        Export company info sections.
        
        Args:
            info: List of company info dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['companyInfo'] = info
        return self.export_all_content(existing)
    
    def export_contact_locations(self, locations: List[Dict[str, Any]]) -> bool:
        """
        Export contact locations.
        
        Args:
            locations: List of contact location dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['contactLocations'] = locations
        return self.export_all_content(existing)
    
    def export_page_content(self, content: List[Dict[str, Any]]) -> bool:
        """
        Export page content sections.
        
        Args:
            content: List of page content dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['pageContent'] = content
        return self.export_all_content(existing)
    
    def export_legal_documents(self, documents: List[Dict[str, Any]]) -> bool:
        """
        Export legal documents.
        
        Args:
            documents: List of legal document dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['legalDocuments'] = documents
        return self.export_all_content(existing)
    
    def export_faqs(self, faqs: List[Dict[str, Any]]) -> bool:
        """
        Export FAQs.
        
        Args:
            faqs: List of FAQ dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['faqs'] = faqs
        return self.export_all_content(existing)
    
    def export_faq_categories(self, categories: List[Dict[str, Any]]) -> bool:
        """
        Export FAQ categories.
        
        Args:
            categories: List of FAQ category dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['faqCategories'] = categories
        return self.export_all_content(existing)
    
    def export_catalogs(self, catalogs: List[Dict[str, Any]]) -> bool:
        """
        Export catalogs and guides.
        
        Args:
            catalogs: List of catalog dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['catalogs'] = catalogs
        return self.export_all_content(existing)
    
    def export_finishes(self, finishes: List[Dict[str, Any]]) -> bool:
        """
        Export wood finishes.
        
        Args:
            finishes: List of finish dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['finishes'] = finishes
        return self.export_all_content(existing)
    
    def export_upholsteries(self, upholsteries: List[Dict[str, Any]]) -> bool:
        """
        Export upholstery options.
        
        Args:
            upholsteries: List of upholstery dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['upholsteries'] = upholsteries
        return self.export_all_content(existing)
    
    def export_hardware(self, hardware: List[Dict[str, Any]]) -> bool:
        """
        Export hardware options.
        
        Args:
            hardware: List of hardware dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['hardware'] = hardware
        return self.export_all_content(existing)
    
    def export_laminates(self, laminates: List[Dict[str, Any]]) -> bool:
        """
        Export laminate options.
        
        Args:
            laminates: List of laminate dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['laminates'] = laminates
        return self.export_all_content(existing)
    
    def export_warranty_information(self, warranties: List[Dict[str, Any]]) -> bool:
        """
        Export warranty information.
        
        Args:
            warranties: List of warranty information dictionaries
            
        Returns:
            True if successful
        """
        existing = self._read_existing_content()
        existing['warranties'] = warranties
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


async def export_content_after_update(content_type: str, db: "AsyncSession") -> bool:
    """
    Convenience function to export content after database update.
    
    This should be called after successful database commits.
    QUERIES DATABASE to get fresh data.
    
    Args:
        content_type: Type of content (siteSettings, heroSlides, salesReps, etc.)
        db: Database session (required)
        
    Returns:
        True if export successful
    """
    from sqlalchemy import select

    from backend.models.chair import Finish, Upholstery
    from backend.models.content import (
        FAQ,
        Catalog,
        ClientLogo,
        CompanyMilestone,
        CompanyValue,
        FAQCategory,
        Feature,
        Hardware,
        HeroSlide,
        Installation,
        Laminate,
        PageContent,
        SalesRepresentative,
        SiteSettings,
        TeamMember,
    )
    from backend.models.legal import LegalDocument, WarrantyInformation
    
    try:
        exporter = get_exporter()
        
        # Database session is required (passed from calling service)
        
        # Map content type to model and query
        async def fetch_and_export():
            if content_type == 'siteSettings':
                result = await db.execute(select(SiteSettings).limit(1))
                settings = result.scalar_one_or_none()
                data = {
                    # Company Branding
                    'companyName': settings.company_name if settings else 'Eagle Chair',
                    'companyTagline': settings.company_tagline if settings else None,
                    'logoUrl': settings.logo_url if settings else None,
                    'logoDarkUrl': settings.logo_dark_url if settings else None,
                    'faviconUrl': settings.favicon_url if settings else None,
                    # Primary Contact Info
                    'primaryEmail': settings.primary_email if settings else None,
                    'primaryPhone': settings.primary_phone if settings else None,
                    'salesEmail': settings.sales_email if settings else None,
                    'salesPhone': settings.sales_phone if settings else None,
                    'supportEmail': settings.support_email if settings else None,
                    'supportPhone': settings.support_phone if settings else None,
                    # Primary Address
                    'addressLine1': settings.address_line1 if settings else None,
                    'addressLine2': settings.address_line2 if settings else None,
                    'city': settings.city if settings else None,
                    'state': settings.state if settings else None,
                    'zipCode': settings.zip_code if settings else None,
                    'country': settings.country if settings else 'USA',
                    # Business Hours
                    'businessHoursWeekdays': settings.business_hours_weekdays if settings else None,
                    'businessHoursSaturday': settings.business_hours_saturday if settings else None,
                    'businessHoursSunday': settings.business_hours_sunday if settings else None,
                    # Social Media
                    'facebookUrl': settings.facebook_url if settings else None,
                    'instagramUrl': settings.instagram_url if settings else None,
                    'linkedinUrl': settings.linkedin_url if settings else None,
                    'twitterUrl': settings.twitter_url if settings else None,
                    'youtubeUrl': settings.youtube_url if settings else None,
                    # SEO & Meta
                    'metaTitle': settings.meta_title if settings else None,
                    'metaDescription': settings.meta_description if settings else None,
                    'metaKeywords': settings.meta_keywords if settings else None,
                    # Theme & Additional
                    'themeColors': settings.theme_colors if settings else None,
                    'additionalSettings': settings.additional_settings if settings else None
                } if settings else {}
                return exporter.export_site_settings(data)
                
            elif content_type == 'heroSlides':
                result = await db.execute(
                    select(HeroSlide)
                    .where(HeroSlide.is_active == True)
                    .order_by(HeroSlide.display_order, HeroSlide.id)
                )
                slides = result.scalars().all()
                data = [
                    {
                        'id': s.id,
                        'title': s.title,
                        'subtitle': s.subtitle,
                        'image': s.background_image_url,
                        'ctaText': s.cta_text,
                        'ctaLink': s.cta_link,
                        'displayOrder': s.display_order
                    }
                    for s in slides
                ]
                return exporter.export_hero_slides(data)
                
            elif content_type == 'salesReps':
                result = await db.execute(
                    select(SalesRepresentative)
                    .where(SalesRepresentative.is_active == True)
                    .order_by(SalesRepresentative.territory_name)
                )
                reps = result.scalars().all()
                data = [
                    {
                        'id': r.id,
                        'name': r.name,
                        'territory': r.territory_name,
                        'states': r.states_covered,
                        'email': r.email,
                        'phone': r.phone,
                        'photoUrl': r.photo_url
                    }
                    for r in reps
                ]
                return exporter.export_sales_reps(data)
                
            elif content_type == 'galleryImages':
                result = await db.execute(
                    select(Installation)
                    .where(Installation.is_active == True)
                    .order_by(Installation.display_order.desc())
                )
                installations = result.scalars().all()
                data = [
                    {
                        'id': i.id,
                        'title': i.project_name,
                        'category': i.project_type,
                        'url': i.primary_image,
                        'images': i.images,
                        'description': i.description,
                        'location': i.location,
                        'clientName': i.client_name
                    }
                    for i in installations
                ]
                return exporter.export_gallery_images(data)
                
            elif content_type == 'features':
                result = await db.execute(
                    select(Feature)
                    .where(Feature.is_active == True)
                    .order_by(Feature.display_order)
                )
                features = result.scalars().all()
                data = [
                    {
                        'id': f.id,
                        'title': f.title,
                        'description': f.description,
                        'icon': f.icon
                    }
                    for f in features
                ]
                return exporter.export_features(data)
                
            elif content_type == 'companyValues':
                result = await db.execute(
                    select(CompanyValue)
                    .where(CompanyValue.is_active == True)
                    .order_by(CompanyValue.display_order)
                )
                values = result.scalars().all()
                data = [
                    {
                        'id': v.id,
                        'title': v.title,
                        'description': v.description,
                        'icon': v.icon
                    }
                    for v in values
                ]
                return exporter.export_company_values(data)
                
            elif content_type == 'companyMilestones':
                result = await db.execute(
                    select(CompanyMilestone)
                    .where(CompanyMilestone.is_active == True)
                    .order_by(CompanyMilestone.year)
                )
                milestones = result.scalars().all()
                data = [
                    {
                        'id': m.id,
                        'year': m.year,
                        'title': m.title,
                        'description': m.description
                    }
                    for m in milestones
                ]
                return exporter.export_company_milestones(data)
                
            elif content_type == 'teamMembers':
                result = await db.execute(
                    select(TeamMember)
                    .where(TeamMember.is_active == True)
                    .order_by(TeamMember.display_order)
                )
                members = result.scalars().all()
                data = [
                    {
                        'id': m.id,
                        'name': m.name,
                        'title': m.title,
                        'bio': m.bio,
                        'email': m.email,
                        'phone': m.phone,
                        'image': m.photo_url,
                        'linkedinUrl': m.linkedin_url
                    }
                    for m in members
                ]
                return exporter.export_team_members(data)
                
            elif content_type == 'clientLogos':
                result = await db.execute(
                    select(ClientLogo)
                    .where(ClientLogo.is_active == True)
                    .order_by(ClientLogo.display_order)
                )
                logos = result.scalars().all()
                data = [
                    {
                        'id': l.id,
                        'name': l.name,
                        'logoUrl': l.logo_url,
                        'websiteUrl': l.website_url
                    }
                    for l in logos
                ]
                return exporter.export_client_logos(data)
                
            elif content_type == 'pageContent':
                result = await db.execute(
                    select(PageContent)
                    .where(PageContent.is_active == True)
                    .order_by(PageContent.page_slug, PageContent.display_order)
                )
                pages = result.scalars().all()
                data = [
                    {
                        'id': p.id,
                        'pageSlug': p.page_slug,
                        'sectionKey': p.section_key,
                        'title': p.title,
                        'content': p.content,
                        'imageUrl': p.image_url
                    }
                    for p in pages
                ]
                return exporter.export_page_content(data)
                
            elif content_type == 'legalDocuments':
                result = await db.execute(
                    select(LegalDocument)
                    .where(LegalDocument.is_active == True)
                    .order_by(LegalDocument.display_order)
                )
                docs = result.scalars().all()
                data = [
                    {
                        'id': d.id,
                        'documentType': d.document_type.value,
                        'title': d.title,
                        'content': d.content,
                        'slug': d.slug,
                        'version': d.version,
                        'effectiveDate': d.effective_date,
                        'shortDescription': d.short_description,
                        'isActive': d.is_active,
                        'displayOrder': d.display_order
                    }
                    for d in docs
                ]
                return exporter.export_legal_documents(data)
                
            elif content_type == 'faqs':
                result = await db.execute(
                    select(FAQ)
                    .where(FAQ.is_active == True)
                    .order_by(FAQ.category_id, FAQ.display_order)
                )
                faqs = result.scalars().all()
                data = [
                    {
                        'id': f.id,
                        'categoryId': f.category_id,
                        'question': f.question,
                        'answer': f.answer
                    }
                    for f in faqs
                ]
                return exporter.export_faqs(data)
                
            elif content_type == 'faqCategories':
                result = await db.execute(
                    select(FAQCategory)
                    .where(FAQCategory.is_active == True)
                    .order_by(FAQCategory.display_order)
                )
                categories = result.scalars().all()
                data = [
                    {
                        'id': c.id,
                        'name': c.name,
                        'description': c.description
                    }
                    for c in categories
                ]
                return exporter.export_faq_categories(data)
                
            elif content_type == 'catalogs':
                result = await db.execute(
                    select(Catalog)
                    .where(Catalog.is_active == True)
                    .order_by(Catalog.display_order)
                )
                catalogs = result.scalars().all()
                data = [
                    {
                        'id': c.id,
                        'title': c.title,
                        'description': c.description,
                        'fileUrl': c.file_url,
                        'coverImageUrl': c.cover_image_url
                    }
                    for c in catalogs
                ]
                return exporter.export_catalogs(data)
                
            elif content_type == 'finishes':
                result = await db.execute(
                    select(Finish)
                    .where(Finish.is_active == True)
                    .order_by(Finish.name)
                )
                finishes = result.scalars().all()
                data = [
                    {
                        'id': f.id,
                        'name': f.name,
                        'finishCode': f.finish_code,
                        'description': f.description,
                        'finishType': f.finish_type,
                        'colorHex': f.color_hex,
                        'imageUrl': f.image_url,
                        'isCustom': f.is_custom,
                        'isToMatch': f.is_to_match,
                        'additionalCost': f.additional_cost
                    }
                    for f in finishes
                ]
                return exporter.export_finishes(data)
                
            elif content_type == 'upholsteries':
                result = await db.execute(
                    select(Upholstery)
                    .where(Upholstery.is_active == True)
                    .order_by(Upholstery.name)
                )
                upholsteries = result.scalars().all()
                data = [
                    {
                        'id': u.id,
                        'name': u.name,
                        'materialType': u.material_type,
                        'description': u.description,
                        'imageUrl': u.image_url,
                        'swatchImageUrl': u.swatch_image_url,
                        'grade': u.grade,
                        'color': u.color,
                        'colorHex': u.color_hex
                    }
                    for u in upholsteries
                ]
                return exporter.export_upholsteries(data)
                
            elif content_type == 'hardware':
                result = await db.execute(
                    select(Hardware)
                    .where(Hardware.is_active == True)
                    .order_by(Hardware.name)
                )
                hardware_items = result.scalars().all()
                data = [
                    {
                        'id': h.id,
                        'name': h.name,
                        'description': h.description,
                        'imageUrl': h.image_url,
                        'category': h.category
                    }
                    for h in hardware_items
                ]
                return exporter.export_hardware(data)
                
            elif content_type == 'laminates':
                result = await db.execute(
                    select(Laminate)
                    .where(Laminate.is_active == True)
                    .order_by(Laminate.brand, Laminate.pattern_name)
                )
                laminates = result.scalars().all()
                data = [
                    {
                        'id': lam.id,
                        'patternName': lam.pattern_name,
                        'brand': lam.brand,
                        'description': lam.description,
                        'swatchImageUrl': lam.swatch_image_url,
                        'fullImageUrl': lam.full_image_url,
                        'colorFamily': lam.color_family,
                        'finishType': lam.finish_type
                    }
                    for lam in laminates
                ]
                return exporter.export_laminates(data)
                
            elif content_type == 'warranties':
                result = await db.execute(
                    select(WarrantyInformation)
                    .where(WarrantyInformation.is_active == True)
                    .order_by(WarrantyInformation.display_order)
                )
                warranties = result.scalars().all()
                data = [
                    {
                        'id': w.id,
                        'warrantyType': w.warranty_type,
                        'title': w.title,
                        'description': w.description,
                        'duration': w.duration,
                        'coverage': w.coverage
                    }
                    for w in warranties
                ]
                return exporter.export_warranty_information(data)
                
            else:
                logger.warning(f"Unknown content type: {content_type}")
                return False
        
        return await fetch_and_export()
            
    except Exception as e:
        logger.error(f"Export failed for {content_type}: {e}", exc_info=True)
        return False
