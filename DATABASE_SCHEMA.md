# EagleChair Database Schema Documentation

This document provides a comprehensive overview of the database schema for the EagleChair website backend.

## 📊 Database Overview

The database consists of **6 main categories** with **24 tables** to support a full-featured B2B chair company website.

## 🗂️ Schema Categories

### 1. Legal & Compliance (3 tables)

#### `legal_documents`
Stores all legal information, terms, policies, and warranties.
- **Purpose**: Centralized legal content management
- **Key Fields**:
  - `document_type` (enum): Type of legal document
  - `title`, `content`: Document content
  - `version`, `effective_date`: Version control
  - `is_active`: Publication status
- **Document Types**: 25+ types including:
  - Price lists, terms, warranties
  - Shipping policies, returns, cancellations
  - IP disclaimers, conditions of sale

#### `warranty_information`
Detailed warranty specifications.
- **Key Fields**:
  - `warranty_type`: Type of warranty
  - `duration`, `coverage`, `exclusions`
  - `claim_process`: How to file claims

#### `shipping_policies`
Shipping and freight-specific policies.
- **Key Fields**:
  - `freight_classification`
  - `shipping_timeframe`
  - `damage_claim_process`

---

### 2. Users & Security (3 tables)

#### `companies` (B2B Customers)
Company accounts - only businesses can register.
- **Purpose**: B2B customer management
- **Key Fields**:
  - Company info: `company_name`, `legal_name`, `tax_id`
  - Representative: `rep_first_name`, `rep_last_name`, `rep_email`, `rep_phone`
  - Authentication: `hashed_password`
  - Addresses: Separate billing and shipping addresses
  - Status: `status` (pending/active/suspended), `is_verified`
  - Business: `resale_certificate`, `credit_limit`, `payment_terms`
  - `additional_contacts` (JSON): Multiple company contacts
- **Relationships**:
  - One-to-many with `quotes`
  - One-to-one with `carts`

#### `admin_users`
Admin panel users with enhanced security.
- **Purpose**: Website administration with tight security
- **Key Fields**:
  - Basic: `username`, `email`, `hashed_password`
  - Role: `role` (super_admin/admin/editor/viewer)
  - Security:
    - `session_token`, `admin_token`: Dual token system
    - `whitelisted_ips` (JSON): Optional IP whitelisting
    - `is_2fa_enabled`, `two_factor_secret`: 2FA support
    - `failed_login_attempts`, `locked_until`: Brute force protection
  - Audit: `last_login`, `last_login_ip`, `last_activity`

#### `admin_audit_logs`
Complete audit trail of admin actions.
- **Purpose**: Security and compliance tracking
- **Key Fields**:
  - `admin_id`, `action`, `resource_type`, `resource_id`
  - `details` (JSON): Action context
  - `ip_address`, `user_agent`, `timestamp`

---

### 3. Products & Catalog (5 tables)

#### `categories`
Hierarchical product categories.
- **Purpose**: Organize products (Chairs, Booths, Tables, Bar Stools)
- **Key Fields**:
  - `name`, `slug`, `description`
  - `parent_id`: Self-referencing for subcategories
  - `display_order`, `is_active`
  - `icon_url`, `banner_image_url`
- **Structure**: Supports unlimited nesting

#### `finishes`
Available wood stains, paints, and metal finishes.
- **Purpose**: Product finish options
- **Key Fields**:
  - `name`, `finish_code`, `finish_type`
  - `color_hex`, `image_url`
  - `is_custom`, `is_to_match`: Custom/match finish support
  - `additional_cost`: Upcharge for special finishes

#### `upholsteries`
Fabric, vinyl, and leather options.
- **Purpose**: Upholstery material catalog
- **Key Fields**:
  - `name`, `material_code`, `material_type`
  - `color`, `color_hex`, `pattern`, `grade`
  - `image_url`, `swatch_image_url`
  - COM support: `is_com`, `com_requirements`
  - Specifications: `durability_rating`, `flame_rating`, `cleanability`

#### `chairs` (Main Product Table)
Comprehensive product information for chairs, booths, tables.
- **Purpose**: Core product catalog
- **Key Fields**:
  - Identity: `model_number`, `name`, `slug`
  - Descriptions: `short_description`, `full_description`
  - Category: `category_id` (FK)
  - Pricing: `base_price`, `msrp`
  - Dimensions: `width`, `depth`, `height`, `seat_width`, `seat_depth`, `seat_height`, `arm_height`, `back_height`
  - `additional_dimensions` (JSON): Flexible dimensions
  - Weight: `weight`, `shipping_weight`
  - Materials: `frame_material`, `construction_details`
  - `features` (JSON): Array of features
  - Options: `available_finishes` (JSON), `available_upholsteries` (JSON)
  - Images: `images` (JSON array), `primary_image`, `thumbnail`
  - Media: `dimensional_drawing_url`, `cad_file_url`, `spec_sheet_url`
  - Inventory: `stock_status`, `lead_time_days`, `minimum_order_quantity`
  - Certifications: `flame_certifications` (JSON), `green_certifications` (JSON), `ada_compliant`
  - Application: `recommended_use`, `warranty_info`, `care_instructions`
  - Status: `is_active`, `is_featured`, `is_new`, `is_custom_only`
  - Analytics: `view_count`, `quote_count`

#### `product_relations`
Related products for cross-selling.
- **Purpose**: Product recommendations
- **Key Fields**:
  - `product_id`, `related_product_id`
  - `relation_type`: related/alternative/accessory

---

### 4. Content Management (8 tables)

#### `team_members`
About Us - company team.
- **Purpose**: Team directory
- **Key Fields**:
  - `name`, `title`, `bio`
  - `email`, `phone`, `photo_url`
  - `linkedin_url`
  - `is_featured`: Highlight key members

#### `company_info`
About Us content sections.
- **Purpose**: Company information pages
- **Key Fields**:
  - `section_key`: Unique identifier (e.g., "about_us", "mission")
  - `title`, `content`, `image_url`

#### `faq_categories`
FAQ organization with hierarchy.
- **Purpose**: Categorize FAQs
- **Key Fields**:
  - `name`, `slug`, `description`, `icon`
  - `parent_id`: Subcategory support

#### `faqs`
Frequently asked questions.
- **Purpose**: Customer self-service
- **Key Fields**:
  - `category_id` (FK)
  - `question`, `answer`
  - `helpful_links`, `related_products`
  - `is_featured`
  - Analytics: `view_count`, `helpful_count`

#### `catalogs`
Virtual catalogs and downloadable guides.
- **Purpose**: PDF/image resources
- **Key Fields**:
  - `title`, `description`, `catalog_type`
  - `file_type`, `file_url`, `file_size`, `thumbnail_url`
  - `version`, `year`
  - `category_id`: Optional category association
  - Analytics: `download_count`
- **Catalog Types**: Full catalog, product line, price list, finish guide, upholstery guide, care guide, installation guide, spec sheets

#### `installations`
Installation gallery - completed projects.
- **Purpose**: Showcase installations
- **Key Fields**:
  - `project_name`, `client_name`, `location`, `project_type`
  - `description`, `completion_date`
  - `images` (JSON), `primary_image`
  - `products_used` (JSON): Link to products
  - Analytics: `view_count`

#### `contact_locations`
Multiple office/showroom locations.
- **Purpose**: Contact information
- **Key Fields**:
  - `location_name`, `description`, `location_type`
  - Full address fields
  - `phone`, `fax`, `email`, `toll_free`
  - `business_hours`
  - `image_url`, `map_embed_url`
  - `is_primary`: Main location

#### `feedback`
Contact form submissions.
- **Purpose**: Customer inquiries
- **Key Fields**:
  - `name`, `email`, `phone`, `company_name`
  - `subject`, `message`, `feedback_type`
  - Status: `is_read`, `is_responded`
  - `admin_notes`

---

### 5. Quotes & Cart (5 tables)

#### `quotes`
Quote requests (no purchasing, quotes only).
- **Purpose**: B2B quote management
- **Key Fields**:
  - `quote_number`, `status`
  - `company_id` (FK)
  - Contact: `contact_name`, `contact_email`, `contact_phone`
  - Project: `project_name`, `project_description`, `project_type`, `estimated_quantity`, `target_budget`, `desired_delivery_date`
  - Shipping address: Full address fields
  - Pricing: `subtotal`, `tax_amount`, `shipping_cost`, `discount_amount`, `total_amount`
  - Special: `special_instructions`, `requires_com`, `rush_order`
  - Admin response: `quoted_price`, `quoted_lead_time`, `quote_notes`, `quote_valid_until`, `quote_pdf_url`
  - Assignment: `assigned_to_admin_id`
  - Dates: `submitted_at`, `quoted_at`, `accepted_at`, `expires_at`

#### `quote_items`
Individual items in a quote.
- **Purpose**: Quote line items
- **Key Fields**:
  - `quote_id` (FK), `product_id` (FK)
  - Captured: `product_model_number`, `product_name`
  - `quantity`
  - Customization: `selected_finish_id`, `selected_upholstery_id`, `custom_options` (JSON)
  - Pricing: `unit_price`, `customization_cost`, `line_total`

#### `carts`
Shopping cart (temporary, one per company).
- **Purpose**: Hold items before quote submission
- **Key Fields**:
  - `company_id` (FK, unique)
  - Totals: `subtotal`, `estimated_tax`, `estimated_shipping`, `estimated_total`
  - `last_updated`

#### `cart_items`
Items in shopping cart.
- **Purpose**: Cart line items
- **Key Fields**:
  - `cart_id` (FK), `product_id` (FK)
  - `quantity`
  - Customization: `selected_finish_id`, `selected_upholstery_id`, `custom_options` (JSON)
  - Pricing: `unit_price`, `customization_cost`, `line_total`
  - Dates: `added_at`, `updated_at`

#### `saved_configurations`
Save customized products for later.
- **Purpose**: Wishlist/favorites
- **Key Fields**:
  - `company_id` (FK), `product_id` (FK)
  - `configuration_name`, `description`
  - `configuration_data` (JSON)
  - `estimated_price`
  - `is_favorite`

---

## 🔗 Key Relationships

### One-to-Many
- `companies` → `quotes`
- `companies` → `saved_configurations`
- `categories` → `chairs`
- `categories` → `catalogs`
- `faq_categories` → `faqs`
- `quotes` → `quote_items`
- `carts` → `cart_items`
- `admin_users` → `admin_audit_logs`

### One-to-One
- `companies` → `carts` (one cart per company)

### Many-to-Many (through foreign keys)
- `chairs` ↔ `finishes` (via JSON array `available_finishes`)
- `chairs` ↔ `upholsteries` (via JSON array `available_upholsteries`)
- `chairs` ↔ `chairs` (via `product_relations` for related products)

### Self-Referencing
- `categories.parent_id` → `categories.id` (hierarchical categories)
- `faq_categories.parent_id` → `faq_categories.id` (hierarchical FAQ categories)

---

## 🔐 Security Features

### Admin Security
- **Dual Token System**: `session_token` + `admin_token`
- **IP Whitelisting**: Optional `whitelisted_ips` JSON array
- **2FA Support**: `is_2fa_enabled`, `two_factor_secret`
- **Brute Force Protection**: `failed_login_attempts`, `locked_until`
- **Complete Audit Trail**: `admin_audit_logs` table

### Company Security
- **Status Control**: `status` enum (pending/active/suspended/inactive)
- **Verification**: `is_verified` flag
- **Password Security**: `hashed_password` with bcrypt

---

## 📈 Analytics & Tracking

- Products: `view_count`, `quote_count`
- FAQs: `view_count`, `helpful_count`
- Catalogs: `download_count`
- Installations: `view_count`
- Admin: Complete audit log of all actions

---

## 🎨 Flexibility Features

### JSON Fields for Dynamic Data
- `companies.additional_contacts`: Multiple company contacts
- `admin_users.whitelisted_ips`: Dynamic IP whitelist
- `chairs.additional_dimensions`: Custom dimensions
- `chairs.features`: Array of features
- `chairs.available_finishes/upholsteries`: Product options
- `chairs.images`: Multiple product images
- `chairs.flame_certifications`, `green_certifications`: Certifications
- `quote_items.custom_options`, `cart_items.custom_options`: Custom selections
- `saved_configurations.configuration_data`: Saved customizations

### Hierarchical Structures
- Categories with unlimited nesting
- FAQ categories with unlimited nesting

### Version Control
- Legal documents: `version`, `effective_date`
- Catalogs: `version`, `year`

---

## 🚀 Admin Panel Capabilities

Admins can manage:
1. ✅ **Legal Documents**: Edit all terms, policies, warranties
2. ✅ **Team Members**: Manage About Us team directory
3. ✅ **Company Info**: Edit About Us content sections
4. ✅ **FAQs**: Add/edit/organize FAQs and categories
5. ✅ **Catalogs & Guides**: Upload and manage downloadable resources
6. ✅ **Installations**: Showcase completed projects
7. ✅ **Contact Locations**: Manage office/showroom information
8. ✅ **Products**: Full product catalog management
9. ✅ **Categories**: Organize product categories
10. ✅ **Finishes & Upholsteries**: Manage customization options
11. ✅ **Quotes**: Review, respond to, and manage quote requests
12. ✅ **Companies**: Approve and manage B2B customer accounts
13. ✅ **Feedback**: View and respond to customer inquiries

---

## 📊 Database Statistics

- **Total Tables**: 24
- **Enum Types**: 5 (LegalDocumentType, CompanyStatus, AdminRole, QuoteStatus, CatalogType)
- **JSON Fields**: 15+ for maximum flexibility
- **Self-Referencing Tables**: 2 (categories, faq_categories)
- **Audit/Logging Tables**: 1 (admin_audit_logs)

---

## 🔄 Workflow Examples

### Company Registration & Quote Flow
1. Company registers → `companies` table (status: pending)
2. Admin reviews → updates status to active
3. Company adds items to cart → `carts`, `cart_items`
4. Company requests quote → Creates `quote`, `quote_items`
5. Admin reviews quote → Updates quote with pricing
6. Company accepts → Quote status changed to accepted

### Product Customization Flow
1. Customer views chair → `chairs` table
2. Selects finish → `finishes` table
3. Selects upholstery → `upholsteries` table
4. Adds custom options → JSON `custom_options` field
5. Saves configuration → `saved_configurations`
6. Adds to cart → `cart_items` with all selections

---

## 🎯 Key Design Decisions

1. **B2B Focus**: Only companies can create accounts
2. **No Purchases**: Cart converts to quote requests only
3. **Maximum Flexibility**: Extensive use of JSON for custom data
4. **Admin Control**: Everything is editable via admin panel
5. **Security First**: Multiple layers of admin protection
6. **Audit Trail**: Complete logging of admin actions
7. **Scalability**: Hierarchical structures support growth
8. **SEO Ready**: Meta fields on key content types

---

This schema provides a complete foundation for a professional B2B furniture company website with full admin control and comprehensive quote management.

