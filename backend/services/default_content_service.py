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
            "logoDarkUrl": "/assets/eagle-chair-logo-dark.png",
            "faviconUrl": "/assets/favicon.ico",
            "primaryEmail": "info@eaglechair.com",
            "primaryPhone": "(713) 555-0100",
            "salesEmail": "sales@eaglechair.com",
            "salesPhone": "(713) 555-0101",
            "supportEmail": "support@eaglechair.com",
            "supportPhone": "(713) 555-0102",
            "addressLine1": "123 Furniture Boulevard",
            "addressLine2": "Suite 100",
            "city": "Houston",
            "state": "TX",
            "zipCode": "77001",
            "country": "USA",
            "businessHoursWeekdays": "Monday - Friday: 8:00 AM - 5:00 PM CST",
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
        return [
            {
                "id": 1,
                "title": "Have a Seat",
                "subtitle": "Premium Commercial Furniture for Restaurants & Hospitality",
                "backgroundImageUrl": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920",
                "ctaText": "Explore Products",
                "ctaLink": "/products",
                "ctaStyle": "primary",
                "displayOrder": 1,
                "isActive": True
            },
            {
                "id": 2,
                "title": "Crafted with Excellence",
                "subtitle": "Family-Owned. American-Made. Built to Last.",
                "backgroundImageUrl": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1920",
                "ctaText": "Our Story",
                "ctaLink": "/about",
                "ctaStyle": "primary",
                "displayOrder": 2,
                "isActive": True
            },
            {
                "id": 3,
                "title": "Indoor & Outdoor Solutions",
                "subtitle": "Complete furniture solutions for every commercial space",
                "backgroundImageUrl": "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=1920",
                "ctaText": "View Gallery",
                "ctaLink": "/gallery",
                "ctaStyle": "primary",
                "displayOrder": 3,
                "isActive": True
            }
        ]
    
    @staticmethod
    def get_features(feature_type: str = "general") -> List[Dict[str, Any]]:
        """Get default features"""
        features = {
            "home_page": [
                {
                    "id": 1,
                    "title": "American Made",
                    "description": "All our furniture is manufactured in the USA with premium materials and superior craftsmanship.",
                    "icon": "flag",
                    "featureType": "home_page",
                    "displayOrder": 1
                },
                {
                    "id": 2,
                    "title": "Commercial Grade",
                    "description": "Built to withstand heavy daily use in the most demanding commercial environments.",
                    "icon": "shield",
                    "featureType": "home_page",
                    "displayOrder": 2
                },
                {
                    "id": 3,
                    "title": "Custom Options",
                    "description": "Extensive customization options including finishes, fabrics, and sizes to match your vision.",
                    "icon": "palette",
                    "featureType": "home_page",
                    "displayOrder": 3
                },
                {
                    "id": 4,
                    "title": "Quick Turnaround",
                    "description": "Fast production and shipping to get your furniture delivered when you need it.",
                    "icon": "clock",
                    "featureType": "home_page",
                    "displayOrder": 4
                },
                {
                    "id": 5,
                    "title": "Warranty Backed",
                    "description": "Comprehensive warranty coverage because we stand behind the quality of our products.",
                    "icon": "check-circle",
                    "featureType": "home_page",
                    "displayOrder": 5
                },
                {
                    "id": 6,
                    "title": "Expert Support",
                    "description": "Dedicated sales representatives to help you choose the perfect furniture for your space.",
                    "icon": "users",
                    "featureType": "home_page",
                    "displayOrder": 6
                }
            ]
        }
        return features.get(feature_type, features["home_page"])
    
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
        return [
            {
                "id": 1,
                "year": "1984",
                "title": "Company Founded",
                "description": "Eagle Chair was established in Houston, Texas by the Yuglich Family",
                "displayOrder": 1
            },
            {
                "id": 2,
                "year": "1995",
                "title": "Expansion",
                "description": "Opened new manufacturing facility and doubled production capacity",
                "displayOrder": 2
            },
            {
                "id": 3,
                "year": "2005",
                "title": "National Distribution",
                "description": "Expanded distribution network to serve clients nationwide",
                "displayOrder": 3
            },
            {
                "id": 4,
                "year": "2024",
                "title": "Continued Excellence",
                "description": "Continuing the Yuglich Family legacy of quality craftsmanship and innovation",
                "displayOrder": 4
            }
        ]
    
    @staticmethod
    def get_team_members() -> List[Dict[str, Any]]:
        """Get default team members"""
        return [
            {
                "id": 1,
                "name": "Katarina Kac-Statton",
                "title": "Co-Owner & Operations Director",
                "bio": "Leading Eagle Chair's operations with a focus on quality and customer satisfaction.",
                "photoUrl": "/team/katarina.jpg",
                "displayOrder": 1,
                "isFeatured": True
            },
            {
                "id": 2,
                "name": "Maximilian Kac",
                "title": "Co-Owner & Sales Director",
                "bio": "Overseeing sales and client relationships, ensuring every customer receives exceptional service.",
                "photoUrl": "/team/maximilian.jpg",
                "displayOrder": 2,
                "isFeatured": True
            }
        ]
    
    @staticmethod
    def get_page_content(page_slug: str, section_key: str = None) -> Dict[str, Any]:
        """Get default page content"""
        content = {
            "home": {
                "about": {
                    "pageSlug": "home",
                    "sectionKey": "about",
                    "title": "About Eagle Chair",
                    "subtitle": "Our commitment to excellence, American craftsmanship, and customer satisfaction sets us apart.",
                    "content": "Eagle Chair is a family-owned and operated commercial furniture manufacturer based in Houston, Texas. Since 1984, we've been dedicated to crafting high-quality, durable furniture solutions for restaurants, hotels, and hospitality businesses across the nation. We understand the unique demands of commercial environments and design our products to withstand the test of time, combining timeless aesthetics with robust construction.",
                    "imageUrl": "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
                    "displayOrder": 1
                }
            }
        }
        
        if section_key:
            return content.get(page_slug, {}).get(section_key)
        return content.get(page_slug, {})


# Singleton instance
default_content = DefaultContentService()

