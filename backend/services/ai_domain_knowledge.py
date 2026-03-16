"""
EagleChair domain knowledge for the AI assistant.
Injected into the system prompt so the AI understands products, models, variations, database, and workflows.
"""

EAGLECHAIR_DOMAIN_KNOWLEDGE = """
## EagleChair Product & Naming System

### Model Numbers and Suffixes
- **Base model**: Typically 4 digits (e.g., 5242, 6018, 6246). The numeric part identifies the product design.
- **Suffixes**: Letters/codes appended to indicate configuration. Dashes are optional — 5242-P, 5242P, and 5242 P refer to the same model.
- **Common suffix meanings**: P (padded/upholstered seat), PB (padded back), W (wood), WB (wood back), BX (box), etc. Suffixes can combine (e.g., 5242PBX = padded back box style).
- **Full model**: base + suffix. Examples: 6018, 6018P, 6018PB; 5242-P, 5242P, 5242PBX; 6246WB.P, 6246-22WB.BX.

### Products vs Variations
- **Product (Chair)**: One row in `chairs` table. Has `model_number` (base, e.g., 5242) and optional `model_suffix` (e.g., P, PB). Represents the base design.
- **Variation**: One row in `product_variations`. Has `sku` = full model (e.g., 5242PBX, 5242-22WB.BX). Links to a product via `product_id`. Variations are specific finish/upholstery/color combos. ~99% of variations share the same base model number as their product.
- **Lookup**: When someone says "5242" or "5242P" or "5242-P", treat as equivalent. Match by stripping dashes and comparing base + suffix.

### Dimensions (inches) and Weight
- **Dimensions**: width, depth, height (overall); seat_width, seat_depth, seat_height; arm_height, back_height. All in inches.
- **Weight**: `weight` (lbs). `shipping_weight` when different. Product weight applies; variations can override.
- **additional_dimensions**: JSON for flexible fields (e.g., table_diameter, booth_length).

### Upholstery Amount (yards)
- **upholstery_amount**: Yards of fabric/vinyl/leather used when the product has upholstery. Stored on Chair and ProductVariation. Use for material ordering, COM quotes, and cost estimates. Variations can override product value when a specific combo uses different yardage.

### Pricing and Costs (all in cents)
- **Products**: base_price (LIST price), msrp (manufacturer suggested retail).
- **Variations**: price_adjustment (added to product base_price; can be negative).
- **Finishes**: additional_cost (cents) — premium finishes add to base.
- **Upholsteries**: additional_cost (base), grade_a_cost, grade_b_cost, grade_c_cost, premium_cost — grade-based pricing per upholstery grade.
- **Custom options**: price_adjustment, requires_quote for manual quoting.

### Other Product Fields
- **frame_material**: Solid Wood, Metal, etc.
- **features**: JSON array (e.g., Stackable, Ganging, Swivel, Arms).
- **stock_status**: In Stock, Out of Stock, etc.
- **lead_time_days**: Production lead time.
- **minimum_order_quantity**: Minimum units per order.
- **flame_certifications**: JSON (e.g., CAL 117, UFAC Class 1).
- **green_certifications**: JSON (e.g., FSC, GREENGUARD).
- **ada_compliant**: Boolean.
- **recommended_use**: Restaurant, Healthcare, etc.
- **is_outdoor_suitable**: Boolean.
- **warranty_info**, **care_instructions**: Text.

### Finding Products
- **By model**: Use get_product_catalog; match model_number or sku flexibly (5242, 5242P, 5242-P).
- **By dimensions**: Filter products/variations by width, depth, height, seat_height.
- **By weight**: Filter by weight.
- **By upholstery amount**: Filter by upholstery_amount (yards).
- **By price**: Filter by base_price or price range.
- **By features**: Check features JSON.
- **By category/family**: Use category_id, family_id, subcategory_id.

### Catalog Structure
- **Categories**: Chairs, Booths, Tables, Bar Stools (parent categories).
- **Subcategories**: Wood Chairs, Metal Chairs, Lounge Chairs, etc.
- **Product Families**: Group related products (e.g., Alpine, Argento, Andy).
- **Finishes**: Wood stains, paints, metal coatings. finish_code, grade (Standard/Premium/Artisan), additional_cost.
- **Upholsteries**: Fabrics, vinyls, leathers. material_code, material_type, grade (A/B/C/Premium), grade costs. is_com for COM/COL.
- **Colors**: Used by finishes and upholsteries. color_code, hex_value.

## Database Schema (Key Tables)
- **chairs**: model_number, model_suffix, suffix_description, name, category_id, family_id, base_price, msrp, width, depth, height, seat_*, weight, upholstery_amount, frame_material, features, stock_status, lead_time_days, minimum_order_quantity, flame_certifications, warranty_info, etc.
- **product_variations**: sku, product_id, finish_id, upholstery_id, color_id, price_adjustment, width, depth, height, weight, upholstery_amount (overrides).
- **finishes**: additional_cost.
- **upholsteries**: additional_cost, grade_a_cost, grade_b_cost, grade_c_cost, premium_cost.
- **quotes**, **quote_items**: Quote requests. quote_items reference product_id, product_model_number.
- **companies**: B2B customers.

## Business Workflow
- Companies register, browse catalog, add items to quote cart, submit quote requests.
- Admin manages products, quotes, companies, CMS content.
- Pricing is B2B; LIST prices in catalog; actual quotes may have discounts.

## Public Website Routes
- / — Home
- /products — Product catalog (all products)
- /products/category/:category — Catalog filtered by category
- /products/category/:category/:subcategory — Catalog filtered by subcategory
- /products/:id — Product detail (by ID or slug)
- /products/:categorySlug/:subcategorySlug/:productSlug — Product detail
- /families/:familySlug — Product family page
- /search — Search
- /cart — Shopping cart
- /quote-request — Quote request form
- /about, /contact, /gallery, /find-a-rep — Info pages
- /virtual-catalogs, /resources/guides, /resources/woodfinishes, /resources/hardware, /resources/laminates, /resources/upholstery, /resources/seat-back-terms — Resource pages
- /terms, /privacy, /general-information — Legal/info
- /login, /verify-email, /forgot-password, /reset-password — Auth

## Admin Panel Routes (Full Knowledge)
- /admin — Dashboard overview
- /admin/analytics — Analytics
- /admin/catalog — Product Catalog (list all products; click row or Edit to open ProductEditor)
- /admin/categories — Categories & subcategories
- /admin/families — Product Families
- /admin/colors — Colors
- /admin/finishes — Finishes
- /admin/upholstery — Upholstery
- /admin/laminates — Laminates
- /admin/resources/catalogs — Virtual Catalogs
- /admin/hardware — Hardware
- /admin/companies — Companies
- /admin/quotes — Quote Management
- /admin/pricing-tiers — Pricing Tiers
- /admin/legal-documents — Legal Documents
- /admin/emails — Email Templates
- /admin/settings — Site Settings
- /admin/ai — AI Chat (full-screen)

## Admin How-To (Guiding Users)
- **Edit a product**: Go to [Product Catalog](/admin/catalog), find the product, click the row or Edit icon. Opens ProductEditor.
- **Add a product**: Product Catalog → Add Product (or ProductEditor when no product selected).
- **Edit categories**: [Categories](/admin/categories).
- **Edit finishes/colors/upholstery**: [Finishes](/admin/finishes), [Colors](/admin/colors), [Upholstery](/admin/upholstery).
- **Manage quotes**: [Quotes](/admin/quotes).
- **Manage companies**: [Companies](/admin/companies).
- **View analytics**: [Analytics](/admin/analytics).
- **Edit product families**: [Product Families](/admin/families).

## AI Response Format for Links
When guiding admin, use markdown links: [Go to Product Catalog](/admin/catalog). Internal paths (starting with /) navigate in-app. Use descriptive link text for actions, e.g. [Edit Product 5242](/admin/catalog) or [View Quote #123](/admin/quotes).
"""
