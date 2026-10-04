"""
Default Content Service

Provides real, production-ready default content for Eagle Chair
This content is used when the database is empty (first deployment)
"""

from typing import Dict, List, Any
from datetime import datetime


class DefaultContentService:
    """Service for providing default content"""
    
    @staticmethod
    def get_site_settings() -> Dict[str, Any]:
        """Get default site settings"""
        return {
            "companyName": "Eagle Chair",
            "companyTagline": "Premium Commercial Furniture Since 1984",
            "logoUrl": "/assets/eagle-chair-logo.png",
            "logoDarkUrl": "/assets/eagle-chair-logo-white.png",
            "faviconUrl": "/assets/favicon.ico",
            "primaryEmail": "info@eaglechair.com",
            "primaryPhone": "(713) 690-1161",
            "salesEmail": "sales@eaglechair.com",
            "salesPhone": "(713) 690-1161",
            "supportEmail": "support@eaglechair.com",
            "supportPhone": "(713) 690-1161",
            "addressLine1": "4816 Campbell Rd",
            "addressLine2": None,
            "city": "Houston",
            "state": "TX",
            "zipCode": "77041",
            "country": "USA",
            "businessHoursWeekdays": "Monday - Friday: 8:00 AM - 4:00 PM CST",
            "businessHoursSaturday": "Saturday: By Appointment Only",
            "businessHoursSunday": "Sunday: Closed",
            "facebookUrl": "https://facebook.com/eaglechair",
            "instagramUrl": "https://instagram.com/eaglechair",
            "linkedinUrl": "https://linkedin.com/company/eaglechair",
            "twitterUrl": None,
            "youtubeUrl": None,
            "metaTitle": "Eagle Chair - Premium Commercial Furniture Manufacturer",
            "metaDescription": "Family-owned commercial furniture manufacturer since 1984. Quality chairs, tables, and booths for restaurants, hotels, and hospitality businesses.",
            "metaKeywords": "commercial furniture, restaurant chairs, hotel furniture, hospitality seating"
        }
    
    @staticmethod
    def get_hero_slides() -> List[Dict[str, Any]]:
        """Get default hero slides"""
        # No invented fallback content: an empty table shows nothing.
        return []

    @staticmethod
    def get_features(feature_type: str = "general") -> List[Dict[str, Any]]:
        """Get default features"""
        # No invented fallback content: an empty table shows nothing.
        return []

    @staticmethod
    def get_company_values() -> List[Dict[str, Any]]:
        """Get default company values"""
        return [
            {
                "id": 1,
                "title": "Quality First",
                "description": "We never compromise on materials or craftsmanship. Every piece is built to last.",
                "icon": "star",
                "displayOrder": 1
            },
            {
                "id": 2,
                "title": "Customer Partnership",
                "description": "We build lasting relationships with our clients, supporting them every step of the way.",
                "icon": "handshake",
                "displayOrder": 2
            },
            {
                "id": 3,
                "title": "American Made",
                "description": "Proudly manufacturing in the USA, supporting local communities and jobs.",
                "icon": "flag",
                "displayOrder": 3
            },
            {
                "id": 4,
                "title": "Sustainability",
                "description": "Committed to environmentally responsible practices and materials.",
                "icon": "leaf",
                "displayOrder": 4
            }
        ]
    
    @staticmethod
    def get_company_milestones() -> List[Dict[str, Any]]:
        """Get default company milestones"""
        # No invented fallback content: an empty table shows nothing.
        return []

    @staticmethod
    def get_team_members() -> List[Dict[str, Any]]:
        """Get default team members"""
        # No invented fallback content: an empty table shows nothing.
        return []

    @staticmethod
    def get_page_content(page_slug: str, section_key: str = None) -> Dict[str, Any]:
        """Get default page content"""
        content = {
            "home": {
                "about": {
                    "id": 1,
                    "pageSlug": "home",
                    "sectionKey": "about",
                    "title": "About Eagle Chair",
                    "subtitle": "Our commitment to excellence, American craftsmanship, and customer satisfaction sets us apart.",
                    "content": "Eagle Chair is a family-owned and operated commercial furniture manufacturer based in Houston, Texas. Since 1984, we've been dedicated to crafting high-quality, durable furniture solutions for restaurants, hotels, and hospitality businesses across the nation. We understand the unique demands of commercial environments and design our products to withstand the test of time, combining timeless aesthetics with robust construction.",
                    "imageUrl": None,
                    "displayOrder": 1
                },
                "installation_gallery": {
                    "id": 2,
                    "pageSlug": "home",
                    "sectionKey": "installation_gallery",
                    "title": "Installation Gallery",
                    "subtitle": "See Eagle Chair in stunning real-world settings",
                    "content": "See Eagle Chair in stunning real-world settings",
                    "displayOrder": 3
                }
            }
        }
        
        if section_key:
            return content.get(page_slug, {}).get(section_key)
        return content.get(page_slug, {})


# Singleton instance
default_content = DefaultContentService()

