"""
Test Factories

Helper functions for creating test data with async SQLAlchemy
Comprehensive factories for all models
"""

from faker import Faker

from backend.core.security import SecurityManager
from backend.models.chair import (
    Category,
    Chair,
    Color,
    CustomOption,
    Finish,
    ProductFamily,
    ProductImage,
    ProductRelation,
    ProductSubcategory,
    ProductTag,
    ProductTagAssociation,
    ProductVariation,
    Upholstery,
)
from backend.models.company import (
    AdminAuditLog,
    AdminRole,
    AdminUser,
    Company,
    CompanyPricing,
    CompanyStatus,
)
from backend.models.content import (
    FAQ,
    Catalog,
    CatalogType,
    ClientLogo,
    CompanyInfo,
    CompanyMilestone,
    CompanyValue,
    ContactLocation,
    EmailTemplate,
    FAQCategory,
    Feature,
    Feedback,
    Hardware,
    HeroSlide,
    Installation,
    Laminate,
    PageContent,
    SalesRepresentative,
    SiteSettings,
    TeamMember,
)
from backend.models.legal import (
    LegalDocument,
    LegalDocumentType,
    ShippingPolicy,
    WarrantyInformation,
)
from backend.models.quote import (
    Cart,
    CartItem,
    Quote,
    QuoteAttachment,
    QuoteHistory,
    QuoteItem,
    QuoteStatus,
    SavedConfiguration,
)

fake = Faker()


# ============================================================================
# Company & Admin Factories
# ============================================================================

def _company_shipping_keys():
    return {"shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state", "shipping_zip", "shipping_country"}


async def create_company(db_session, **kwargs):
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "company_name": fake.company(),
        "legal_name": f"{fake.company()} LLC",
        "tax_id": fake.bothify(text="##-#######"),
        "industry": fake.job(),
        "website": fake.url(),
        "rep_first_name": fake.first_name(),
        "rep_last_name": fake.last_name(),
        "rep_title": fake.job(),
        "rep_email": f"test-{unique_id}@{fake.domain_name()}",
        "rep_phone": fake.phone_number(),
        "billing_address_line1": fake.street_address(),
        "billing_address_line2": fake.secondary_address(),
        "billing_city": fake.city(),
        "billing_state": fake.state_abbr(),
        "billing_zip": fake.zipcode(),
        "billing_country": "USA",
        "hashed_password": SecurityManager().hash_password("TestPassword123!"),
        "status": CompanyStatus.PENDING,
        "is_active": True,
    }
    shipping = {k: kwargs.pop(k, None) for k in _company_shipping_keys() if k in kwargs}
    defaults.update(kwargs)
    company = Company(**defaults)
    db_session.add(company)
    await db_session.flush()
    if shipping.get("shipping_address_line1") or shipping.get("shipping_city"):
        from backend.models.company import CompanyShippingAddress
        addr = CompanyShippingAddress(
            company_id=company.id,
            line1=shipping.get("shipping_address_line1") or company.billing_address_line1,
            line2=shipping.get("shipping_address_line2"),
            city=shipping.get("shipping_city") or company.billing_city,
            state=shipping.get("shipping_state") or company.billing_state,
            zip=shipping.get("shipping_zip") or company.billing_zip,
            country=shipping.get("shipping_country") or "USA",
        )
        db_session.add(addr)
    await db_session.commit()
    await db_session.refresh(company)
    return company


async def create_admin(db_session, **kwargs):
    """Create an AdminUser instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "username": f"admin-{unique_id}",
        "email": f"admin-{unique_id}@{fake.domain_name()}",
        "hashed_password": SecurityManager().hash_password("TestPassword123!"),
        "first_name": fake.first_name(),
        "last_name": fake.last_name(),
        "role": AdminRole.ADMIN,
        "is_active": True,
    }
    defaults.update(kwargs)
    admin = AdminUser(**defaults)
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


async def create_company_pricing(db_session, company_id=None, **kwargs):
    """Create a CompanyPricing instance."""
    defaults = {
        "pricing_tier_name": fake.random_element(["Standard", "Gold", "Silver", "Wholesale"]),
        "percentage_adjustment": fake.random_int(min=-20, max=20),
        "applies_to_all_products": True,
        "is_active": True,
    }
    if company_id:
        defaults["company_id"] = company_id
    defaults.update(kwargs)
    pricing = CompanyPricing(**defaults)
    db_session.add(pricing)
    await db_session.commit()
    await db_session.refresh(pricing)
    return pricing


async def create_admin_audit_log(db_session, admin_id, **kwargs):
    """Create an AdminAuditLog instance."""
    defaults = {
        "admin_id": admin_id,
        "action": fake.random_element(["CREATE", "UPDATE", "DELETE", "VIEW"]),
        "resource_type": fake.random_element(["product", "quote", "company", "faq"]),
        "resource_id": fake.random_int(min=1, max=1000),
        "ip_address": fake.ipv4(),
        "timestamp": fake.iso8601(),
    }
    defaults.update(kwargs)
    log = AdminAuditLog(**defaults)
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)
    return log


# ============================================================================
# Product Factories
# ============================================================================

async def create_category(db_session, parent_id=None, **kwargs):
    """Create a Category instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "name": fake.random_element([
        "Executive Chairs", "Office Chairs", "Conference Chairs", 
        "Reception Chairs", "Dining Chairs", "Bar Stools"
        ]),
        "description": fake.text(max_nb_chars=200),
        "slug": f"{fake.slug()}-{unique_id}",  # Ensure uniqueness
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    if parent_id:
        defaults["parent_id"] = parent_id
    defaults.update(kwargs)
    category = Category(**defaults)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


async def create_product_subcategory(db_session, category_id=None, **kwargs):
    """Create a ProductSubcategory instance."""
    if category_id is None:
        category = await create_category(db_session)
        category_id = category.id
    
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "name": fake.word().title() + " Chairs",
        "description": fake.text(max_nb_chars=200),
        "slug": f"{fake.slug()}-{unique_id}",
        "category_id": category_id,
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    defaults.update(kwargs)
    subcategory = ProductSubcategory(**defaults)
    db_session.add(subcategory)
    await db_session.commit()
    await db_session.refresh(subcategory)
    return subcategory


async def create_product_family(db_session, category_id=None, subcategory_id=None, **kwargs):
    """Create a ProductFamily instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "name": fake.word().title() + " Series",
        "description": fake.text(max_nb_chars=200),
        "slug": f"{fake.slug()}-{unique_id}",
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    if category_id:
        defaults["category_id"] = category_id
    if subcategory_id:
        defaults["subcategory_id"] = subcategory_id
    defaults.update(kwargs)
    family = ProductFamily(**defaults)
    db_session.add(family)
    await db_session.commit()
    await db_session.refresh(family)
    return family


async def create_color(db_session, **kwargs):
    """Create a Color instance."""
    defaults = {
        "name": fake.random_element(["Black", "Brown", "Gray", "White", "Red", "Blue"]),
        "color_code": fake.bothify(text="COL-####"),
        "hex_value": fake.hex_color(),
        "category": fake.random_element(["wood", "metal", "fabric", "paint"]),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    defaults.update(kwargs)
    color = Color(**defaults)
    db_session.add(color)
    await db_session.commit()
    await db_session.refresh(color)
    return color


async def create_finish(db_session, color_id=None, **kwargs):
    """Create a Finish instance."""
    defaults = {
        "name": fake.random_element(["Oak", "Walnut", "Cherry", "Maple", "Mahogany", "Pine"]),
        "description": fake.text(max_nb_chars=100),
        "finish_code": fake.bothify(text="FIN-####"),
        "finish_type": fake.random_element(["Wood Stain", "Paint", "Metal", "Powder Coat"]),
        "color_hex": fake.hex_color(),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    if color_id:
        defaults["color_id"] = color_id
    defaults.update(kwargs)
    finish = Finish(**defaults)
    db_session.add(finish)
    await db_session.commit()
    await db_session.refresh(finish)
    return finish


async def create_upholstery(db_session, color_id=None, **kwargs):
    """Create an Upholstery instance."""
    defaults = {
        "name": fake.random_element(["Leather", "Fabric", "Vinyl", "Mesh", "Suede"]),
        "material_type": fake.random_element(["Leather", "Fabric", "Vinyl", "Mesh"]),
        "description": fake.text(max_nb_chars=100),
        "material_code": fake.bothify(text="MAT-####"),
        "grade": fake.random_element(["A", "B", "C", "Premium", "Luxury"]),
        "color_hex": fake.hex_color(),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    if color_id:
        defaults["color_id"] = color_id
    defaults.update(kwargs)
    upholstery = Upholstery(**defaults)
    db_session.add(upholstery)
    await db_session.commit()
    await db_session.refresh(upholstery)
    return upholstery


async def create_chair(db_session, category_id=None, subcategory_id=None, family_id=None, **kwargs):
    """Create a Chair instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    model_id = uuid.uuid4().hex[:6].upper()
    if category_id is None:
        category = await create_category(db_session)
        category_id = category.id
    
    defaults = {
        "name": fake.random_element([
        "Executive Chair", "Office Chair", "Conference Chair", 
        "Reception Chair", "Dining Chair", "Bar Stool"
        ]),
        "model_number": f"CHR-{model_id}",
        "slug": f"{fake.slug()}-{unique_id}",
        "short_description": fake.text(max_nb_chars=200),
        "full_description": fake.text(max_nb_chars=500),
        "base_price": fake.random_int(min=10000, max=100000),
        "minimum_order_quantity": fake.random_int(min=1, max=10),
        "category_id": category_id,
        "is_active": True,
        "is_featured": False,
        "is_new": False,
        "stock_status": "In Stock",
    }
    if subcategory_id:
        defaults["subcategory_id"] = subcategory_id
    if family_id:
        defaults["family_id"] = family_id
    defaults.update(kwargs)
    chair = Chair(**defaults)
    db_session.add(chair)
    await db_session.commit()
    await db_session.refresh(chair)
    return chair


async def create_product_variation(db_session, product_id, finish_id=None, upholstery_id=None, color_id=None, **kwargs):
    """Create a ProductVariation instance."""
    defaults = {
        "product_id": product_id,
        "sku": fake.bothify(text="SKU-########"),
        "price_adjustment": fake.random_int(min=-5000, max=5000),
        "stock_status": "Available",
        "is_available": True,
        "display_order": fake.random_int(min=1, max=10),
    }
    if finish_id:
        defaults["finish_id"] = finish_id
    if upholstery_id:
        defaults["upholstery_id"] = upholstery_id
    if color_id:
        defaults["color_id"] = color_id
    defaults.update(kwargs)
    variation = ProductVariation(**defaults)
    db_session.add(variation)
    await db_session.commit()
    await db_session.refresh(variation)
    return variation


async def create_product_image(db_session, product_id, variation_id=None, **kwargs):
    """Create a ProductImage instance."""
    defaults = {
        "product_id": product_id,
        "image_url": fake.image_url(),
        "image_type": fake.random_element(["primary", "hover", "gallery", "side", "front"]),
        "alt_text": fake.sentence(),
        "display_order": fake.random_int(min=1, max=20),
        "is_active": True,
    }
    if variation_id:
        defaults["variation_id"] = variation_id
    defaults.update(kwargs)
    image = ProductImage(**defaults)
    db_session.add(image)
    await db_session.commit()
    await db_session.refresh(image)
    return image


async def create_custom_option(db_session, **kwargs):
    """Create a CustomOption instance."""
    defaults = {
        "name": fake.random_element(["Back Handle", "Special Glides", "Custom Dimensions"]),
        "option_code": fake.bothify(text="OPT-####"),
        "description": fake.text(max_nb_chars=200),
        "option_type": fake.random_element(["back_handle", "special_glide", "custom_dimension"]),
        "price_adjustment": fake.random_int(min=1000, max=10000),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=50),
    }
    defaults.update(kwargs)
    option = CustomOption(**defaults)
    db_session.add(option)
    await db_session.commit()
    await db_session.refresh(option)
    return option


async def create_product_tag(db_session, **kwargs):
    """Create a ProductTag instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "tag_name": fake.random_element(["Stackable", "Ganging", "Swivel", "Commercial Grade", "Healthcare"]),
        "tag_type": fake.random_element(["feature", "material", "style", "use_case"]),
        "description": fake.text(max_nb_chars=200),
        "slug": f"{fake.slug()}-{unique_id}",
        "is_active": True,
    }
    defaults.update(kwargs)
    tag = ProductTag(**defaults)
    db_session.add(tag)
    await db_session.commit()
    await db_session.refresh(tag)
    return tag


async def create_product_tag_association(db_session, product_id, tag_id):
    """Create a ProductTagAssociation instance."""
    association = ProductTagAssociation(product_id=product_id, tag_id=tag_id)
    db_session.add(association)
    await db_session.commit()
    return association


async def create_product_relation(db_session, product_id, related_product_id, **kwargs):
    """Create a ProductRelation instance."""
    defaults = {
        "product_id": product_id,
        "related_product_id": related_product_id,
        "relation_type": fake.random_element(["related", "alternative", "accessory"]),
        "display_order": fake.random_int(min=1, max=10),
    }
    defaults.update(kwargs)
    relation = ProductRelation(**defaults)
    db_session.add(relation)
    await db_session.commit()
    await db_session.refresh(relation)
    return relation


# ============================================================================
# Quote & Cart Factories
# ============================================================================

async def create_quote(db_session, company_id=None, **kwargs):
    """Create a Quote instance."""
    defaults = {
        "quote_number": fake.bothify(text="Q-########"),
        "contact_name": fake.name(),
        "contact_email": fake.email(),
        "contact_phone": fake.phone_number(),
        "project_name": fake.catch_phrase(),
        "project_description": fake.text(max_nb_chars=500),
        "project_type": fake.random_element(["Restaurant", "Hotel", "Office", "Retail", "Healthcare"]),
        "estimated_quantity": fake.random_int(min=10, max=1000),
        "target_budget": fake.random_int(min=100000, max=1000000),
        "shipping_address_line1": fake.street_address(),
        "shipping_address_line2": fake.secondary_address(),
        "shipping_city": fake.city(),
        "shipping_state": fake.state_abbr(),
        "shipping_zip": fake.zipcode(),
        "shipping_country": "USA",
        "status": QuoteStatus.DRAFT,
        "subtotal": fake.random_int(min=100000, max=1000000),
        "tax_amount": fake.random_int(min=10000, max=100000),
        "shipping_cost": fake.random_int(min=5000, max=50000),
        "total_amount": fake.random_int(min=150000, max=1200000),
        "special_instructions": fake.text(max_nb_chars=300),
        "requires_com": fake.boolean(),
        "rush_order": fake.boolean(),
    }
    if company_id:
        defaults["company_id"] = company_id
    defaults.update(kwargs)
    quote = Quote(**defaults)
    db_session.add(quote)
    await db_session.commit()
    await db_session.refresh(quote)
    return quote


async def create_quote_item(db_session, quote_id, product_id=None, **kwargs):
    """Create a QuoteItem instance."""
    if product_id is None:
        product = await create_chair(db_session)
        product_id = product.id
        product_name = product.name
        product_model_number = product.model_number
    else:
        # Fetch product to get name and model_number
        from sqlalchemy import select
        result = await db_session.execute(select(Chair).where(Chair.id == product_id))
        product = result.scalar_one()
        product_name = product.name
        product_model_number = product.model_number
    
    defaults = {
        "quote_id": quote_id,
        "product_id": product_id,
        "product_model_number": product_model_number,
        "product_name": product_name,
        "quantity": fake.random_int(min=1, max=50),
        "unit_price": fake.random_int(min=10000, max=100000),
        "customization_cost": fake.random_int(min=0, max=10000),
        "line_total": 0,  # Will be calculated
    }
    defaults.update(kwargs)
    # Calculate line_total if not provided
    if "line_total" not in kwargs:
        defaults["line_total"] = defaults["quantity"] * (defaults["unit_price"] + defaults["customization_cost"])
    quote_item = QuoteItem(**defaults)
    db_session.add(quote_item)
    await db_session.commit()
    await db_session.refresh(quote_item)
    return quote_item


async def create_cart(db_session, company_id=None, **kwargs):
    """Create a Cart instance."""
    if company_id is None:
        company = await create_company(db_session)
        company_id = company.id
    
    defaults = {
        "company_id": company_id,
        "is_active": True,
        "subtotal": 0,
        "estimated_tax": 0,
        "estimated_shipping": 0,
        "estimated_total": 0,
    }
    defaults.update(kwargs)
    cart = Cart(**defaults)
    db_session.add(cart)
    await db_session.commit()
    await db_session.refresh(cart)
    return cart


async def create_cart_item(db_session, cart_id, product_id=None, **kwargs):
    """Create a CartItem instance."""
    if product_id is None:
        product = await create_chair(db_session)
        product_id = product.id
    
    defaults = {
        "cart_id": cart_id,
        "product_id": product_id,
        "quantity": fake.random_int(min=1, max=10),
        "unit_price": fake.random_int(min=10000, max=100000),
        "customization_cost": fake.random_int(min=0, max=10000),
        "line_total": 0,  # Will be calculated
    }
    defaults.update(kwargs)
    # Calculate line_total if not provided
    if "line_total" not in kwargs:
        defaults["line_total"] = defaults["quantity"] * (defaults["unit_price"] + defaults["customization_cost"])
    cart_item = CartItem(**defaults)
    db_session.add(cart_item)
    await db_session.commit()
    await db_session.refresh(cart_item)
    return cart_item


async def create_saved_configuration(db_session, company_id, product_id=None, **kwargs):
    """Create a SavedConfiguration instance."""
    if product_id is None:
        product = await create_chair(db_session)
        product_id = product.id
    
    defaults = {
        "company_id": company_id,
        "product_id": product_id,
        "configuration_name": fake.catch_phrase(),
        "description": fake.text(max_nb_chars=200),
        "configuration_data": {"finish_id": 1, "upholstery_id": 1},
        "estimated_price": fake.random_int(min=50000, max=500000),
        "is_favorite": fake.boolean(),
    }
    defaults.update(kwargs)
    config = SavedConfiguration(**defaults)
    db_session.add(config)
    await db_session.commit()
    await db_session.refresh(config)
    return config


async def create_quote_attachment(db_session, quote_id, **kwargs):
    """Create a QuoteAttachment instance."""
    defaults = {
        "quote_id": quote_id,
        "file_name": fake.file_name(extension="pdf"),
        "file_url": fake.url(),
        "file_type": "application/pdf",
        "file_size_bytes": fake.random_int(min=10000, max=10000000),
        "description": fake.text(max_nb_chars=200),
        "attachment_type": fake.random_element(["general", "reference_image", "floor_plan", "specification"]),
        "uploaded_by": fake.random_element(["company", "admin"]),
        "uploaded_at": fake.iso8601(),
    }
    defaults.update(kwargs)
    attachment = QuoteAttachment(**defaults)
    db_session.add(attachment)
    await db_session.commit()
    await db_session.refresh(attachment)
    return attachment


async def create_quote_history(db_session, quote_id, **kwargs):
    """Create a QuoteHistory instance."""
    defaults = {
        "quote_id": quote_id,
        "action": fake.random_element(["created", "updated", "status_changed", "item_added"]),
        "old_status": None,
        "new_status": QuoteStatus.SUBMITTED.value,
        "changed_by_type": fake.random_element(["company", "admin", "system"]),
        "changed_by_id": fake.random_int(min=1, max=100),
        "changed_by_name": fake.name(),
        "notes": fake.text(max_nb_chars=200),
        "ip_address": fake.ipv4(),
        "changed_at": fake.iso8601(),
    }
    defaults.update(kwargs)
    history = QuoteHistory(**defaults)
    db_session.add(history)
    await db_session.commit()
    await db_session.refresh(history)
    return history


# ============================================================================
# Content Factories
# ============================================================================

async def create_faq_category(db_session, parent_id=None, **kwargs):
    """Create an FAQCategory instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "name": fake.random_element(["General", "Products", "Shipping", "Warranty", "Returns"]),
        "slug": f"{fake.slug()}-{unique_id}",
        "description": fake.text(max_nb_chars=200),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
    }
    if parent_id:
        defaults["parent_id"] = parent_id
    defaults.update(kwargs)
    category = FAQCategory(**defaults)
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)
    return category


async def create_faq(db_session, category_id=None, **kwargs):
    """Create an FAQ instance."""
    if category_id is None:
        category = await create_faq_category(db_session)
        category_id = category.id
    
    defaults = {
        "category_id": category_id,
        "question": fake.sentence(nb_words=8),
        "answer": fake.text(max_nb_chars=500),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
        "is_featured": False,
    }
    defaults.update(kwargs)
    faq = FAQ(**defaults)
    db_session.add(faq)
    await db_session.commit()
    await db_session.refresh(faq)
    return faq


async def create_team_member(db_session, **kwargs):
    """Create a TeamMember instance."""
    defaults = {
        "name": fake.name(),
        "title": fake.job(),
        "bio": fake.text(max_nb_chars=300),
        "email": fake.email(),
        "phone": fake.phone_number(),
        "photo_url": fake.image_url(),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=100),
        "is_featured": False,
    }
    defaults.update(kwargs)
    member = TeamMember(**defaults)
    db_session.add(member)
    await db_session.commit()
    await db_session.refresh(member)
    return member


async def create_company_info(db_session, **kwargs):
    """Create a CompanyInfo instance."""
    defaults = {
        "section_key": fake.random_element(["about_us", "mission", "history", "values"]),
        "title": fake.sentence(nb_words=5),
        "content": fake.text(max_nb_chars=1000),
        "image_url": fake.image_url(),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=10),
    }
    defaults.update(kwargs)
    info = CompanyInfo(**defaults)
    db_session.add(info)
    await db_session.commit()
    await db_session.refresh(info)
    return info


async def create_contact_location(db_session, **kwargs):
    """Create a ContactLocation instance."""
    defaults = {
        "location_name": fake.random_element(["Headquarters", "Showroom", "Warehouse", "Sales Office"]),
        "description": fake.text(max_nb_chars=200),
        "address_line1": fake.street_address(),
        "address_line2": fake.secondary_address(),
        "city": fake.city(),
        "state": fake.state_abbr(),
        "zip_code": fake.zipcode(),
        "country": "USA",
        "phone": fake.phone_number(),
        "email": fake.email(),
        "business_hours": "Monday-Friday: 9AM-5PM",
        "location_type": fake.random_element(["office", "showroom", "warehouse"]),
        "is_active": True,
        "is_primary": False,
        "display_order": fake.random_int(min=1, max=100),
    }
    defaults.update(kwargs)
    location = ContactLocation(**defaults)
    db_session.add(location)
    await db_session.commit()
    await db_session.refresh(location)
    return location


async def create_catalog(db_session, category_id=None, **kwargs):
    """Create a Catalog instance."""
    defaults = {
        "title": fake.catch_phrase() + " Catalog",
        "description": fake.text(max_nb_chars=300),
        "catalog_type": fake.random_element(list(CatalogType)),
        "file_type": fake.random_element(["PDF", "IMAGE", "ZIP"]),
        "file_url": fake.url(),
        "file_size": fake.random_int(min=1000000, max=50000000),
        "thumbnail_url": fake.image_url(),
        "version": "1.0",
        "year": str(fake.year()),
        "is_active": True,
        "is_featured": False,
        "display_order": fake.random_int(min=1, max=50),
    }
    if category_id:
        defaults["category_id"] = category_id
    defaults.update(kwargs)
    catalog = Catalog(**defaults)
    db_session.add(catalog)
    await db_session.commit()
    await db_session.refresh(catalog)
    return catalog


async def create_installation(db_session, **kwargs):
    """Create an Installation instance."""
    from datetime import datetime
    defaults = {
        "project_name": fake.catch_phrase(),
        "client_name": fake.company(),
        "location": fake.city() + ", " + fake.state_abbr(),
        "project_type": fake.random_element(["Restaurant", "Hotel", "Office", "Retail", "Healthcare"]),
        "description": fake.text(max_nb_chars=500),
        "images": [{"url": fake.image_url(), "title": "Main view", "order": 1}],
        "primary_image": fake.image_url(),
        "completion_date": datetime.now().isoformat(),
        "is_active": True,
        "is_featured": False,
        "display_order": fake.random_int(min=1, max=100),
    }
    defaults.update(kwargs)
    installation = Installation(**defaults)
    db_session.add(installation)
    await db_session.commit()
    await db_session.refresh(installation)
    return installation


async def create_hero_slide(db_session, **kwargs):
    """Create a HeroSlide instance."""
    defaults = {
        "title": fake.sentence(nb_words=5),
        "subtitle": fake.text(max_nb_chars=100),
        "background_image_url": fake.image_url(),
        "cta_text": "Learn More",
        "cta_link": "/products",
        "cta_style": "primary",
        "display_order": fake.random_int(min=1, max=10),
        "is_active": True,
    }
    defaults.update(kwargs)
    slide = HeroSlide(**defaults)
    db_session.add(slide)
    await db_session.commit()
    await db_session.refresh(slide)
    return slide


async def create_feature(db_session, **kwargs):
    """Create a Feature instance."""
    defaults = {
        "title": fake.sentence(nb_words=3),
        "description": fake.text(max_nb_chars=200),
        "icon": "check",
        "icon_color": fake.hex_color(),
        "feature_type": "general",
        "display_order": fake.random_int(min=1, max=10),
        "is_active": True,
    }
    defaults.update(kwargs)
    feature = Feature(**defaults)
    db_session.add(feature)
    await db_session.commit()
    await db_session.refresh(feature)
    return feature


async def create_client_logo(db_session, **kwargs):
    """Create a ClientLogo instance."""
    defaults = {
        "name": fake.company(),
        "logo_url": fake.image_url(),
        "website_url": fake.url(),
        "display_order": fake.random_int(min=1, max=20),
        "is_active": True,
    }
    defaults.update(kwargs)
    logo = ClientLogo(**defaults)
    db_session.add(logo)
    await db_session.commit()
    await db_session.refresh(logo)
    return logo


async def create_company_value(db_session, **kwargs):
    """Create a CompanyValue instance."""
    defaults = {
        "title": fake.sentence(nb_words=3),
        "subtitle": fake.text(max_nb_chars=100),
        "description": fake.text(max_nb_chars=200),
        "icon": "star",
        "display_order": fake.random_int(min=1, max=10),
        "is_active": True,
    }
    defaults.update(kwargs)
    value = CompanyValue(**defaults)
    db_session.add(value)
    await db_session.commit()
    await db_session.refresh(value)
    return value


async def create_company_milestone(db_session, **kwargs):
    """Create a CompanyMilestone instance."""
    defaults = {
        "year": str(fake.year()),
        "title": fake.sentence(nb_words=4),
        "description": fake.text(max_nb_chars=200),
        "image_url": fake.image_url(),
        "display_order": fake.random_int(min=1, max=20),
        "is_active": True,
    }
    defaults.update(kwargs)
    milestone = CompanyMilestone(**defaults)
    db_session.add(milestone)
    await db_session.commit()
    await db_session.refresh(milestone)
    return milestone


async def create_sales_representative(db_session, **kwargs):
    """Create a SalesRepresentative instance."""
    defaults = {
        "name": fake.name(),
        "email": fake.email(),
        "phone": fake.phone_number(),
        "territory_name": fake.state_abbr() + " Territory",
        "states_covered": [fake.state_abbr()],
        "title": fake.job(),
        "photo_url": fake.image_url(),
        "bio": fake.text(max_nb_chars=200),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=50),
    }
    defaults.update(kwargs)
    rep = SalesRepresentative(**defaults)
    db_session.add(rep)
    await db_session.commit()
    await db_session.refresh(rep)
    return rep


async def create_site_settings(db_session, **kwargs):
    """Create a SiteSettings instance."""
    defaults = {
        "company_name": "Eagle Chair",
        "company_tagline": fake.sentence(nb_words=6),
        "logo_url": fake.image_url(),
        "primary_email": fake.email(),
        "primary_phone": fake.phone_number(),
        "address_line1": fake.street_address(),
        "city": fake.city(),
        "state": fake.state_abbr(),
        "zip_code": fake.zipcode(),
        "country": "USA",
        "business_hours_weekdays": "Monday-Friday: 9AM-5PM",
    }
    defaults.update(kwargs)
    settings = SiteSettings(**defaults)
    db_session.add(settings)
    await db_session.commit()
    await db_session.refresh(settings)
    return settings


async def create_page_content(db_session, **kwargs):
    """Create a PageContent instance."""
    defaults = {
        "page_slug": fake.random_element(["home", "about", "contact", "products"]),
        "section_key": fake.random_element(["hero", "story", "cta", "features"]),
        "title": fake.sentence(nb_words=5),
        "subtitle": fake.text(max_nb_chars=100),
        "content": fake.text(max_nb_chars=500),
        "image_url": fake.image_url(),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=20),
    }
    defaults.update(kwargs)
    content = PageContent(**defaults)
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)
    return content


async def create_hardware(db_session, **kwargs):
    """Create a Hardware instance."""
    defaults = {
        "name": fake.random_element(["Standard Glides", "Casters", "Table Base", "Fasteners"]),
        "category": fake.random_element(["Glides", "Casters", "Table Bases", "Fasteners"]),
        "description": fake.text(max_nb_chars=200),
        "material": fake.random_element(["Steel", "Nylon", "Chrome Plated"]),
        "finish": fake.random_element(["Polished", "Brushed", "Black Powder Coat"]),
        "model_number": fake.bothify(text="HW-####"),
        "image_url": fake.image_url(),
        "is_active": True,
        "is_featured": False,
        "display_order": fake.random_int(min=1, max=50),
    }
    defaults.update(kwargs)
    hardware = Hardware(**defaults)
    db_session.add(hardware)
    await db_session.commit()
    await db_session.refresh(hardware)
    return hardware


async def create_laminate(db_session, **kwargs):
    """Create a Laminate instance."""
    defaults = {
        "brand": fake.random_element(["Wilsonart", "Formica", "Pionite"]),
        "pattern_name": fake.word().title() + " Pattern",
        "pattern_code": fake.bothify(text="PAT-####"),
        "description": fake.text(max_nb_chars=200),
        "color_family": fake.random_element(["Woodgrain", "Solid", "Stone Look"]),
        "finish_type": fake.random_element(["Matte", "Gloss", "Textured"]),
        "swatch_image_url": fake.image_url(),
        "is_active": True,
        "is_featured": False,
        "is_popular": False,
        "display_order": fake.random_int(min=1, max=50),
    }
    defaults.update(kwargs)
    laminate = Laminate(**defaults)
    db_session.add(laminate)
    await db_session.commit()
    await db_session.refresh(laminate)
    return laminate


async def create_email_template(db_session, **kwargs):
    """Create an EmailTemplate instance."""
    defaults = {
        "template_type": fake.random_element([
            "quote_submitted", "quote_approved", "welcome", "password_reset"
        ]),
        "name": fake.catch_phrase() + " Template",
        "description": fake.text(max_nb_chars=200),
        "subject": fake.sentence(nb_words=5),
        "body": fake.text(max_nb_chars=1000),
        "is_active": True,
    }
    defaults.update(kwargs)
    template = EmailTemplate(**defaults)
    db_session.add(template)
    await db_session.commit()
    await db_session.refresh(template)
    return template


async def create_feedback(db_session, **kwargs):
    """Create a Feedback instance."""
    defaults = {
        "name": fake.name(),
        "email": fake.email(),
        "phone": fake.phone_number(),
        "company_name": fake.company(),
        "subject": fake.sentence(nb_words=4),
        "message": fake.text(max_nb_chars=500),
        "feedback_type": fake.random_element(["general", "inquiry", "complaint", "suggestion"]),
        "is_read": False,
        "is_responded": False,
        "ip_address": fake.ipv4(),
    }
    defaults.update(kwargs)
    feedback = Feedback(**defaults)
    db_session.add(feedback)
    await db_session.commit()
    await db_session.refresh(feedback)
    return feedback


# ============================================================================
# Legal Factories
# ============================================================================

async def create_legal_document(db_session, **kwargs):
    """Create a LegalDocument instance."""
    import uuid
    unique_id = uuid.uuid4().hex[:8]
    defaults = {
        "document_type": fake.random_element(list(LegalDocumentType)),
        "title": fake.sentence(nb_words=4),
        "content": fake.text(max_nb_chars=2000),
        "short_description": fake.text(max_nb_chars=200),
        "slug": f"{fake.slug()}-{unique_id}",
        "version": "1.0",
        "is_active": True,
        "display_order": fake.random_int(min=1, max=50),
    }
    defaults.update(kwargs)
    document = LegalDocument(**defaults)
    db_session.add(document)
    await db_session.commit()
    await db_session.refresh(document)
    return document


async def create_warranty_information(db_session, **kwargs):
    """Create a WarrantyInformation instance."""
    defaults = {
        "warranty_type": fake.random_element(["Limited Warranty", "Extended Warranty", "Lifetime"]),
        "title": fake.sentence(nb_words=4),
        "description": fake.text(max_nb_chars=500),
        "duration": fake.random_element(["1 year", "5 years", "Lifetime"]),
        "coverage": fake.text(max_nb_chars=500),
        "exclusions": fake.text(max_nb_chars=300),
        "claim_process": fake.text(max_nb_chars=300),
        "is_active": True,
        "display_order": fake.random_int(min=1, max=20),
    }
    defaults.update(kwargs)
    warranty = WarrantyInformation(**defaults)
    db_session.add(warranty)
    await db_session.commit()
    await db_session.refresh(warranty)
    return warranty


async def create_shipping_policy(db_session, **kwargs):
    """Create a ShippingPolicy instance."""
    defaults = {
        "policy_name": fake.random_element(["Standard Shipping", "Express Shipping", "Freight"]),
        "description": fake.text(max_nb_chars=500),
        "freight_classification": fake.random_element(["Class 70", "Class 85", "Class 100"]),
        "shipping_timeframe": fake.random_element(["5-7 business days", "10-14 business days"]),
        "special_instructions": fake.text(max_nb_chars=200),
        "damage_claim_process": fake.text(max_nb_chars=300),
        "is_active": True,
    }
    defaults.update(kwargs)
    policy = ShippingPolicy(**defaults)
    db_session.add(policy)
    await db_session.commit()
    await db_session.refresh(policy)
    return policy
