"""
Names for the Time Machine UI: what each table is called and which admin
section manages it. Tables not listed fall back to a title-cased name.
"""

# table -> (singular label, admin section path)
TABLES = {
    "chairs": ("Product", "/admin/catalog"),
    "product_variations": ("Variation", "/admin/catalog"),
    "product_images": ("Product image", "/admin/catalog"),
    "product_relations": ("Related product link", "/admin/catalog"),
    "custom_options": ("Custom option", "/admin/catalog"),
    "product_tags": ("Product tag", "/admin/catalog"),
    "product_tag_associations": ("Product tag link", "/admin/catalog"),
    "chair_categories": ("Product category link", "/admin/catalog"),
    "chair_subcategories": ("Product subcategory link", "/admin/catalog"),
    "chair_secondary_families": ("Product family link", "/admin/catalog"),
    "variation_families": ("Variation family link", "/admin/catalog"),
    "categories": ("Category", "/admin/categories"),
    "product_subcategories": ("Subcategory", "/admin/categories"),
    "product_families": ("Product family", "/admin/families"),
    "family_categories": ("Family category link", "/admin/families"),
    "family_subcategories": ("Family subcategory link", "/admin/families"),
    "finishes": ("Finish", "/admin/finishes"),
    "colors": ("Color", "/admin/colors"),
    "upholsteries": ("Upholstery", "/admin/upholstery"),
    "laminates": ("Laminate", "/admin/laminates"),
    "hardware": ("Hardware", "/admin/hardware"),
    "material_sources": ("Supplier link", "/admin/supplier-links"),
    "catalogs": ("Virtual catalog", "/admin/resources/catalogs"),
    "catalog_projects": ("Catalog Builder project", "/admin/catalog-builder"),
    "legal_documents": ("Legal document", "/admin/legal-documents"),
    "warranty_information": ("Warranty info", "/admin/legal-documents"),
    "shipping_policies": ("Shipping policy", "/admin/legal-documents"),
    "email_templates": ("Email template", "/admin/emails"),
    "companies": ("Company", "/admin/companies"),
    "company_shipping_addresses": ("Company shipping address", "/admin/companies"),
    "company_pricing": ("Pricing tier", "/admin/pricing-tiers"),
    "quotes": ("Quote", "/admin/quotes"),
    "quote_items": ("Quote line", "/admin/quotes"),
    "quote_shipping_destinations": ("Quote destination", "/admin/quotes"),
    "quote_item_allocations": ("Quote allocation", "/admin/quotes"),
    "quote_attachments": ("Quote attachment", "/admin/quotes"),
    "quote_history": ("Quote history note", "/admin/quotes"),
    "feedback": ("Inquiry", "/admin/inquiries"),
    "site_settings": ("Site settings", "/admin/settings"),
    "page_contents": ("Page content", "/admin/settings"),
    "hero_slides": ("Hero slide", "/admin/settings"),
    "team_members": ("Team member", "/admin/settings"),
    "company_info": ("Company info", "/admin/settings"),
    "company_values": ("Company value", "/admin/settings"),
    "company_milestones": ("Company milestone", "/admin/settings"),
    "faq_categories": ("FAQ category", "/admin/settings"),
    "faqs": ("FAQ", "/admin/settings"),
    "installations": ("Installation", "/admin/settings"),
    "contact_locations": ("Contact location", "/admin/settings"),
    "client_logos": ("Client logo", "/admin/settings"),
    "testimonials": ("Testimonial", "/admin/settings"),
    "features": ("Feature", "/admin/settings"),
    "sales_representatives": ("Sales rep", "/admin/settings"),
}


def table_label(name: str) -> str:
    if name in TABLES:
        return TABLES[name][0]
    words = name.replace("_", " ").strip()
    if words.endswith("ies"):
        words = words[:-3] + "y"
    elif words.endswith("s"):
        words = words[:-1]
    return words.capitalize() or name


def table_section(name: str) -> str | None:
    entry = TABLES.get(name)
    return entry[1] if entry else None
