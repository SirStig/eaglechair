// Demo mode flag - set to false to use real API
// This is also controlled by VITE_DEMO_MODE environment variable
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

// Demo Products - Based on actual Eagle Chair products
// Structure matches backend ChairResponse schema
export const demoProducts = [
  // ===== CHAIRS - WOOD =====
  {
    id: 1,
    name: "Model 6010 Wood Chair",
    slug: "model-6010-wood-chair",
    model_number: "6010",
    category_id: 1, // Chairs
    base_price: 8999, // $89.99 in cents
    msrp: 12999, // $129.99 in cents
    short_description: "Classic European beech wood dining chair with upholstered seat.",
    full_description: "European Alpine beech construction with FSC certification. Commercial-grade design perfect for restaurants and dining spaces.",
    
    // Dimensions
    width: 18,
    depth: 20,
    height: 36,
    seat_height: 18,
    weight: 12,
    
    // Materials
    frame_material: "European Alpine Beech",
    features: [
      "FSC certified European beech",
      "Commercial-grade construction",
      "Multiple finish options",
      "Upholstered seat available"
    ],
    
    // Images (using string array format)
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    ],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    
    // Inventory
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    // Certifications
    flame_certifications: [],
    green_certifications: ["FSC Certified"],
    ada_compliant: false,
    
    // Usage
    is_outdoor_suitable: false,
    
    // Status
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: false,
    display_order: 1,
    
    // Metadata
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields for compatibility (can be removed later)
    category: "chairs",
    subcategory: "Wood",
    type: "Dining Chair",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 89.99,
    priceRange: { min: 89.99, max: 129.99 },
  },
  {
    id: 2,
    name: "Model 6016 Wood Chair",
    slug: "model-6016-wood-chair",
    model_number: "6016",
    category_id: 1,
    base_price: 9599,
    msrp: 13999,
    short_description: "European beech wood chair with elegant design.",
    full_description: "Premium European beech construction with commercial-grade durability. Perfect for upscale dining establishments.",
    
    seat_height: 18,
    weight: 14,
    frame_material: "European Alpine Beech",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg",
    
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: false,
    display_order: 2,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "chairs",
    subcategory: "Wood",
    price: 95.99,
    priceRange: { min: 95.99, max: 139.99 },
  },
  {
    id: 3,
    name: "Model 6020 Wood Chair",
    slug: "model-6020-wood-chair",
    model_number: "6020",
    category_id: 1,
    base_price: 9299,
    msrp: 13599,
    short_description: "Classic vertical slat back design with European beech construction.",
    full_description: "Premium European Alpine beech dining chair with traditional vertical slat back. FSC certified sustainable wood, commercial-grade durability.",
    
    seat_height: 18,
    weight: 15,
    frame_material: "European Alpine Beech",
    
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v31.jpg",
      "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v32.jpg"
    ],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v31.jpg",
    
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: false,
    is_new: false,
    is_custom_only: false,
    display_order: 3,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "chairs",
    subcategory: "Wood",
    price: 92.99,
  },
  {
    id: 4,
    name: "Model 6088 Wood Chair",
    slug: "model-6088-wood-chair",
    model_number: "6088",
    category_id: 1,
    base_price: 9999,
    msrp: 14999,
    short_description: "Elegant curved back design, perfect for wine cellars and upscale dining.",
    full_description: "European Alpine beech chair with distinctive curved back. FSC certified sustainable wood. Ideal for wine cellars, fine dining, and upscale restaurants.",
    
    seat_height: 18,
    weight: 17,
    frame_material: "European Alpine Beech",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png",
    
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: false,
    display_order: 4,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "chairs",
    subcategory: "Wood",
    price: 99.99,
  },

  // ===== BARSTOOLS - WOOD =====
  {
    id: 7,
    name: "Model 5310 Wood Barstool",
    slug: "model-5310-wood-barstool",
    model_number: "5310",
    category_id: 2, // Barstools
    base_price: 12999,
    msrp: 17999,
    short_description: "European beech barstool with elegant design and FSC certification.",
    full_description: "Premium European Alpine beech barstool with commercial-grade construction. FSC certified sustainable wood. Perfect for bars, restaurants, and counter seating.",
    
    seat_height: 30,
    weight: 18,
    frame_material: "European Alpine Beech",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png",
    
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: false,
    display_order: 7,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "barstools",
    subcategory: "Wood",
    price: 129.99,
  },
  {
    id: 8,
    name: "Model 5311 Wood Barstool",
    slug: "model-5311-wood-barstool",
    model_number: "5311",
    category_id: 2,
    base_price: 11999,
    msrp: 16999,
    short_description: "European beech barstool with clean design and multiple finish options.",
    full_description: "FSC certified European Alpine beech barstool with commercial durability. Available with wood or padded seat. Perfect for bars, cafes, and counter seating.",
    
    seat_height: 30,
    weight: 16,
    frame_material: "European Alpine Beech",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg",
    
    stock_status: "In Stock",
    lead_time_days: 14,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: false,
    is_new: false,
    is_custom_only: false,
    display_order: 8,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "barstools",
    subcategory: "Wood",
    price: 119.99,
  },
  
  // ===== BARSTOOLS - METAL =====
  {
    id: 9,
    name: "Model 4405 Metal Barstool",
    slug: "model-4405-metal-barstool",
    model_number: "4405",
    category_id: 2,
    base_price: 10999,
    msrp: 14999,
    short_description: "Commercial-grade metal barstool with sleek contemporary design.",
    full_description: "Heavy-duty steel construction with powder-coated finish. Built with exceptional strength for commercial environments. Perfect for bars, restaurants, and cafes.",
    
    seat_height: 30,
    weight: 15,
    frame_material: "Commercial Steel",
    
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v81e-e1588692286256.jpg",
      "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P.png"
    ],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v81e-e1588692286256.jpg",
    
    stock_status: "In Stock",
    lead_time_days: 7,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: true,
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: false,
    display_order: 9,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "barstools",
    subcategory: "Metal",
    price: 109.99,
  },
  
  // ===== BOOTHS =====
  {
    id: 10,
    name: "Custom Upholstered Booth",
    slug: "custom-upholstered-booth",
    model_number: "Custom Booth",
    category_id: 5, // Booths
    base_price: 55000, // $550.00 in cents
    msrp: 95000,
    short_description: "Custom manufactured booth seating with premium upholstery and solid construction.",
    full_description: "Eagle Chair manufactures high-quality booths to each order. Custom sizes and configurations available. Solid hardwood frame with commercial-grade upholstery. Singles, doubles, banquettes, L-booths, U-booths, and specialty designs available.",
    
    width: 48,
    seat_height: 18,
    weight: 75,
    frame_material: "Solid Hardwood Frame",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg",
    
    stock_status: "Made to Order",
    lead_time_days: 35,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: true,
    is_new: false,
    is_custom_only: true,
    display_order: 10,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "booths",
    subcategory: "Upholstered",
    price: 550.00,
  },
  {
    id: 11,
    name: "Custom Wood-Core Laminate Table Top",
    slug: "custom-wood-core-laminate-table",
    model_number: "Custom Table",
    category_id: 3, // Tables
    base_price: 19500,
    msrp: 38500,
    short_description: "Custom manufactured wood-core laminated table top.",
    full_description: "Custom manufactured wood-core laminated table top. Extremely dense industrial particle board core with high-pressure laminate top and bottom. Any size can be made with various edge options including wood, rubber, aluminum, or padded edges.",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png",
    
    stock_status: "Made to Order",
    lead_time_days: 21,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: false,
    is_active: true,
    is_featured: false,
    is_new: false,
    is_custom_only: true,
    display_order: 11,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "tables",
    subcategory: "Table Tops",
    price: 195.00,
  },
  {
    id: 12,
    name: "Eagle Chair Table Base",
    slug: "eagle-chair-table-base",
    model_number: "Table Base",
    category_id: 4, // Bases
    base_price: 19500,
    msrp: 29500,
    short_description: "Commercial-grade table base with heavy-duty construction.",
    full_description: "Commercial-grade table base with heavy-duty construction. Eagle Chair offers a large selection organized by color, material, type, and series. Suitable for various table top sizes and styles.",
    
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png"],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png",
    
    stock_status: "In Stock",
    lead_time_days: 7,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: true,
    is_active: true,
    is_featured: false,
    is_new: false,
    is_custom_only: false,
    display_order: 12,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "bases",
    subcategory: "Table Bases",
    price: 195.00,
  },
  {
    id: 13,
    name: "Outdoor Metal Chair",
    slug: "outdoor-metal-chair",
    model_number: "3245M",
    category_id: 6, // Outdoor
    base_price: 9999,
    msrp: 13999,
    short_description: "Weather-resistant metal chair designed for outdoor commercial use.",
    full_description: "Weather-resistant metal chair designed for outdoor commercial use. Powder-coated finish withstands the elements. Stackable design for easy storage. Perfect for patios, outdoor dining areas, and cafes.",
    
    width: 17,
    depth: 19,
    height: 33,
    seat_height: 18,
    weight: 12,
    frame_material: "Powder-Coated Steel",
    
    features: [
      "Weather-resistant powder coating",
      "Commercial-grade construction",
      "Stackable design",
      "UV resistant finish",
      "Indoor/outdoor use"
    ],
    
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png",
      "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-barney-purple-v719.png"
    ],
    primary_image: "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png",
    
    stock_status: "In Stock",
    lead_time_days: 7,
    minimum_order_quantity: 1,
    
    is_outdoor_suitable: true,
    is_active: true,
    is_featured: false,
    is_new: false,
    is_custom_only: false,
    display_order: 13,
    view_count: 0,
    quote_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    
    // Legacy fields
    category: "outdoor",
    subcategory: "Chairs",
    price: 99.99,
  },
];

// Demo Categories - Match backend CategoryResponse schema
export const demoCategories = [
  {
    id: 1,
    name: "Chairs",
    slug: "chairs",
    description: "Commercial-grade chairs for restaurants and dining spaces",
    parent_id: null,
    display_order: 1,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1503602642458-232111445657?w=800",
    banner_image_url: null,
    meta_title: "Commercial Dining Chairs - Eagle Chair",
    meta_description: "Shop our selection of commercial-grade dining chairs",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Barstools",
    slug: "barstools",
    description: "Stylish and durable barstools for bars and high-top dining",
    parent_id: null,
    display_order: 2,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=800",
    banner_image_url: null,
    meta_title: "Commercial Barstools - Eagle Chair",
    meta_description: "Browse commercial barstools for bars and restaurants",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Tables",
    slug: "tables",
    description: "Premium table tops in various materials and sizes",
    parent_id: null,
    display_order: 3,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800",
    banner_image_url: null,
    meta_title: "Commercial Table Tops - Eagle Chair",
    meta_description: "Custom commercial table tops for restaurants",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 4,
    name: "Bases",
    slug: "bases",
    description: "Sturdy table bases for commercial applications",
    parent_id: null,
    display_order: 4,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800",
    banner_image_url: null,
    meta_title: "Commercial Table Bases - Eagle Chair",
    meta_description: "Heavy-duty table bases for commercial use",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 5,
    name: "Booths",
    slug: "booths",
    description: "Comfortable booth seating for restaurants",
    parent_id: null,
    display_order: 5,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    banner_image_url: null,
    meta_title: "Commercial Booths - Eagle Chair",
    meta_description: "Custom booth seating for restaurants",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 6,
    name: "Outdoor",
    slug: "outdoor",
    description: "Weather-resistant outdoor furniture",
    parent_id: null,
    display_order: 6,
    is_active: true,
    icon_url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800",
    banner_image_url: null,
    meta_title: "Outdoor Commercial Furniture - Eagle Chair",
    meta_description: "Weather-resistant outdoor furniture for commercial spaces",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// Demo Rep Data (for Find a Rep map)
// Note: Use dummy names/info unless found on eaglechair.com
export const demoReps = [
  {
    id: 1,
    name: "Rep Contact 1",
    email: "rep1@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["TX", "OK", "AR", "LA"],
    territory: "Texas & Louisiana"
  },
  {
    id: 2,
    name: "Rep Contact 2",
    email: "rep2@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["CA", "NV", "AZ"],
    territory: "West Coast"
  },
  {
    id: 3,
    name: "Rep Contact 3",
    email: "rep3@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["FL", "GA", "AL", "SC", "NC"],
    territory: "Southeast"
  },
  {
    id: 4,
    name: "Rep Contact 4",
    email: "rep4@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["NY", "NJ", "PA", "CT", "MA", "RI", "VT", "NH", "ME"],
    territory: "Northeast"
  },
  {
    id: 5,
    name: "Rep Contact 5",
    email: "rep5@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["IL", "WI", "MN", "IA", "MO", "MI", "IN", "OH"],
    territory: "Midwest"
  },
  {
    id: 6,
    name: "Rep Contact 6",
    email: "rep6@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["WA", "OR", "ID", "MT", "WY"],
    territory: "Pacific Northwest"
  },
  {
    id: 7,
    name: "Rep Contact 7",
    email: "rep7@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["CO", "UT", "NM", "NE", "KS", "ND", "SD"],
    territory: "Mountain & Plains"
  },
  {
    id: 8,
    name: "Rep Contact 8",
    email: "rep8@eaglechair.com",
    phone: "(XXX) XXX-XXXX",
    states: ["VA", "WV", "KY", "TN", "MS", "MD", "DE", "DC"],
    territory: "Mid-Atlantic & South"
  },
];

// Demo Gallery Images
export const demoGalleryImages = [
  {
    id: 1,
    url: "https://www.eaglechair.com/wp-content/uploads/2024/01/IMG_8681-960x600.jpeg",
    title: "Restaurant Installation",
    category: "Restaurants"
  },
  {
    id: 2,
    url: "https://www.eaglechair.com/wp-content/uploads/2023/10/IMG_0694-960x600.jpeg",
    title: "Commercial Dining Space",
    category: "Dining"
  },
  {
    id: 3,
    url: "https://www.eaglechair.com/wp-content/uploads/2014/10/Cafe-Neustadt.5001V.6016V.install-v2y-e1691698549306-960x600.jpg",
    title: "Cafe Neustadt - Models 5001V & 6016V",
    category: "Cafes"
  },
  {
    id: 4,
    url: "https://www.eaglechair.com/wp-content/uploads/2018/04/Carmine.6305P.install-v.10-e1691698608946-960x600.jpg",
    title: "Carmine Restaurant - Model 6305P",
    category: "Restaurants"
  },
  {
    id: 5,
    url: "https://www.eaglechair.com/wp-content/uploads/2021/02/Baja-Sur.8621-Lanzac.6576.Atlanta-bases-400-table..install-v507-copy-e1691698160654-960x600.jpg",
    title: "Baja Sur - Models 8621 & 6576 with Atlanta Bases",
    category: "Restaurants"
  },
  {
    id: 6,
    url: "https://www.eaglechair.com/wp-content/uploads/2017/06/Budapest-Cafe.6018V.install-v2-e1691698439957-960x600.jpg",
    title: "Budapest Cafe - Model 6018V",
    category: "Cafes"
  },
];

// Demo Testimonials/Client Logos
// These should be replaced with actual company logos that Eagle Chair works with
export const demoClients = [
  { name: "Client Company 1", logo: "/logos/client-1.png" },
  { name: "Client Company 2", logo: "/logos/client-2.png" },
  { name: "Client Company 3", logo: "/logos/client-3.png" },
  { name: "Client Company 4", logo: "/logos/client-4.png" },
  { name: "Client Company 5", logo: "/logos/client-5.png" },
  { name: "Client Company 6", logo: "/logos/client-6.png" },
  { name: "Client Company 7", logo: "/logos/client-7.png" },
  { name: "Client Company 8", logo: "/logos/client-8.png" },
];

// Demo Resources
export const demoResources = [
  {
    id: 1,
    title: "Product Catalog 2024",
    type: "PDF",
    size: "15.2 MB",
    url: "/downloads/catalog-2024.pdf",
    description: "Complete product catalog with specifications and pricing"
  },
  {
    id: 2,
    title: "Fabric Swatch Guide",
    type: "PDF",
    size: "8.5 MB",
    url: "/downloads/fabric-guide.pdf",
    description: "All available fabric options with care instructions"
  },
  {
    id: 3,
    title: "Wood Finish Samples",
    type: "PDF",
    size: "5.3 MB",
    url: "/downloads/wood-finishes.pdf",
    description: "Wood finish options and maintenance guide"
  },
  {
    id: 4,
    title: "Installation Guide",
    type: "PDF",
    size: "3.2 MB",
    url: "/downloads/installation.pdf",
    description: "Step-by-step installation instructions"
  },
];

// Demo User
export const demoUser = {
  id: 1,
  email: "demo@eaglechair.com",
  name: "Demo User",
  company: "Demo Company",
  role: "user",
};

// Demo Admin User
export const demoAdminUser = {
  id: 2,
  email: "admin@eaglechair.com",
  name: "Admin User",
  company: "Eagle Chair",
  role: "admin",
};

// Company Information (from eaglechair.com)
export const companyInfo = {
  name: "Eagle Chair",
  founded: 1984,
  location: "Houston, TX",
  founderFamily: "Yuglich Family",
  currentLeadership: [
    {
      name: "Katarina Kac-Statton",
      role: "Leadership",
      image: "/team/katarina.jpg"
    },
    {
      name: "Maximilian Kac",
      role: "Leadership",
      image: "/team/maximilian.jpg"
    }
  ],
  contact: {
    phone: "(832) 555-0100",
    salesPhone: "(832) 555-0101",
    email: "info@eaglechair.com",
    salesEmail: "sales@eaglechair.com",
    address: {
      street: "4816 Campbell Rd",
      city: "Houston",
      state: "Texas",
      zip: "77041",
      fullAddress: "4816 Campbell Rd, Houston, Texas 77041"
    },
    businessHours: {
      weekdays: "Mon-Fri: 8:00 AM - 5:00 PM CST",
      saturday: "Sat: By Appointment",
      sunday: "Sun: Closed"
    }
  }
};

// Site Settings (for footer, header, etc.)
export const demoSiteSettings = {
  companyName: "Eagle Chair",
  companyTagline: "Premium Commercial Furniture Since 1984",
  logoUrl: "/uploads/images/logos/eagle-chair-logo_1761709955.png",
  primaryEmail: "info@eaglechair.com",
  primaryPhone: "(616) 555-0100",
  salesEmail: "sales@eaglechair.com",
  salesPhone: "(616) 555-0101",
  supportEmail: "support@eaglechair.com",
  supportPhone: "(616) 555-0102",
  addressLine1: "4816 Campbell Rd",
  city: "Houston",
  state: "TX",
  zipCode: "77041",
  country: "USA",
  businessHoursWeekdays: "Mon-Fri: 8:00 AM - 5:00 PM EST",
  businessHoursSaturday: "Sat: By Appointment",
  businessHoursSunday: "Sun: Closed",
  facebookUrl: "https://facebook.com",
  instagramUrl: "https://instagram.com",
  linkedinUrl: "https://linkedin.com",
  twitterUrl: null,
  youtubeUrl: null
};

// About Page Content
export const demoAboutContent = {
  hero: {
    title: "Our Story",
    subtitle: "Family-owned and operated since 1984, continuing the Yuglich Family legacy of quality commercial furniture manufacturing in Houston, Texas."
  },
  story: {
    title: "Craftsmanship & Dedication",
    paragraphs: [
      "Founded in Houston, Texas in 1984 by the Yuglich Family, Eagle Chair has grown into a trusted name in commercial furniture manufacturing. Under the leadership of Katarina Kac-Statton and Maximilian Kac, we've maintained our commitment to quality, craftsmanship, and customer satisfaction.",
      "Our furniture graces thousands of restaurants, hotels, and hospitality venues across the country. Each piece is a testament to our dedication to excellence and our understanding of the demanding needs of commercial environments.",
      "As a family-owned business, we take pride in treating every customer like family. Your success is our success, and we're here to support you every step of the way."
    ]
  },
  values: [
    {
      title: "Quality First",
      description: "We never compromise on materials or craftsmanship. Every piece is built to last."
    },
    {
      title: "Customer Partnership",
      description: "We build lasting relationships with our clients, supporting them every step of the way."
    },
    {
      title: "American Made",
      description: "Proudly manufacturing in the USA, supporting local communities and jobs."
    },
    {
      title: "Sustainability",
      description: "Committed to environmentally responsible practices and materials."
    }
  ],
  milestones: [
    { year: "1984", title: "Company Founded", description: "Eagle Chair was established in Houston, Texas by the Yuglich Family" },
    { year: "1995", title: "Expansion", description: "Opened new manufacturing facility and doubled capacity" },
    { year: "2005", title: "National Distribution", description: "Expanded distribution network to serve nationwide" },
    { year: "2024", title: "Continued Excellence", description: "Continuing the Yuglich Family legacy of quality craftsmanship" }
  ],
  team: [
    { name: "Katarina Kac-Statton", role: "Leadership", image: "/team/katarina.jpg" },
    { name: "Maximilian Kac", role: "Leadership", image: "/team/maximilian.jpg" }
  ]
};

// Team Members (for About page)
export const teamMembers = [
  {
    id: 1,
    name: "Katarina Kac-Statton",
    title: "Leadership",
    bio: "Leading Eagle Chair with dedication to quality and customer satisfaction.",
    photo_url: "/team/katarina.jpg",
    email: null,
    phone: null,
    linkedin_url: null,
    display_order: 1,
    is_active: true,
    is_featured: true
  },
  {
    id: 2,
    name: "Maximilian Kac",
    title: "Leadership",
    bio: "Continuing the Yuglich Family legacy of excellence in commercial furniture.",
    photo_url: "/team/maximilian.jpg",
    email: null,
    phone: null,
    linkedin_url: null,
    display_order: 2,
    is_active: true,
    is_featured: true
  }
];

// Company Values (for About page)
export const companyValues = [
  {
    id: 1,
    title: "Quality First",
    subtitle: "Excellence in Every Detail",
    description: "We never compromise on materials or craftsmanship. Every piece is built to last.",
    icon: "⭐",
    image_url: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=400",
    display_order: 1,
    is_active: true
  },
  {
    id: 2,
    title: "Customer Partnership",
    subtitle: "Your Success is Our Success",
    description: "We build lasting relationships with our clients, supporting them every step of the way.",
    icon: "🤝",
    image_url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400",
    display_order: 2,
    is_active: true
  },
  {
    id: 3,
    title: "American Made",
    subtitle: "Proudly Made in the USA",
    description: "Proudly manufacturing in the USA, supporting local communities and jobs.",
    icon: "🇺🇸",
    image_url: "https://images.unsplash.com/photo-1565891741441-64926e441838?w=400",
    display_order: 3,
    is_active: true
  },
  {
    id: 4,
    title: "Sustainability",
    subtitle: "Eco-Friendly Practices",
    description: "Committed to environmentally responsible practices and materials.",
    icon: "🌱",
    image_url: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400",
    display_order: 4,
    is_active: true
  }
];

// Company Milestones (for About page)
export const companyMilestones = [
  {
    id: 1,
    year: "1984",
    title: "Company Founded",
    description: "Eagle Chair was established in Houston, Texas by the Yuglich Family",
    image_url: null,
    display_order: 1,
    is_active: true
  },
  {
    id: 2,
    year: "1995",
    title: "Expansion",
    description: "Opened new manufacturing facility and doubled capacity",
    image_url: null,
    display_order: 2,
    is_active: true
  },
  {
    id: 3,
    year: "2005",
    title: "National Distribution",
    description: "Expanded distribution network to serve nationwide",
    image_url: null,
    display_order: 3,
    is_active: true
  },
  {
    id: 4,
    year: "2024",
    title: "Continued Excellence",
    description: "Continuing the Yuglich Family legacy of quality craftsmanship",
    image_url: null,
    display_order: 4,
    is_active: true
  }
];

// Features (for home page "Why Choose Us" section)
export const features = [
  {
    id: 1,
    title: "American Made",
    description: "All our furniture is manufactured in the USA with premium materials and superior craftsmanship.",
    icon: "🇺🇸",
    icon_color: "#1e40af",
    image_url: "https://images.unsplash.com/photo-1565891741441-64926e441838?w=600",
    feature_type: "home_page",
    display_order: 1,
    is_active: true
  },
  {
    id: 2,
    title: "Commercial Grade",
    description: "Built to withstand heavy daily use in the most demanding commercial environments.",
    icon: "🛡️",
    icon_color: "#047857",
    image_url: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=600",
    feature_type: "home_page",
    display_order: 2,
    is_active: true
  },
  {
    id: 3,
    title: "Custom Options",
    description: "Extensive customization options including finishes, fabrics, and sizes to match your vision.",
    icon: "🎨",
    icon_color: "#7c3aed",
    image_url: "https://images.unsplash.com/photo-1503602642458-232111445657?w=600",
    feature_type: "home_page",
    display_order: 3,
    is_active: true
  },
  {
    id: 4,
    title: "Quick Turnaround",
    description: "Fast production and shipping to get your furniture delivered when you need it.",
    icon: "⚡",
    icon_color: "#ea580c",
    image_url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600",
    feature_type: "home_page",
    display_order: 4,
    is_active: true
  },
  {
    id: 5,
    title: "Warranty Backed",
    description: "Comprehensive warranty coverage because we stand behind the quality of our products.",
    icon: "✓",
    icon_color: "#0891b2",
    image_url: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600",
    feature_type: "home_page",
    display_order: 5,
    is_active: true
  },
  {
    id: 6,
    title: "Expert Support",
    description: "Dedicated sales representatives to help you choose the perfect furniture for your space.",
    icon: "👥",
    icon_color: "#dc2626",
    image_url: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=600",
    feature_type: "home_page",
    display_order: 6,
    is_active: true
  }
];

// Client Logos (for home page trusted brands section)
export const clientLogos = [
  {
    id: 1,
    name: "Major Restaurant Chain",
    logo_url: "/logos/client-1.png",
    website_url: null,
    display_order: 1,
    is_active: true
  },
  {
    id: 2,
    name: "Hotel Group",
    logo_url: "/logos/client-2.png",
    website_url: null,
    display_order: 2,
    is_active: true
  },
  {
    id: 3,
    name: "Healthcare Facility",
    logo_url: "/logos/client-3.png",
    website_url: null,
    display_order: 3,
    is_active: true
  }
];

// Contact Locations (for contact page)
export const contactLocations = [
  {
    id: 1,
    location_name: "Main Office & Showroom",
    description: "Visit our showroom to see our furniture in person",
    address_line1: "4816 Campbell Rd",
    address_line2: null,
    city: "Houston",
    state: "Texas",
    zip_code: "77041",
    country: "USA",
    phone: "(832) 555-0100",
    fax: null,
    email: "info@eaglechair.com",
    toll_free: "1-800-EAGLE-01",
    business_hours: "Mon-Fri: 8:00 AM - 5:00 PM CST\nSat: By Appointment\nSun: Closed",
    image_url: null,
    map_embed_url: null,
    location_type: "office",
    display_order: 1,
    is_active: true,
    is_primary: true
  }
];

// Hero Slides (for home page carousel)
export const heroSlides = [
  {
    id: 1,
    title: "Welcome to Eagle Chair",
    subtitle: "Premium Commercial Furniture for Restaurants & Hospitality",
    background_image_url: "https://www.eaglechair.com/wp-content/uploads/2018/04/Carmine.6305P.install-v.10-e1691698608946-960x600.jpg",
    cta_text: "Explore Products",
    cta_link: "/products",
    cta_style: "primary",
    secondary_cta_text: null,
    secondary_cta_link: null,
    secondary_cta_style: null,
    display_order: 1,
    is_active: true
  },
  {
    id: 2,
    title: "Crafted with Excellence",
    subtitle: "Family-Owned. American-Made. Built to Last.",
    background_image_url: "https://www.eaglechair.com/wp-content/uploads/2014/10/Cafe-Neustadt.5001V.6016V.install-v2y-e1691698549306-960x600.jpg",
    cta_text: "Our Story",
    cta_link: "/about",
    cta_style: "primary",
    secondary_cta_text: null,
    secondary_cta_link: null,
    secondary_cta_style: null,
    display_order: 2,
    is_active: true
  },
  {
    id: 3,
    title: "Complete Furniture Solutions",
    subtitle: "Chairs, Tables, Barstools & Booths for Every Commercial Space",
    background_image_url: "https://www.eaglechair.com/wp-content/uploads/2017/06/Budapest-Cafe.6018V.install-v2-e1691698439957-960x600.jpg",
    cta_text: "View Gallery",
    cta_link: "/gallery",
    cta_style: "primary",
    secondary_cta_text: "Contact Us",
    secondary_cta_link: "/contact",
    secondary_cta_style: "outline",
    display_order: 3,
    is_active: true
  }
];

// Home Page Content
export const demoHomeContent = {
  heroSlides: [
    {
      image: "https://www.eaglechair.com/wp-content/uploads/2018/04/Carmine.6305P.install-v.10-e1691698608946-960x600.jpg",
      title: "Welcome to Eagle Chair",
      subtitle: "Premium Commercial Furniture for Restaurants & Hospitality",
      ctaText: "Explore Products",
      ctaLink: "/products"
    },
    {
      image: "https://www.eaglechair.com/wp-content/uploads/2014/10/Cafe-Neustadt.5001V.6016V.install-v2y-e1691698549306-960x600.jpg",
      title: "Crafted with Excellence",
      subtitle: "Family-Owned. American-Made. Built to Last.",
      ctaText: "Our Story",
      ctaLink: "/about"
    },
    {
      image: "https://www.eaglechair.com/wp-content/uploads/2017/06/Budapest-Cafe.6018V.install-v2-e1691698439957-960x600.jpg",
      title: "Complete Furniture Solutions",
      subtitle: "Chairs, Tables, Barstools & Booths for Every Commercial Space",
      ctaText: "View Gallery",
      ctaLink: "/gallery"
    }
  ],
  whyChooseUs: [
    {
      title: "American Made",
      description: "All our furniture is manufactured in the USA with premium materials and superior craftsmanship."
    },
    {
      title: "Commercial Grade",
      description: "Built to withstand heavy daily use in the most demanding commercial environments."
    },
    {
      title: "Custom Options",
      description: "Extensive customization options including finishes, fabrics, and sizes to match your vision."
    },
    {
      title: "Quick Turnaround",
      description: "Fast production and shipping to get your furniture delivered when you need it."
    },
    {
      title: "Warranty Backed",
      description: "Comprehensive warranty coverage because we stand behind the quality of our products."
    },
    {
      title: "Expert Support",
      description: "Dedicated sales representatives to help you choose the perfect furniture for your space."
    }
  ]
};

// Footer Links
export const demoFooterLinks = {
  products: [
    { name: "Chairs", path: "/products/chairs" },
    { name: "Barstools", path: "/products/barstools" },
    { name: "Tables", path: "/products/tables" },
    { name: "Booths", path: "/products/booths" },
    { name: "Outdoor", path: "/products/outdoor" }
  ],
  company: [
    { name: "About Us", path: "/about" },
    { name: "Gallery", path: "/gallery" },
    { name: "Find a Rep", path: "/find-a-rep" },
    { name: "Contact", path: "/contact" }
  ],
  resources: [
    { name: "Virtual Catalogs", path: "/virtual-catalogs" },
    { name: "Wood Finishes", path: "/resources/woodfinishes" },
    { name: "Laminates", path: "/resources/laminates" },
    { name: "Upholstery", path: "/resources/upholstery" },
    { name: "Hardware", path: "/resources/hardware" },
    { name: "Guides & CAD", path: "/resources/guides" },
    { name: "Terminology", path: "/resources/seat-back-terms" }
  ],
  legal: [
    { name: "Privacy Policy", path: "/privacy" },
    { name: "Terms of Service", path: "/terms" },
    { name: "General Information", path: "/general-information" }
  ]
};

// Page Content (for dynamic sections)
// Page Content - Structured by page and section for easy lookup
// Matches PageContent model from backend
export const demoPageContent = {
  home: {
    cta: {
      id: 1,
      page_slug: "home",
      section_key: "cta",
      title: "Ready to Transform Your Space?",
      subtitle: null,
      content: "Experience the Eagle Chair difference. Let's create something amazing for your business.",
      image_url: null,
      video_url: null,
      cta_text: "Request a Quote",
      cta_link: "/quote",
      cta_style: "primary",
      extra_data: null,
      display_order: 1,
      is_active: true
    }
  },
  about: {
    hero: {
      id: 2,
      page_slug: "about",
      section_key: "hero",
      title: "Our Story",
      subtitle: "Family-owned and operated since 1984, continuing the Yuglich Family legacy of quality commercial furniture manufacturing in Houston, Texas.",
      content: null,
      image_url: "https://images.unsplash.com/photo-1565891741441-64926e441838?w=1920",
      video_url: null,
      cta_text: null,
      cta_link: null,
      cta_style: null,
      extra_data: null,
      display_order: 1,
      is_active: true
    },
    story: {
      id: 3,
      page_slug: "about",
      section_key: "story",
      title: "Craftsmanship & Dedication",
      subtitle: null,
      content: "Founded in Houston, Texas in 1984 by the Yuglich Family, Eagle Chair has grown into a trusted name in commercial furniture manufacturing. Under the leadership of Katarina Kac-Statton and Maximilian Kac, we've maintained our commitment to quality, craftsmanship, and customer satisfaction.\n\nOur furniture graces thousands of restaurants, hotels, and hospitality venues across the country. Each piece is a testament to our dedication to excellence and our understanding of the demanding needs of commercial environments.\n\nAs a family-owned business, we take pride in treating every customer like family. Your success is our success, and we're here to support you every step of the way.",
      image_url: "https://images.unsplash.com/photo-1556912172-45b7abe8b7e1?w=800",
      video_url: null,
      cta_text: null,
      cta_link: null,
      cta_style: null,
      extra_data: null,
      display_order: 2,
      is_active: true
    },
    cta: {
      id: 4,
      page_slug: "about",
      section_key: "cta",
      title: "Ready to Work Together?",
      subtitle: null,
      content: "Experience the Eagle Chair difference. Let's create something amazing for your business.",
      image_url: null,
      video_url: null,
      cta_text: "Contact Us",
      cta_link: "/contact",
      cta_style: "primary",
      extra_data: null,
      display_order: 3,
      is_active: true
    }
  },
  contact: {
    hero: {
      id: 5,
      page_slug: "contact",
      section_key: "hero",
      title: "Get in Touch",
      subtitle: "We're here to help with all your commercial furniture needs",
      content: null,
      image_url: null,
      video_url: null,
      cta_text: null,
      cta_link: null,
      cta_style: null,
      extra_data: null,
      display_order: 1,
      is_active: true
    }
  }
};

// Legal Documents - All policies, warranties, terms, and conditions
// Matches LegalDocument model from backend
export const demoLegalDocuments = [
  {
    id: 1,
    document_type: "PRICE_LIST",
    title: "Price List",
    slug: "price-list",
    short_description: "Pricing policies and terms for Eagle Chair products",
    content: `Prices effective January 1, 2020. This Price List supersedes all prior lists and catalogs. We reserve the right to change any price at any time without prior notice. All prices are F.O.B. factory and do not include freight, installation, duties or sales and use tax. Prices are per unit unless otherwise noted. All pricing is subject to change without prior notice and at the sole discretion of Eagle Chair. Possession of this price list does not constitute an offer to sell. All sales are subject to Conditions of Sale.`,
    version: "2020.1",
    effective_date: "January 1, 2020",
    is_active: true,
    display_order: 1
  },
  {
    id: 2,
    document_type: "DIMENSIONS_SIZES",
    title: "Dimensions and Sizes",
    slug: "dimensions-sizes",
    short_description: "Dimensional specifications and tolerances",
    content: `All seating dimensions shown in sales literature are approximate. Due to various fabric buildups, widths can vary as much as 3/4″. We assume no responsibility for overall dimensions unless specific limitations are clearly spelled out on the purchase order. All width and depth dimensions are listed as architectural dimensions, i.e, how much space the item takes in an installation. Arm and seat dimensions are actual, subject to limitations listed above.`,
    is_active: true,
    display_order: 2
  },
  {
    id: 3,
    document_type: "ORDERS",
    title: "Orders",
    slug: "orders",
    short_description: "Order requirements and procedures",
    content: `The following information is required: All orders must be in writing, with quantity and style number, wood or metal frame finish, upholstery selection, routing and collect or prepaid freight, and the desired shipping date. Telephone orders will be taken as a courtesy; however a written-purchase order, clearly marked "CONFIRMATION" must follow immediately. Faxed orders are accepted as a written order. Duplicate orders not marked as "CONFIRMATION" are the responsibility of the customer. Order Acknowledgements will be made for each and every order received, It is the customer's responsibility to check the accuracy of each and every Order Acknowledgement sent by the factory. We will, of course, make every effort to find inadvertent errors, but will execute the order as approved and cannot accept responsibility for errors made by the customer.

Orders cannot be processed until they contain all information required for production. Once all information is received and the order is approved, only then it will be scheduled into production. Accepted orders are subject to the terms and conditions set-forth herein and on our Order Acknowledgement, notwithstanding any variance in terms and conditions set forth on buyer's order form.`,
    is_active: true,
    display_order: 3
  },
  {
    id: 4,
    document_type: "COM_COL_ORDERS",
    title: "C.O.M. / C.O.L. Orders",
    slug: "com-col-orders",
    short_description: "Customer's Own Material and Leather order policies",
    content: `Eagle Chair reserves the right to refuse C.O.M.(Customer's Own Material); in any case all C.O.M. orders will be processed without any responsibility on our part. We require that a C.O.M. sample be submitted prior to receiving merchandise. Explicit instructions as to the direction match up and the correct side of the fabric facing up, must be received by us prior to production. All C.O.M. is to be shipped to us Freight Prepaid and must be marked with the Eagle Chair Order Acknowledgement number, buyer's name and P.O. number. Allow the factory to estimate yardage requirements for all C.O.M. orders. Our normal yardage is based on 54" workable width, plain or small patterns, textures, and reasonable workability in both directions. Materials that have distinct textures, variable densities, stripes, patterns or other factors that may influence pattern layout may require additional yardage. Generally, 20% extra yardage should be included to allow for matching stripes, plaids, or large size patterns. Orders specified with COM or COL material will not be assigned a completion date until the material is received.

Railroading: As this term is often applied erroneously to both the upholstery direction a fabric is applied and to the fabric pattern orientation itself, please clearly specify which way your pattern needs to be applied.

C.O.L. (leather) ORDERS: Same conditions as COM apply to all COL orders. In addition a 10% upcharge over COM pricing will apply to items requiring the COL application.`,
    is_active: true,
    display_order: 4
  },
  {
    id: 5,
    document_type: "MINIMUM_ORDER",
    title: "Minimum Order",
    slug: "minimum-order",
    short_description: "Minimum order quantities and surcharges",
    content: `Seating: Minimum order is 12 pieces, for booth seating minimum order is 12 linear feet. For orders 6 to 12 pieces or 6 to 12 linear feet, add 10% set up charge. For orders less than 6 pieces or 6 linear feet, add 20% set up charge and /or a Special Handling Charge of $250 Net.

Tables: Minimum order is 5 pieces. For orders less than 5 pieces add 10% set up charge and the one sheet laminate charge.

Outdoors: Most outdoor does not have a minimum order. Outdoor booth seating follows the same as indoor booth minimum requirements.

Different types of items may be combined to exceed minimum limits. For example 4 barstools, can be combined with 7 chairs and one table. In this example 1 sheet laminate charge will still apply; 10% surcharge would not.`,
    is_active: true,
    display_order: 5
  },
  {
    id: 6,
    document_type: "PAYMENTS",
    title: "Payments and Credit Cards",
    slug: "payments-credit-cards",
    short_description: "Payment methods and credit terms",
    content: `We accept ACHs, wire transfers and company checks. As a manufacturer, not a retailer, Credit Card payments shall incur the 3% processing fee reflecting our actual costs. Limit for Credit Card payments is $10,000, per order.`,
    is_active: true,
    display_order: 6
  },
  {
    id: 7,
    document_type: "TERMS",
    title: "Payment Terms",
    slug: "payment-terms",
    short_description: "Credit terms and late payment policies",
    content: `Net 30 days when credit granted by Eagle Chair. Customers without an established line of credit are required to place minimum 50% deposit when placing an order, the balance due before shipment. A service charge of 1.5% per month (18%APR) will be added on all past due accounts. In the event that a collection agency, attorney or court must be used to collect, the Customer agrees to pay all fees and costs. Where these terms and conditions conflict with the terms and conditions of the Customer's contract, the terms and conditions herein shall prevail. Terms and conditions not particularly mentioned herein are excluded from the customer's contract and are specifically disclaimed by Eagle Chair. Credit may be established upon receipt of five trade references and one bank reference, subject of approval by our Credit Department.`,
    is_active: true,
    display_order: 7
  },
  {
    id: 8,
    document_type: "TAXES",
    title: "Taxes",
    slug: "taxes",
    short_description: "Tax responsibilities and obligations",
    content: `Any and all taxes which Eagle Chair may be required to pay or collect under any applicable law, existing or future, including but not limited to, regarding the sale, purchase, delivery, use or consumption of any product or material provided or handled by Eagle Chair, shall be sole responsibility of the buyer.

As the condition of sale the buyer shall promptly pay the amount thereof upon demand.`,
    is_active: true,
    display_order: 8
  },
  {
    id: 9,
    document_type: "LEGAL_COSTS",
    title: "Costs and Attorney Fees; Choice of Law; Consent to Jurisdiction",
    slug: "legal-costs-jurisdiction",
    short_description: "Legal fees, governing law, and jurisdiction",
    content: `Buyer will pay all costs, collection agency commissions, expenses, and reasonable attorney fees (including at trial and on appeal) Eagle Chair may incur in any manner of collection of any sums past due. In case of any suit, arbitration, or other proceeding or if buyer becomes the subject of any bankruptcy proceeding (including with respect to any motion for relief from the automatic stay, objection to a plan or reorganization, or confirmation or other similar proceeding), Eagle Chair will be entitled to its costs and attorney fees, whether incurred in the proceeding or in any post-judgment proceeding. Texas law, without resort to its choice of law provisions, will govern. The Buyer consents to the jurisdiction of and venue in any state or federal court located in Harris County, Texas.`,
    is_active: true,
    display_order: 9
  },
  {
    id: 10,
    document_type: "QUOTATIONS",
    title: "Quotations",
    slug: "quotations",
    short_description: "Quote validity period",
    content: `All written quotations are valid for 60 days from date of issue.`,
    is_active: true,
    display_order: 10
  },
  {
    id: 11,
    document_type: "WARRANTY",
    title: "Limited Warranty",
    slug: "limited-warranty",
    short_description: "Product warranty terms and conditions",
    content: `We, (Eagle, or Eagle Chair, or Eagle Chair Inc. or Manufacturer) warranty the original purchaser any product manufactured by us for five years from date of such product is manufactured, or the date product leaves Manufacturer's control, whichever is later, that such product shall under normal single shift use, normal wear and tear, use and operation be free of substantial defects in materials and workmanship.

Items destined for outdoor use are warranted for one year.

This warranty shall be null and void if our product has been repaired or altered by anyone other than the manufacturer. This warranty shall expressly exclude and shall not apply to any Eagle Chair product that has been: installed, used, maintained, modified, repaired or operated in a manner inconsistent with that intended or contemplated by manufacturer; or, damaged because of accident, fire, wind, water or other catastrophic or other sudden unforeseen occurrence, or due to neglect or misuse. In addition, the foregoing warranty shall not apply to any component(s) of the product that is damaged during shipment, distribution, or during unauthorized adjustment, repair or service.

No warranty is issued on upholstery materials; they are covered by warranties, if any, by the upholstery mills. No warranties whatsoever are made by Eagle Chair on C.O.M. or any other upholstery materials supplied by us, as they are covered by separate warranties issued by their manufacturers.

This warranty is in lieu of all other warranties and any obligations, expressed or implied, and Eagle Chair neither assumes nor authorizes any person to accept liability whatsoever on our behalf. Negligence and/or failure to follow maintenance instructions, misuse, freight damage or accidents will make this warranty null and void. Neither does this warranty apply to damage from normal wear and tear such as dents, nicks, scratches, and improper maintenance. Our wood seating is produced for use in indoor environments only. Damage due to exposure to elements of climate, such as salt air, is not covered by this warranty. Even when the Manufacturer has been made aware of the final destination of an order, Eagle Chair is not liable under this warranty, if the merchandise was damaged due to exposure to the elements. Nor shall this warranty apply to furniture that has been exposed to harsh cleaning agents or processes.

Our obligation under the warranty is limited to credit for, or replacement of the defective item, or repairing, at our facility or on-site, at our discretion, any product or part thereof that is found by us not to conform to this Limited Warranty. In no event shall liability under this warranty exceed the original purchase price of the product. Eagle Chair will not assume any labor charges for unauthorized field repairs, any transportation or handling costs, nor rental of replacement furniture. Eagle Chair shall have a reasonable period of time to make such replacements or repairs and all labor associated therewith shall be performed subject to reasonable working conditions. This warranty is effective only if customer gives prompt written notice to Eagle Chair of any alleged defects in the materials or workmanship of the product, which notice shall specifically describe the complained-of problem and shall state the date of sale and the location of the purchase of such complained-of product.

To make a claim under this warranty, contact Eagle Chair for a written Return Authorization Number and further instructions. If Eagle Chair elects to conduct repair or replacement at our facility, then customer shall prepay transportation charges. If returned Products are repaired or replaced pursuant to the terms of this Limited Warranty, then manufacturer will prepay transportation charges back to customer; otherwise, customer shall pay transportation charges in both directions. Under no circumstance will manufacturer pay for freight charges outside of the forty- eight (48) contiguous United States.

This warranty may be voided if proper maintenance procedures are not followed.

CANE & RUSH SEATS: Warranty does not cover cane or rush seats, nor do we recommend use of cane or rush seats for commercial use. All of Eagle Chair products, unless specifically labeled, are for indoor use only; any damage caused by exposure to elements will void this warranty immediately as will any exposure to any harsh, acidic or caustic agents or elements. Only items specifically described and labeled as designed for outdoor use, such as OUTDOOR aluminum chairs, barstools and tables are covered under this warranty for 1 year.`,
    is_active: true,
    display_order: 11
  },
  {
    id: 12,
    document_type: "FLAMMABILITY",
    title: "Flammability Specification",
    slug: "flammability-specification",
    short_description: "Fire safety and flammability standards",
    content: `We use high density foam, meeting California Technical Bulletin 117-2013 flammability specifications in every upholstered seat or back produced by us. This component and most of other components meet or exceed technical and other common standards. However, due to differences in technical specifications, regulatory requirements and/or laws in different states (such as California 133) or different countries, should a product be required to meet certain specifications or if a certification is required, please specify the particular needs prior to placing an order to the factory. Such a requirement may result in an additional upcharge.

Failure to state these requirements will be considered equivalent to a signed waiver.`,
    is_active: true,
    display_order: 12
  },
  {
    id: 13,
    document_type: "CUSTOM_FINISHES",
    title: "Custom and To-Match Finishes",
    slug: "custom-finishes",
    short_description: "Custom finish options and requirements",
    content: `In order to keep our manufacturing costs and prices as reasonable as possible, Eagle Chair has standardized the finishes to several water based stains; however, on most wood items we are capable of finishing to match, or as specified, for an additional modest up charge. The customer, in writing prior to production, must approve a sample color chip from the factory. All metal items are powder coated or plated. All items that are powder coated can be furnished in virtually any color. A surcharge may apply depending on quantity. If any order is to match a previous order, it must be clearly stated. Please supply original invoice number and date.`,
    is_active: true,
    display_order: 13
  },
  {
    id: 14,
    document_type: "PARTIAL_SHIPMENTS",
    title: "Partial Shipments",
    slug: "partial-shipments",
    short_description: "Partial shipment policy",
    content: `We reserve the right to make partial shipments, invoice these shipments, and to be paid as the invoices become due.`,
    is_active: true,
    display_order: 14
  },
  {
    id: 15,
    document_type: "STORAGE",
    title: "Storage",
    slug: "storage",
    short_description: "Storage fees and conditions",
    content: `When merchandise is ready as per purchase order and the buyer is not ready to accept the shipment, we reserve the right to transfer goods to storage. Costs of transfer and storage will be charged to the buyer and we will deem such date of transfer as date of shipping and invoice on the same date. Should the factory elect to store the goods in one of our own warehouses, the above procedures and charges will apply.`,
    is_active: true,
    display_order: 15
  },
  {
    id: 16,
    document_type: "RETURNS",
    title: "Returns",
    slug: "returns",
    short_description: "Return authorization and restocking policy",
    content: `No returns will be accepted unless the item to be returned has been authorized for return by us in writing. All returns will be subject to a restocking charge. No Authorized Returns will be accepted unless shipped prepaid and accompanied by a Return Authorization Number. CUSTOM ORDERS ARE NOT RETURNABLE.`,
    is_active: true,
    display_order: 16
  },
  {
    id: 17,
    document_type: "CANCELLATIONS",
    title: "Cancellations",
    slug: "cancellations",
    short_description: "Order cancellation policy",
    content: `As all of our production is custom made to order, orders once started cannot be cancelled. Orders scheduled for production, ie where materials and components have been already ordered and/or have been paid for, but the actual order not gone into production, are still liable for the costs of these materials and components.`,
    is_active: true,
    display_order: 17
  },
  {
    id: 18,
    document_type: "MAINTENANCE",
    title: "Maintenance",
    slug: "maintenance",
    short_description: "Product care and maintenance instructions",
    content: `As with any other product, to insure durability, safety, and customer satisfaction, timely and regular maintenance is required. This involves inspecting your furniture, tightening all screws and bolts every month, and cleaning and waxing as necessary. For cleaning wood products we suggest Old English Dark Oil on the darker finishes such as walnut, mahogany, etc.; on the light finishes such as natural, maple or cherry, we recommend lemon oil; NEVER, EVER USE WATER. The dealer and any other specifying and reselling party must instruct the user about the maintenance requirements and that the chairs and barstools should only be used for sitting: THEY ARE NOT TO BE USED AS STOOLS, LADDERS, OR COAT HANGERS. The latter will affect the balance of the product.

Wood: Particular care should be taken in inspecting the seat rails and bottoms, and front side rails for loose joints and fasteners. A loose joint will transfer all forces on other joints, which will also loosen, with the resultant possibility of the chair/barstool collapsing.

Inspections should become more frequent when chairs are over 3 years old, or whenever signs of frame weakness arise. Examinations must include, but not be limited to, structural joints, corner blocks, screws, fasteners, welds and any areas of stress. Missing leg glides or loose casters must be replaced. Chairs exhibiting any of the above should be removed from service and repaired to original standard, or discarded.

ANY CHAIR OR BARSTOOL WITH A LOOSE JOINT OR A FASTENER MUST BE TAKEN OUT OF SERVICE IMMEDIATELY.

Steel: Chrome can be cleaned with good automotive chrome cleaner. For touch up of small areas, rust-inhibiting chrome paint can be used. For powder/epoxy finishes use a mild solution of soap and water. Use automotive touch-up paint for small damaged areas after the preparing the area by sanding.

Metal frame members bent at different angles from original are an indication of over stressing and could render frame unstable or prone to sudden failure.

Chairs with bent frames should be removed from service; do not attempt to straighten. Rebending frames may further weaken metal and increase potential for failure.

Upholstery: Always work from edges to the center to avoid a halo effect.

Vinyl can be cleaned with good automotive vinyl cleaner. Prompt action is necessary, as some types of stains, such as ink, can become permanent if allowed to set.

Suede type vinyl should be not be rubbed but dabbed with mild solution of soap and water.

Fabric – because of differences in materials used in our fabrics, it is necessary to determine the type of yarn used to manufacture the particular fabric and then use the recommended cleaning agent for that type of fabric. Use of the wrong agent may result in damage to the fabric.

21/7TM or Krypton®: to remove excess soiling, immediately blot area with dry cloth. To remove remaining stain, spray a light mist of soap solution and rub gently in circular motion with a clean cloth or a toothbrush. Pat dry with cloth. Do not use petroleum or alcohol based cleaners.

Routine Care For Laminate: To clean the surface, use a damp cloth or sponge and a mild soap or detergent. Difficult stains such as coffee or tea can be removed using a mild household cleaner/detergent and a soft bristle brush, repeating as necessary. If a stain persists, use a paste of baking soda and water and apply with a soft bristled brush. Light scrubbing for 10 to 20 strokes should remove most stains. Although baking soda is a low abrasive, excessive scrubbing or exerting too much force could damage the decorative surface, especially if it has a gloss finish. Stubborn stains that resist any of the above cleaning methods may require the use of undiluted household bleach or nail polish remover. Apply the bleach or nail polish remover to the stain and let stand no longer than two minutes. Rinse thoroughly with warm water and wipe dry. This step may be repeated if the stain appears to be going away and the color of the laminate has not been affected.

WARNING: Prolonged exposure of the laminate surface to bleach will cause discoloration. Special Tips: always rinse laminate surfaces after cleaning! Failure to rinse after cleaning is the single greatest cause of damage to a laminate surface. If even a small amount of cleaning solution remains on the surface, moisture from cups or dishes can reactivate it and result in permanently etched scars. Always rinse thoroughly with clean water and a clean cloth. Sharp knives can damage the surface of laminate. To keep the surface beautiful, use a non-oily furniture spray. Furniture polish can also help hide fine scratches in the surface.

Table Bases: Particular care should be taken in inspecting for missing glides and loose table bases. A loose base can be tightened by flipping the base upside down upon a soft surface, protecting the table top, making sure that all parts are aligned and fitted properly, the center nut holding the tie rod can now be secured. Always pick up table bases before moving them. Sliding table bases will cause damage to the table glides. Use at least two people to lift a table. Some sizes may require more.

CASTERS: Casters are not recommended on hard surfaced floors. Chairs may move too freely and lead to injury. Chairs with four casters are not recommended for elderly care or for persons with impaired ability to seat themselves.

BOOTHS: With few exceptions all of our booth designs can be made to special sizes, angles, with various trims, treatments, cutouts, seats, shapes, custom sewing, etc. All circles and banquettes are standard with unfinished outside backs – if some are to be finished – please specify and add cost of outside back panels. On any special orders, always send plan with "Written In" dimensions. Eagle Chair will also custom manufacture to your specifications. Please allow sufficient time to finalize the design and fabrication of special units.`,
    is_active: true,
    display_order: 18
  },
  {
    id: 19,
    document_type: "SPECIAL_SERVICE",
    title: "Special Service",
    slug: "special-service",
    short_description: "Special repair and refurbishment services",
    content: `In order to show our appreciation to our loyal customers we will reglue, rescrew and repin any of the chairs manufactured by us, at no charge to the customer, except for the reupholstery if requested. The freight to and from the plant will be responsibility of the customer.`,
    is_active: true,
    display_order: 19
  },
  {
    id: 20,
    document_type: "SHIPMENTS_DAMAGE",
    title: "Shipments and Damage Claims",
    slug: "shipments-damage-claims",
    short_description: "Shipping terms and damage claim procedures",
    content: `Shipping will be "best way" unless carrier preference is indicated and only as long as the carrier indicated serves Company's point of shipment. We do not assume any responsibility for any differences in freight charges. We are not responsible for any damage in transit, or any delay in transit. Any variances as to quantities or specifications of goods received must be communicated to us within three days of receipt of merchandise. Any shortage, or sign of damage, MUST be noted on the freight bill before accepting delivery. If damage is discovered after delivery, purchaser MUST notify carrier at once to request inspection and claim instructions within FIVE days of receipt of shipment. Refusal to accept goods from carrier does not relieve purchaser of responsibility of filing claims with carrier or of payment for the merchandise. Title and risk of loss of the products shall pass to the customer upon Eagle Chair delivery to the carrier. All goods are shipped FOB factory and are the property of purchaser upon our transfer of merchandise to carrier. Therefore, if shipment is damaged, buyer must both file a claim and look to carrier for adjustment without relieving customer of his obligations for the goods shipped. Eagle Chair assumes no responsibility for warehousing or demurrage charges when the Customer is specified routing. Customer pickups must be arranged in advance by contacting Eagle Shipping Department.`,
    is_active: true,
    display_order: 20
  },
  {
    id: 21,
    document_type: "FREIGHT_CLASSIFICATION",
    title: "Freight Shipment Classification",
    slug: "freight-classification",
    short_description: "Freight classification and rates",
    content: `Our common carrier LTL (less than a truckload) shipments are use the National MFC #80580 classification, determined by density per the general guidelines noted below:

- Assembled Wood Chairs: Class 250
- Aluminum Chairs: Class 300
- Steel Chairs: Class 250
- Counter Seats: Class 250
- Booths & Soft Seating: Class 200
- Assembled Table Bases: Class 125
- Tables: Class 70

General guidelines, subject to actual dimensions. Freight quotes, due to rapid changes by freight carriers, are primarily informational, valid for 30 days and are definitely subject to change prior to shipment.`,
    is_active: true,
    display_order: 21
  },
  {
    id: 22,
    document_type: "IP_DISCLAIMER",
    title: "Intellectual Property Disclaimer",
    slug: "intellectual-property-disclaimer",
    short_description: "IP indemnification and customer responsibilities",
    content: `When an order is for product not in its standard line, Eagle Chair sole responsibility is to provide the product meeting the specifications of the customer or its agents and representatives. Eagle Chair specifically disclaims any obligation to indemnify or defend customer, property owners, architects, designers, specifiers, customer agents or others for claims alleging infringement of trademarks, copyrights, patents, designs or any other issues collectively described as intellectual property. Customer confirms that it is the originator of specifications for this product and has clear title to said intellectual property and will indemnify and hold harmless Eagle Chair for any claims, liabilities and expenses (including expenses and reasonable attorney fees) in connection with such infringement.`,
    is_active: true,
    display_order: 22
  },
  {
    id: 23,
    document_type: "IP_ASSIGNMENT",
    title: "Intellectual Property Assignment",
    slug: "intellectual-property-assignment",
    short_description: "Eagle Chair intellectual property rights",
    content: `Eagle Chair's photography, graphics, text, literature, patents, trademarks, guides, instructions, layouts and product designs are defined as Intellectual Property. This Intellectual Property may not be copied; reproduced; modified; published; displayed; uploaded; posted; reposted; distributed; transmitted; used to create a derivative work, or otherwise used for public or commercial purposes without Eagle Chair's prior written permission. This Intellectual Property is owned by Eagle Chair, except as otherwise expressly stated herein, users are not granted any license to use, or right in, any such Intellectual Property.

Nothing in Eagle Chair literature, pricelist or website shall be deemed to grant any license or right in, or to any patent, copyright, trademark, trade secret or other proprietary right of Eagle Chair.

Eagle Chair is presently holding, is licensed, or is assigned the following exclusive patents:

Patent Numbers | Eagle Chair Model #
- US D660,620 S | 3360
- US D699,493 S | 6541
- US D699,494 S | 6541
- US D739,663 S | 6242
- US D781,603 S | 6880
- US D828,603 S | 6546
- US D834,345 S | 6627
- US D834,359 S | 6542
- US D834,847 S | 6628`,
    is_active: true,
    display_order: 23
  },
  {
    id: 24,
    document_type: "CONDITIONS_OF_SALE",
    title: "Conditions of Sale",
    slug: "conditions-of-sale",
    short_description: "Complete terms and conditions of sale",
    content: `Every Sales Order is entered into the Eagle Chair Inc system with prior approval from the Buyer. It is the customer's responsibility to check the accuracy of each and every Order Acknowledgement sent. Orders cannot be processed until they contain all information required for production.

Applicant agrees to be bound by each of the following terms and conditions:

1. TERMS OF SALE AND CREDIT. All orders are subject to acceptance by Eagle Chair, Inc. All goods will be sold F.O.B. Houston plant unless otherwise provided on the invoice. All prices are exclusive of sales taxes, shipping, and handling; all such taxes and charges will be paid by Applicant. Eagle Chair may immediately terminate Applicant's ability, if any, to purchase goods on credit at any time at Eagle Chair's sole discretion.

2. TERMS OF PAYMENT. Payment for all goods sold on open account will be due and payable pursuant to the terms and conditions stated on each invoice. Any sums not paid within the invoice terms are subject to a service charge of 1.5% per month or the maximum rate permitted by law, whichever is lower. Applicant will be ineligible for any discount if Applicant has an overdue balance. Failure to promptly pay any invoice according to its terms will constitute a default by Applicant under all invoices issued by Eagle Chair. Such a default will entitle Eagle Chair to withhold and reclaim goods described in all invoices and purchase orders.

3. PRICES. Prices are subject to change without notice. All orders received by Eagle Chair are accepted by Order/Acknowledgement. Orders will be invoiced at the prices shown in Order Acknowledgment. The amount reflected in any Eagle Chair invoice will be deemed accepted and conclusively binding upon Applicant as an account stated unless Applicant notifies Eagle Chair in writing or by fax within 24 hours days after the date of the Order/Acknowledgement.

4. SECURITY AGREEMENT. To secure payment and performance of all of Eagle Chair's current and future obligations to Eagle Chair, Applicant grants to Eagle Chair a security interest in all inventory and equipment that Applicant has purchased or will at any time in the future purchase from Supplier, and in all accounts, other forms of receivables, documents, instruments, returns, and general intangibles that are related in any way to the inventory and equipment. A copy of this Application may be filed as a financing statement, in which case Applicant is the debtor and Eagle Chair, Inc. is the secured party.

5. LIMITED WARRANTY. We warranty to the original purchaser any product manufactured by us for three years from date of purchase under normal use. Some metal frames, as shown in the price list, are warranted for five years. No warranty is issued on upholstery materials; they are covered by warranties, if any, by the upholstery mills. No warranties whatsoever are made on C.O.M. This warranty shall be null and void if our product has been repaired or altered by anyone other than the manufacturer. This warranty is in lieu of all other warranties and any obligations, expressed or implied, and Eagle Chair neither assumes nor authorizes any person to accept liability whatsoever on our behalf. Negligence and/or failure to follow maintenance instructions will make this warranty null and void. Warranty does not cover cane seats, nor do we recommend use of cane seats for commercial use. All of Eagle Chair products unless specifically labeled are for indoor use only; any damage caused by exposure to elements will void this warranty immediately as will any exposure to any harsh, acidic or caustic agents or elements. Only items specifically described and labeled as designed for outdoor use, such as OUTDOOR aluminum chairs, barstools and tables are covered under this warranty for 1 year. Our obligation under the warranty is limited to credit for, or replacement of the defective item. In no event shall liability under this warranty exceed the original purchase price of the product. Eagle Chair will not assume labor charges for unauthorized field repairs. To make a claim under this warranty, contact Eagle Chair for a written Return Authorization Number and further instructions. This warranty may be voided if proper maintenance procedures are not followed.

6. FORCE MAJEURE. If a delivery date is specified, that date will be extended to the extent that delivery is delayed by reason of fire, flood, war, riot, strike, natural disaster, or any other event.

7. SHIPMENTS AND DAMAGE CLAIMS. Shipping will be "best way" unless carrier preference is indicated and only as long as the carrier indicated serves Company point of shipment. Eagle Chair does not assume any responsibility for any differences in freight charges. We are not responsible for any damage in transit, or any delay in transit. Any variances as to quantities or specifications of goods received must be communicated to Eagle Chair within three days of receipt of merchandise. Any shortage, or sign of damage, MUST be noted on the freight bill before accepting delivery. If damage is discovered after delivery, purchaser MUST notify carrier at once to request inspection and claim instructions within five days of receipt of shipment. Refusal to accept goods from carrier does not relieve purchaser of responsibility of filing claims with carrier or of payment for the merchandise. Title and risk of loss of the products shall pass to the customer upon Eagle Chair delivery to the carrier. All goods are property of purchaser upon our transfer of merchandise to carrier.

8. STORAGE. When merchandise is ready as per Purchase Order and the buyer is not ready to accept the shipment, we reserve the right to transfer goods to storage. Costs of transfer and storage will be charged to the buyer and we will deem such date of transfer as date of shipping and invoice on the same date. Should the factory elect to store the goods in one of our own warehouses, the above procedures and charges will apply.

9. MISCELLANEOUS. Any portion of this Application that is found to be unenforceable will not invalidate the remainder of this Application. Any delay in enforcing or any failure to enforce any provision of this Application will not be deemed a waiver of any other or subsequent breach of this Application unless the waiver is in writing and is signed by an officer of Eagle Chair, Inc. Caption headings are for convenience of reference only and will not affect the interpretation of this Application. Applicant has had the opportunity to consult with an attorney with respect to this Application and has either reviewed this Application with its attorney or waived the right. Therefore, ambiguous terms will be construed without regard to authorship. The terms "including" and "includes" are not limiting in any way.

10. COSTS AND ATTORNEY FEES; CHOICE OF LAW; CONSENT TO JURISDICTION. Applicant will pay all costs, collection agency commissions, expenses, and reasonable attorney fees (including at trial and on appeal) Eagle Chair, Inc. may incur in any manner of collection of any sums past due. If this Application becomes the subject of any suit, arbitration, or other proceeding or if Applicant becomes the subject of any bankruptcy proceeding (including with respect to any motion for relief from the automatic stay, objection to a plan or reorganization, or confirmation or other similar proceeding), Eagle Chair, Inc. will be entitled to its costs and attorney fees, whether incurred in the proceeding or in any post-judgment proceeding. Texas law, without resort to its choice of law provisions, will govern. The parties consent to the non-exclusive jurisdiction of and venue in any state or federal court located in Harris County, Texas. This means that Eagle Chair may file suit against Applicant in any court located in Harris County, Texas.

11. ENTIRE AGREEMENT; MODIFICATIONS. This Application, together with Supplier's invoices, contains the entire understanding between the parties. Applicant acknowledges that there are no other terms, conditions, warranties, or representations other than those contained in this Application and Eagle Chair's invoices. No supplement, modification, or amendment of this Application will be binding unless it is executed in writing by an officer of EagleChair, Inc.`,
    is_active: true,
    display_order: 24
  },
  {
    id: 25,
    document_type: "PRIVACY_POLICY",
    title: "Privacy Policy",
    slug: "privacy-policy",
    short_description: "How we collect, use, and protect your personal information",
    content: `Last Updated: October 28, 2025

Eagle Chair Inc. ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or engage with our services.

1. INFORMATION WE COLLECT
We collect information that you provide directly to us, including:
- Name, company name, email address, phone number
- Billing and shipping addresses
- Payment information (processed securely through third-party providers)
- Communications with our sales representatives
- Quote and order information

2. HOW WE USE YOUR INFORMATION
We use the information we collect to:
- Process your orders and quotes
- Communicate with you about products and services
- Improve our website and customer service
- Send marketing communications (with your consent)
- Comply with legal obligations

3. INFORMATION SHARING
We do not sell your personal information. We may share your information with:
- Service providers who assist in our operations
- Shipping carriers for order fulfillment
- Legal authorities when required by law

4. DATA SECURITY
We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

5. YOUR RIGHTS
You have the right to:
- Access your personal information
- Correct inaccurate data
- Request deletion of your data
- Opt-out of marketing communications
- Lodge a complaint with a supervisory authority

6. COOKIES
We use cookies and similar tracking technologies to enhance your experience on our website. You can control cookie preferences through your browser settings.

7. CALIFORNIA PRIVACY RIGHTS
California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect and the right to request deletion of personal information.

8. CHILDREN'S PRIVACY
Our services are not directed to children under 13, and we do not knowingly collect personal information from children.

9. INTERNATIONAL TRANSFERS
Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers.

10. CHANGES TO THIS POLICY
We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.

11. CONTACT US
If you have questions about this Privacy Policy, please contact us at:
Eagle Chair Inc.
Houston, Texas
Email: info@eaglechair.com
Phone: (Contact for phone number)`,
    is_active: true,
    display_order: 25
  }
];


