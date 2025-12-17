"""
SEO Routes

Provides SEO-related endpoints for dynamic meta tags and sitemap generation
"""

from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database.base import get_db
from backend.models.chair import Chair, Category, ProductFamily

router = APIRouter(prefix="/seo", tags=["SEO"])


@router.get("/sitemap.xml", response_class=Response)
async def get_sitemap(db: AsyncSession = Depends(get_db)):
    """
    Generate dynamic sitemap.xml including all products, families, and categories
    """
    try:
        # Get all active products
        products_result = await db.execute(
            select(Chair)
            .where(Chair.is_active == True)
            .order_by(Chair.updated_at.desc())
        )
        products = products_result.scalars().all()
        
        # Get all active categories
        categories_result = await db.execute(
            select(Category)
            .where(Category.is_active == True)
        )
        categories = categories_result.scalars().all()
        
        # Get all active product families
        families_result = await db.execute(
            select(ProductFamily)
            .where(ProductFamily.is_active == True)
        )
        families = families_result.scalars().all()
        
        # Base URL
        base_url = "https://www.eaglechair.com"
        current_date = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Start building XML
        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
            '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
            '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
            '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
            '',
            '  <!-- Static Pages -->',
            f'  <url><loc>{base_url}/</loc><lastmod>{current_date}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>',
            f'  <url><loc>{base_url}/products</loc><lastmod>{current_date}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>',
            f'  <url><loc>{base_url}/about</loc><lastmod>{current_date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>',
            f'  <url><loc>{base_url}/gallery</loc><lastmod>{current_date}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>',
            f'  <url><loc>{base_url}/find-a-rep</loc><lastmod>{current_date}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>',
            f'  <url><loc>{base_url}/contact</loc><lastmod>{current_date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>',
            '',
            '  <!-- Categories -->',
        ]
        
        # Add categories
        for category in categories:
            if category.slug:
                lastmod = category.updated_at.strftime("%Y-%m-%d") if category.updated_at else current_date
                xml_lines.append(
                    f'  <url><loc>{base_url}/products/category/{category.slug}</loc>'
                    f'<lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>'
                )
        
        xml_lines.append('')
        xml_lines.append('  <!-- Product Families -->')
        
        # Add product families
        for family in families:
            if family.slug:
                lastmod = family.updated_at.strftime("%Y-%m-%d") if family.updated_at else current_date
                xml_lines.append(
                    f'  <url><loc>{base_url}/families/{family.slug}</loc>'
                    f'<lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>'
                )
        
        xml_lines.append('')
        xml_lines.append('  <!-- Products -->')
        
        # Add products
        for product in products:
            # Build product URL - prefer category path if available
            if product.category and product.category.slug:
                category_slug = product.category.slug
                subcategory_slug = product.subcategory.slug if product.subcategory and product.subcategory.slug else None
                product_slug = product.slug or str(product.id)
                
                if subcategory_slug:
                    url = f"{base_url}/products/{category_slug}/{subcategory_slug}/{product_slug}"
                else:
                    url = f"{base_url}/products/{category_slug}/{product_slug}"
            else:
                # Fallback to ID-based URL
                url = f"{base_url}/products/{product.id}"
            
            lastmod = product.updated_at.strftime("%Y-%m-%d") if product.updated_at else current_date
            priority = "0.9" if product.is_featured else "0.7"
            
            xml_lines.append(
                f'  <url><loc>{url}</loc>'
                f'<lastmod>{lastmod}</lastmod><changefreq>weekly</changefreq><priority>{priority}</priority></url>'
            )
        
        xml_lines.append('')
        xml_lines.append('</urlset>')
        
        xml_content = '\n'.join(xml_lines)
        
        return Response(
            content=xml_content,
            media_type="application/xml",
            headers={
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating sitemap: {str(e)}")


@router.get("/product/{product_id_or_slug}")
async def get_product_seo(
    product_id_or_slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get SEO metadata for a specific product
    """
    try:
        # Try to find by ID first, then by slug
        try:
            product_id = int(product_id_or_slug)
            result = await db.execute(
                select(Chair).where(Chair.id == product_id, Chair.is_active == True)
            )
        except ValueError:
            result = await db.execute(
                select(Chair).where(Chair.slug == product_id_or_slug, Chair.is_active == True)
            )
        
        product = result.scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Build product URL
        if product.category and product.category.slug:
            category_slug = product.category.slug
            subcategory_slug = product.subcategory.slug if product.subcategory and product.subcategory.slug else None
            product_slug = product.slug or str(product.id)
            
            if subcategory_slug:
                url = f"/products/{category_slug}/{subcategory_slug}/{product_slug}"
            else:
                url = f"/products/{category_slug}/{product_slug}"
        else:
            url = f"/products/{product.id}"
        
        # Get primary image
        images = product.images if isinstance(product.images, list) else []
        primary_image = images[0] if images else product.primary_image_url
        
        return {
            "title": product.meta_title or f"{product.name} | Eagle Chair",
            "description": product.meta_description or (product.description[:160] if product.description else f"Shop {product.name} from Eagle Chair. Premium commercial seating solutions."),
            "image": primary_image or "/og-image.jpg",
            "url": url,
            "type": "product",
            "keywords": product.meta_keywords or f"{product.name}, commercial seating, restaurant chairs, Eagle Chair"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching product SEO: {str(e)}")


@router.get("/family/{family_slug}")
async def get_family_seo(
    family_slug: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get SEO metadata for a specific product family
    """
    try:
        result = await db.execute(
            select(ProductFamily).where(ProductFamily.slug == family_slug, ProductFamily.is_active == True)
        )
        family = result.scalar_one_or_none()
        
        if not family:
            raise HTTPException(status_code=404, detail="Family not found")
        
        url = f"/families/{family_slug}"
        family_image = family.banner_image_url or family.family_image or "/og-image.jpg"
        
        return {
            "title": family.meta_title or f"{family.name} Product Family | Eagle Chair",
            "description": family.meta_description or (family.description[:160] if family.description else f"Explore the {family.name} product family from Eagle Chair."),
            "image": family_image,
            "url": url,
            "type": "website",
            "keywords": f"{family.name}, product family, commercial seating, Eagle Chair"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching family SEO: {str(e)}")

