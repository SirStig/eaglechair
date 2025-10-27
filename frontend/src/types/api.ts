/**
 * TypeScript type definitions matching backend Pydantic schemas
 * 
 * These types ensure type safety when working with API responses
 * and help catch mismatches between frontend and backend at compile time.
 * 
 * Based on:
 * - backend/api/v1/schemas/product.py
 * - backend/api/v1/schemas/quote.py
 * - backend/api/v1/schemas/content.py
 * - backend/api/v1/schemas/common.py
 */

// ============================================================================
// Common Types
// ============================================================================

export interface TimestampSchema {
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface MessageResponse {
  message: string;
  detail?: string;
}

export interface SuccessResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  detail?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ============================================================================
// Product Types
// ============================================================================

export interface ProductImageItem {
  url: string;
  type?: 'side' | 'front' | 'gallery' | 'primary' | 'hover' | 'detail';
  order?: number;
  alt?: string;
}

export interface CategoryBase {
  name: string;
  slug: string;
  description?: string;
  parent_id?: number;
  display_order: number;
  is_active: boolean;
  icon_url?: string;
  banner_image_url?: string;
  meta_title?: string;
  meta_description?: string;
}

export interface CategoryResponse extends CategoryBase, TimestampSchema {
  id: number;
}

export interface CategoryWithSubcategories extends CategoryResponse {
  subcategories: CategoryResponse[];
}

export interface FinishBase {
  name: string;
  finish_code?: string;
  description?: string;
  finish_type?: string;
  color_hex?: string;
  image_url?: string;
  is_custom: boolean;
  is_to_match: boolean;
  is_active: boolean;
  additional_cost: number; // In cents
  display_order: number;
}

export interface FinishResponse extends FinishBase, TimestampSchema {
  id: number;
}

export interface UpholsteryBase {
  name: string;
  material_code?: string;
  material_type: string;
  description?: string;
  color?: string;
  color_hex?: string;
  pattern?: string;
  grade?: string;
  image_url?: string;
  swatch_image_url?: string;
  is_com: boolean;
  com_requirements?: string;
  durability_rating?: string;
  flame_rating?: string;
  cleanability?: string;
  is_active: boolean;
  additional_cost: number; // In cents
  display_order: number;
}

export interface UpholsteryResponse extends UpholsteryBase, TimestampSchema {
  id: number;
}

export interface ChairBase {
  model_number: string;
  name: string;
  slug: string;
  short_description?: string;
  full_description?: string;
  category_id: number;
  base_price: number; // In cents
  msrp?: number; // In cents
  
  // Dimensions (inches)
  width?: number;
  depth?: number;
  height?: number;
  seat_width?: number;
  seat_depth?: number;
  seat_height?: number;
  arm_height?: number;
  back_height?: number;
  additional_dimensions?: Record<string, any>;
  
  // Weight (pounds)
  weight?: number;
  shipping_weight?: number;
  
  // Materials & Construction
  frame_material?: string;
  construction_details?: string;
  
  // Features & Options
  features?: string[];
  available_finishes?: number[];
  available_upholsteries?: number[];
  
  // Images
  images: string[] | ProductImageItem[];
  primary_image?: string;
  thumbnail?: string;
  
  // Additional Media
  dimensional_drawing_url?: string;
  cad_file_url?: string;
  spec_sheet_url?: string;
  
  // Inventory
  stock_status: string;
  lead_time_days?: number;
  minimum_order_quantity: number;
  
  // Certifications
  flame_certifications?: string[];
  green_certifications?: string[];
  ada_compliant: boolean;
  
  // Usage
  recommended_use?: string;
  is_outdoor_suitable: boolean;
  warranty_info?: string;
  care_instructions?: string;
  
  // SEO
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
  
  // Status
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_custom_only: boolean;
  display_order: number;
}

export interface ChairResponse extends ChairBase, TimestampSchema {
  id: number;
  view_count: number;
  quote_count: number;
}

export interface ChairDetailResponse extends ChairResponse {
  category?: CategoryResponse;
  related_products?: ChairResponse[];
}

export type ProductResponse = ChairResponse;
export type ProductDetailResponse = ChairDetailResponse;

// ============================================================================
// Quote Types
// ============================================================================

export enum QuoteStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  QUOTED = 'quoted',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

export interface QuoteBase {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  project_name?: string;
  project_description?: string;
  project_type?: string;
  estimated_quantity?: number;
  target_budget?: number; // In cents
  desired_delivery_date?: string;
  shipping_address_line1: string;
  shipping_address_line2?: string;
  shipping_city: string;
  shipping_state: string;
  shipping_zip: string;
  shipping_country: string;
  special_instructions?: string;
  requires_com: boolean;
  rush_order: boolean;
}

export interface QuoteResponse extends QuoteBase, TimestampSchema {
  id: number;
  quote_number: string;
  company_id: number;
  status: QuoteStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  quoted_price?: number;
  quoted_lead_time?: string;
  quote_notes?: string;
  quote_valid_until?: string;
  quote_pdf_url?: string;
  assigned_to_admin_id?: number;
  submitted_at?: string;
  quoted_at?: string;
  accepted_at?: string;
  expires_at?: string;
}

export interface QuoteItemBase {
  product_id: number;
  quantity: number;
  selected_finish_id?: number;
  selected_upholstery_id?: number;
  custom_options?: Record<string, any>;
  item_notes?: string;
}

export interface QuoteItemResponse extends QuoteItemBase {
  id: number;
  quote_id: number;
  product_model_number: string;
  product_name: string;
  unit_price: number;
  customization_cost: number;
  line_total: number;
}

export interface QuoteWithItems extends QuoteResponse {
  items: QuoteItemResponse[];
}

export interface CartResponse extends TimestampSchema {
  id: number;
  company_id: number;
  subtotal: number;
  estimated_tax: number;
  estimated_shipping: number;
  estimated_total: number;
  is_active: boolean;
  last_updated?: string;
}

export interface CartItemBase {
  product_id: number;
  quantity: number;
  selected_finish_id?: number;
  selected_upholstery_id?: number;
  custom_options?: Record<string, any>;
  item_notes?: string;
}

export interface CartItemResponse extends CartItemBase {
  id: number;
  cart_id: number;
  unit_price: number;
  customization_cost: number;
  line_total: number;
  added_at?: string;
  updated_at?: string;
}

export interface CartWithItems extends CartResponse {
  items: CartItemResponse[];
}

// ============================================================================
// Content Types
// ============================================================================

export enum CatalogType {
  FULL_CATALOG = 'full_catalog',
  PRODUCT_LINE = 'product_line',
  PRICE_LIST = 'price_list',
  FINISH_GUIDE = 'finish_guide',
  UPHOLSTERY_GUIDE = 'upholstery_guide',
  CARE_GUIDE = 'care_guide',
  INSTALLATION_GUIDE = 'installation_guide',
  SPECIFICATION_SHEET = 'specification_sheet',
  OTHER = 'other',
}

export interface TeamMemberBase {
  name: string;
  title: string;
  bio?: string;
  email?: string;
  phone?: string;
  photo_url?: string;
  linkedin_url?: string;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface TeamMemberResponse extends TeamMemberBase, TimestampSchema {
  id: number;
}

export interface CompanyInfoBase {
  section_key: string;
  title: string;
  content: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

export interface CompanyInfoResponse extends CompanyInfoBase, TimestampSchema {
  id: number;
}

export interface FAQCategoryBase {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: number;
  display_order: number;
  is_active: boolean;
}

export interface FAQCategoryResponse extends FAQCategoryBase, TimestampSchema {
  id: number;
}

export interface FAQBase {
  category_id: number;
  question: string;
  answer: string;
  helpful_links?: string;
  related_products?: string;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface FAQResponse extends FAQBase, TimestampSchema {
  id: number;
  view_count: number;
  helpful_count: number;
}

export interface CatalogBase {
  title: string;
  description?: string;
  catalog_type: CatalogType;
  file_type: string;
  file_url: string;
  file_size?: number;
  thumbnail_url?: string;
  version?: string;
  year?: string;
  category_id?: number;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface CatalogResponse extends CatalogBase, TimestampSchema {
  id: number;
  download_count: number;
}

export interface InstallationImageItem {
  url: string;
  title?: string;
  description?: string;
  order?: number;
}

export interface InstallationBase {
  project_name: string;
  client_name?: string;
  location?: string;
  project_type?: string;
  description?: string;
  images: string[] | InstallationImageItem[];
  primary_image?: string;
  products_used?: number[];
  completion_date?: string;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface InstallationResponse extends InstallationBase, TimestampSchema {
  id: number;
  view_count: number;
}

export interface ContactLocationBase {
  location_name: string;
  description?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  fax?: string;
  email: string;
  toll_free?: string;
  business_hours?: string;
  image_url?: string;
  map_embed_url?: string;
  location_type: string;
  display_order: number;
  is_active: boolean;
  is_primary: boolean;
}

export interface ContactLocationResponse extends ContactLocationBase, TimestampSchema {
  id: number;
}

export interface FeedbackBase {
  name: string;
  email: string;
  phone?: string;
  company_name?: string;
  subject?: string;
  message: string;
  feedback_type: string;
}

export interface FeedbackResponse extends FeedbackBase, TimestampSchema {
  id: number;
  is_read: boolean;
  is_responded: boolean;
  admin_notes?: string;
  ip_address?: string;
}

// ============================================================================
// CMS Content Types (Hero, Features, etc.)
// ============================================================================

export interface HeroSlideBase {
  title: string;
  subtitle?: string;
  background_image_url?: string;
  cta_text?: string;
  cta_link?: string;
  cta_style?: string;
  secondary_cta_text?: string;
  secondary_cta_link?: string;
  secondary_cta_style?: string;
  display_order: number;
  is_active: boolean;
}

export interface HeroSlideResponse extends HeroSlideBase, TimestampSchema {
  id: number;
}

export interface FeatureBase {
  title: string;
  description: string;
  icon?: string;
  icon_color?: string;
  image_url?: string;
  feature_type: string;
  display_order: number;
  is_active: boolean;
}

export interface FeatureResponse extends FeatureBase, TimestampSchema {
  id: number;
}

export interface ClientLogoBase {
  name: string;
  logo_url: string;
  website_url?: string;
  display_order: number;
  is_active: boolean;
}

export interface ClientLogoResponse extends ClientLogoBase, TimestampSchema {
  id: number;
}

export interface CompanyValueBase {
  title: string;
  subtitle?: string;
  description: string;
  icon?: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

export interface CompanyValueResponse extends CompanyValueBase, TimestampSchema {
  id: number;
}

export interface CompanyMilestoneBase {
  year: string;
  title: string;
  description: string;
  image_url?: string;
  display_order: number;
  is_active: boolean;
}

export interface CompanyMilestoneResponse extends CompanyMilestoneBase, TimestampSchema {
  id: number;
}

export interface SalesRepBase {
  name: string;
  email: string;
  phone?: string;
  territory?: string;
  states: string[];
  photo_url?: string;
  bio?: string;
  display_order: number;
  is_active: boolean;
}

export interface SalesRepResponse extends SalesRepBase, TimestampSchema {
  id: number;
}

export interface SiteSettingsBase {
  company_name: string;
  company_tagline?: string;
  logo_url?: string;
  primary_email: string;
  primary_phone: string;
  sales_email?: string;
  sales_phone?: string;
  support_email?: string;
  support_phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country: string;
  business_hours_weekdays?: string;
  business_hours_saturday?: string;
  business_hours_sunday?: string;
  facebook_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  youtube_url?: string;
}

export interface SiteSettingsResponse extends SiteSettingsBase, TimestampSchema {
  id: number;
}

export interface PageContentBase {
  page_slug: string;
  section_key: string;
  title?: string;
  subtitle?: string;
  content?: string;
  image_url?: string;
  video_url?: string;
  cta_text?: string;
  cta_link?: string;
  cta_style?: string;
  extra_data?: Record<string, any>;
  display_order: number;
  is_active: boolean;
}

export interface PageContentResponse extends PageContentBase, TimestampSchema {
  id: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export type ProductListResponse = PaginatedResponse<ProductResponse>;
export type CategoryListResponse = PaginatedResponse<CategoryResponse>;
export type FinishListResponse = PaginatedResponse<FinishResponse>;
export type UpholsteryListResponse = PaginatedResponse<UpholsteryResponse>;
export type QuoteListResponse = PaginatedResponse<QuoteResponse>;
export type TeamMemberListResponse = PaginatedResponse<TeamMemberResponse>;
export type FAQListResponse = PaginatedResponse<FAQResponse>;
export type CatalogListResponse = PaginatedResponse<CatalogResponse>;
export type InstallationListResponse = PaginatedResponse<InstallationResponse>;
export type FeedbackListResponse = PaginatedResponse<FeedbackResponse>;
