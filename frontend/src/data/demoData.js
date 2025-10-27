// Demo mode flag - set to false to use real API
// This is also controlled by VITE_DEMO_MODE environment variable
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

// Demo Products - Based on actual Eagle Chair products
export const demoProducts = [
  // ===== CHAIRS - WOOD =====
  {
    id: 1,
    name: "Model 6010 Wood Chair",
    slug: "model-6010-wood-chair",
    model_number: "6010",
    category: "chairs",
    subcategory: "Wood",
    type: "Dining Chair",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 89.99,
    priceRange: { min: 89.99, max: 129.99 },
    short_description: "Classic European beech wood dining chair with upholstered seat.",
    full_description: "European Alpine beech construction with FSC certification. Commercial-grade design perfect for restaurants and dining spaces.",
    description: "Classic European beech wood dining chair with upholstered seat. FSC certified sustainable wood.",
    image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2013/04/6010V-antiqued-2015-v345-copy.png",
    ],
    width: 18,
    depth: 20,
    height: 36,
    seat_height: 18,
    weight: 12,
    frame_material: "European Alpine Beech",
    features: [
      "FSC certified European beech",
      "Commercial-grade construction",
      "Multiple finish options",
      "Upholstered seat available"
    ],
    customizations: {
      finishes: ["Natural", "Walnut", "Espresso", "Antique", "Cherry"],
      fabrics: ["Commercial Vinyl", "Grade A Fabric"],
      colors: ["Black", "Brown", "Tan", "Gray"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    isNew: false,
    featured: true,
    is_outdoor_suitable: false,
  },
  {
    id: 2,
    name: "Model 6016 Wood Chair",
    slug: "model-6016-wood-chair",
    model_number: "6016",
    category: "chairs",
    subcategory: "Wood",
    type: "Dining Chair",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 95.99,
    priceRange: { min: 95.99, max: 139.99 },
    short_description: "European beech wood chair with elegant design.",
    description: "Premium European beech construction with commercial-grade durability. Perfect for upscale dining establishments.",
    image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg",
    images: ["https://www.eaglechair.com/wp-content/uploads/2013/04/6016P-v87.jpg"],
    seat_height: 18,
    weight: 14,
    frame_material: "European Alpine Beech",
    customizations: {
      finishes: ["Natural", "Walnut", "Cherry", "Mahogany"],
      fabrics: ["Commercial Vinyl", "Grade A Fabric"],
      colors: ["Black", "Brown", "Tan"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    featured: true,
    is_outdoor_suitable: false,
  },
  {
    id: 3,
    name: "Model 6020 Wood Chair",
    slug: "model-6020-wood-chair",
    model_number: "6020",
    category: "chairs",
    subcategory: "Wood",
    type: "Dining Chair",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 92.99,
    priceRange: { min: 92.99, max: 135.99 },
    short_description: "Classic vertical slat back design with European beech construction.",
    description: "Premium European Alpine beech dining chair with traditional vertical slat back. FSC certified sustainable wood, commercial-grade durability.",
    image: "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v31.jpg",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v31.jpg",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v32.jpg",
    images: ["https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v31.jpg", "https://www.eaglechair.com/wp-content/uploads/2013/04/6020P-v32.jpg"],
    seat_height: 18,
    weight: 15,
    frame_material: "European Alpine Beech",
    customizations: {
      finishes: ["Natural", "Walnut", "Cherry", "Dark Stain"],
      fabrics: ["Wood Seat", "Padded Seat"],
      colors: ["Natural", "Brown", "Black"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    featured: false,
    is_outdoor_suitable: false,
  },
  {
    id: 4,
    name: "Model 6088 Wood Chair",
    slug: "model-6088-wood-chair",
    model_number: "6088",
    category: "chairs",
    subcategory: "Wood",
    type: "Dining Chair",
    tags: ["Commercial Grade", "European Beech", "Indoor", "Wine Cellar"],
    price: 99.99,
    priceRange: { min: 99.99, max: 149.99 },
    short_description: "Elegant curved back design, perfect for wine cellars and upscale dining.",
    description: "European Alpine beech chair with distinctive curved back. FSC certified sustainable wood. Ideal for wine cellars, fine dining, and upscale restaurants.",
    image: "https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png",
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/07/6088P-gray-wine-cellar-v37-copy.png"],
    seat_height: 18,
    weight: 17,
    frame_material: "European Alpine Beech",
    customizations: {
      finishes: ["Gray Stain", "Natural", "Dark Walnut", "Espresso"],
      fabrics: ["Wood Seat", "Padded Seat"],
      colors: ["Gray", "Natural", "Dark Brown", "Black"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    featured: true,
    is_outdoor_suitable: false,
  },

  // ===== CHAIRS - METAL =====

  // ===== BARSTOOLS - WOOD =====
  {
    id: 7,
    name: "Model 5310 Wood Barstool",
    slug: "model-5310-wood-barstool",
    model_number: "5310",
    category: "barstools",
    subcategory: "Wood",
    type: "Bar Stool",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 129.99,
    priceRange: { min: 129.99, max: 179.99 },
    short_description: "European beech barstool with elegant design and FSC certification.",
    description: "Premium European Alpine beech barstool with commercial-grade construction. FSC certified sustainable wood. Perfect for bars, restaurants, and counter seating.",
    image: "https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png",
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/05/5310P-Xanos-antiqued-v3115-copy-e1588268654510.png"],
    seat_height: 30,
    weight: 18,
    frame_material: "European Alpine Beech",
    customizations: {
      finishes: ["Antiqued", "Natural", "Walnut", "Espresso"],
      seatOptions: ["Wood Seat", "Padded Seat"],
      colors: ["Natural", "Brown", "Black"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    featured: true,
    is_outdoor_suitable: false,
  },
  {
    id: 8,
    name: "Model 5311 Wood Barstool",
    slug: "model-5311-wood-barstool",
    model_number: "5311",
    category: "barstools",
    subcategory: "Wood",
    type: "Bar Stool",
    tags: ["Commercial Grade", "European Beech", "Indoor"],
    price: 119.99,
    priceRange: { min: 119.99, max: 169.99 },
    short_description: "European beech barstool with clean design and multiple finish options.",
    description: "FSC certified European Alpine beech barstool with commercial durability. Available with wood or padded seat. Perfect for bars, cafes, and counter seating.",
    image: "https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg",
    images: ["https://www.eaglechair.com/wp-content/uploads/2014/03/5311P-v65-copy.jpg"],
    seat_height: 30,
    weight: 16,
    frame_material: "European Alpine Beech",
    customizations: {
      finishes: ["Natural", "Walnut", "Cherry", "Dark Stain"],
      seatOptions: ["Wood Seat", "Padded Seat"],
      colors: ["Natural", "Brown", "Black"]
    },
    stock_status: "In Stock",
    lead_time_days: 14,
    featured: false,
    is_outdoor_suitable: false,
  },
  // ===== BARSTOOLS - METAL =====
  {
    id: 9,
    name: "Model 4405 Metal Barstool",
    slug: "model-4405-metal-barstool",
    model_number: "4405",
    category: "barstools",
    subcategory: "Metal",
    type: "Bar Stool",
    tags: ["Commercial Grade", "Modern", "Indoor/Outdoor"],
    price: 109.99,
    priceRange: { min: 109.99, max: 149.99 },
    short_description: "Commercial-grade metal barstool with sleek contemporary design.",
    description: "Heavy-duty steel construction with powder-coated finish. Built with exceptional strength for commercial environments. Perfect for bars, restaurants, and cafes.",
    image: "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v81e-e1588692286256.jpg",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v81e-e1588692286256.jpg",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v225-e1588692284793.jpg",
    images: ["https://www.eaglechair.com/wp-content/uploads/2014/03/4405P-v81e-e1588692286256.jpg", "https://www.eaglechair.com/wp-content/uploads/2014/03/4405P.png"],
    seat_height: 30,
    weight: 15,
    frame_material: "Commercial Steel",
    customizations: {
      finishes: ["Black Powder Coat", "Chrome", "Bronze", "Silver"],
      seatOptions: ["Metal Seat", "Padded Seat"],
      colors: ["Black", "Chrome", "Bronze"]
    },
    stock_status: "In Stock",
    lead_time_days: 7,
    featured: true,
    is_outdoor_suitable: true,
  },
  
  // ===== BOOTHS =====
  {
    id: 10,
    name: "Custom Upholstered Booth",
    slug: "custom-upholstered-booth",
    model_number: "Custom Booth",
    category: "booths",
    subcategory: "Upholstered",
    type: "Booth",
    tags: ["Custom", "Commercial Grade", "Indoor"],
    price: 550.00,
    priceRange: { min: 450.00, max: 950.00 },
    short_description: "Custom manufactured booth seating with premium upholstery and solid construction.",
    description: "Eagle Chair manufactures high-quality booths to each order. Custom sizes and configurations available. Solid hardwood frame with commercial-grade upholstery. Singles, doubles, banquettes, L-booths, U-booths, and specialty designs available.",
    image: "https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg",
    images: ["https://www.eaglechair.com/wp-content/uploads/2020/10/8622-48-single-v468-1536x1536.jpg"],
    width: 48,
    seat_height: 18,
    weight: 75,
    frame_material: "Solid Hardwood Frame",
    customizations: {
      styles: ["Single", "Double", "Banquette", "L-Booth", "U-Booth", "Corner"],
      fabrics: ["Commercial Vinyl", "Premium Leather", "Grade A Fabric"],
      colors: ["Black", "Brown", "Burgundy", "Navy", "Gray", "Custom"]
    },
    stock_status: "Made to Order",
    lead_time_days: 35,
    featured: true,
    is_outdoor_suitable: false,
  },
  {
    id: 11,
    name: "Custom Wood-Core Laminate Table Top",
    slug: "custom-wood-core-laminate-table",
    category: "tables",
    subcategory: "Table Tops",
    type: "Table Top",
    tags: ["Custom", "Laminate", "Indoor"],
    price: 195.00,
    priceRange: { min: 145.00, max: 385.00 },
    description: "Custom manufactured wood-core laminated table top. Extremely dense industrial particle board core with high-pressure laminate top and bottom. Any size can be made with various edge options including wood, rubber, aluminum, or padded edges.",
    image: "https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png",
    images: ["https://www.eaglechair.com/wp-content/uploads/2023/05/370-768x762.png"],
    specs: {
      "Available Sizes": "24\"-48\" diameter, 24x24\" to 36x72\" rectangular",
      "Thickness": "1.25\"",
      "Material": "Wood-Core High-Pressure Laminate"
    },
    customizations: {
      sizes: ["24\"", "30\"", "36\"", "42\"", "24x24\"", "30x30\"", "30x48\"", "36x36\"", "Custom"],
      shapes: ["Round", "Square", "Rectangle", "Oval"],
      edges: ["Wood Edge", "Rubber Edge", "Aluminum Edge", "Padded"],
      finishes: ["Natural", "Dark Walnut", "Espresso", "Bayou Oak", "Weathered Barnside"]
    },
    stock_status: "Made to Order",
    lead_time_days: 21,
    is_outdoor_suitable: false,
  },
  {
    id: 12,
    name: "Eagle Chair Table Base",
    slug: "eagle-chair-table-base",
    category: "bases",
    subcategory: "Table Bases",
    type: "Table Base",
    tags: ["Metal", "Commercial Grade", "Indoor"],
    price: 195.00,
    priceRange: { min: 145.00, max: 295.00 },
    description: "Commercial-grade table base with heavy-duty construction. Eagle Chair offers a large selection organized by color, material, type, and series. Suitable for various table top sizes and styles.",
    image: "https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png",
    images: ["https://www.eaglechair.com/wp-content/uploads/2019/01/3T-24-w.4-tube-v486.png"],
    specs: {
      "Base Type": "Various styles available",
      "Height Options": "Standard (29\"), Counter (36\"), Bar (42\")",
      "Material": "Steel or Cast Iron"
    },
    customizations: {
      finishes: ["Black", "Chrome", "Bronze", "White", "Brushed Steel"],
      types: ["Pedestal", "X-Base", "T-Base", "Disc Base"],
      heights: ["Bar Height (42\")", "Counter Height (36\")", "Standard (29\")"]
    },
    stock_status: "In Stock",
    lead_time_days: 7,
    is_outdoor_suitable: true,
  },
  {
    id: 13,
    name: "Outdoor Metal Chair",
    slug: "outdoor-metal-chair",
    category: "outdoor",
    subcategory: "Chairs",
    type: "Outdoor Chair",
    tags: ["Weather Resistant", "Commercial Grade", "Outdoor"],
    price: 99.99,
    priceRange: { min: 89.99, max: 139.99 },
    description: "Weather-resistant metal chair designed for outdoor commercial use. Powder-coated finish withstands the elements. Stackable design for easy storage. Perfect for patios, outdoor dining areas, and cafes.",
    image: "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png",
    imageAngle: "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png",
    imageFront: "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png",
    images: ["https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-anthracite-v719-e1722028636477.png", "https://www.eaglechair.com/wp-content/uploads/2023/10/3245M-Alita-barney-purple-v719.png"],
    specs: {
      "Width": "17\"",
      "Depth": "19\"",
      "Height": "33\"",
      "Seat Height": "18\"",
      "Weight": "12 lbs",
      "Material": "Powder-Coated Steel"
    },
    features: [
      "Weather-resistant powder coating",
      "Commercial-grade construction",
      "Stackable design",
      "UV resistant finish",
      "Indoor/outdoor use"
    ],
    customizations: {
      colors: ["Black", "Silver", "White", "Bronze"],
      seatOptions: ["Metal Seat", "Wood Seat", "Padded"]
    },
    featured: false,
    is_outdoor_suitable: true,
  },
  {
    id: 7,
    name: "Swivel Barstool with Back",
    slug: "swivel-barstool-back",
    category: "Barstools",
    subcategory: "Swivel",
    description: "Comfortable swivel barstool with upholstered back and seat. 360-degree swivel mechanism.",
    image: "https://www.eaglechair.com/wp-content/uploads/2016/02/4305P-47-black.pomegranate-seat-v48.png",
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2016/02/4305P-47-black.pomegranate-seat-v48.png",
    ],
    specs: {
      "Width": "18\"",
      "Depth": "19\"",
      "Height": "45\"",
      "Seat Height": "30\"",
      "Weight": "22 lbs",
      "Material": "Wood & Metal"
    },
    features: [
      "360-degree swivel",
      "Upholstered seat and back",
      "Footrest ring",
      "Commercial-grade mechanism",
      "Multiple finish options"
    ],
    customizations: {
      finishes: ["Natural", "Walnut", "Cherry", "Espresso"],
      fabrics: ["Vinyl", "Leather"],
      colors: ["Black", "Brown", "Gray"]
    },
  },
  {
    id: 8,
    name: "Wooden Booth Bench",
    slug: "wooden-booth-bench",
    category: "Booths",
    subcategory: "Wooden",
    description: "Solid wood booth bench with traditional styling. Perfect for classic restaurant interiors.",
    image: "https://www.eaglechair.com/wp-content/uploads/2015/02/8601-42-single-v296-1024x1024.png",
    images: [
      "https://www.eaglechair.com/wp-content/uploads/2015/02/8601-42-single-v296-1024x1024.png",
    ],
    specs: {
      "Width": "48\"",
      "Depth": "24\"",
      "Height": "36\"",
      "Seat Height": "18\"",
      "Material": "Solid Wood"
    },
    features: [
      "Solid hardwood construction",
      "Traditional design",
      "Durable finish",
      "Custom sizing available",
      "Matching backs available"
    ],
    customizations: {
      finishes: ["Natural Oak", "Dark Walnut", "Cherry", "Mahogany"],
      sizes: ["36\"", "48\"", "60\"", "Custom"]
    },
  },
];

// Demo Categories
export const demoCategories = [
  {
    id: 1,
    name: "Chairs",
    slug: "chairs",
    description: "Commercial-grade chairs for restaurants and dining spaces",
    image: "https://images.unsplash.com/photo-1503602642458-232111445657?w=800",
    subcategories: ["Wood", "Metal", "Lounge", "Outdoor"]
  },
  {
    id: 2,
    name: "Barstools",
    slug: "barstools",
    description: "Stylish and durable barstools for bars and high-top dining",
    image: "https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=800",
    subcategories: ["Wood", "Metal", "Swivel", "Backless", "Outdoor"]
  },
  {
    id: 3,
    name: "Tables",
    slug: "tables",
    description: "Premium table tops in various materials and sizes",
    image: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800",
    subcategories: ["Table Tops", "Table Gallery", "Edges and Sizing"]
  },
  {
    id: 4,
    name: "Bases",
    slug: "bases",
    description: "Sturdy table bases for commercial applications",
    image: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800",
    subcategories: ["By Color", "By Material", "By Type", "Outdoor"]
  },
  {
    id: 5,
    name: "Booths",
    slug: "booths",
    description: "Comfortable booth seating for restaurants",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    subcategories: ["Upholstered", "Wooden", "Settee", "Bar Booths"]
  },
  {
    id: 6,
    name: "Outdoor",
    slug: "outdoor",
    description: "Weather-resistant outdoor furniture",
    image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800",
    subcategories: ["Chairs", "Barstools", "Tables", "Bases"]
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
  logoUrl: "/assets/eagle-chair-logo.png",
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
    { name: "Product Catalog", path: "/resources/catalog" },
    { name: "Fabric Swatches", path: "/resources/fabrics" },
    { name: "Installation Guides", path: "/resources/guides" },
    { name: "CAD Files", path: "/resources/cad" }
  ],
  legal: [
    { name: "Privacy Policy", path: "/privacy" },
    { name: "Terms of Service", path: "/terms" },
    { name: "Shipping Policy", path: "/shipping" },
    { name: "Return Policy", path: "/returns" }
  ]
};

// Page Content (for dynamic sections)
export const demoPageContent = [
  {
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
  },
  {
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
  {
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
  {
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
  },
  {
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
];


