// Demo mode flag - set to false to use real API
// This is also controlled by VITE_DEMO_MODE environment variable
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true' || true;

// Demo Products
export const demoProducts = [
  {
    id: 1,
    name: "Classic Wood Chair",
    slug: "classic-wood-chair",
    category: "Chairs",
    subcategory: "Wood",
    description: "Elegant solid wood dining chair with comfortable upholstered seat. Perfect for restaurants and commercial dining spaces.",
    image: "https://images.unsplash.com/photo-1503602642458-232111445657?w=800",
    images: [
      "https://images.unsplash.com/photo-1503602642458-232111445657?w=800",
      "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800",
    ],
    specs: {
      "Width": "18\"",
      "Depth": "20\"",
      "Height": "36\"",
      "Seat Height": "18\"",
      "Weight": "12 lbs",
      "Material": "Solid Oak"
    },
    features: [
      "Solid hardwood construction",
      "Commercial-grade upholstery",
      "Easy to clean and maintain",
      "Available in multiple finishes",
      "Stackable design"
    ],
    customizations: {
      finishes: ["Natural Oak", "Dark Walnut", "Espresso", "White Wash"],
      fabrics: ["Vinyl", "Leather", "Fabric"],
      colors: ["Black", "Brown", "Gray", "Tan"]
    },
    isNew: true,
    featured: true,
  },
  {
    id: 2,
    name: "Industrial Metal Barstool",
    slug: "industrial-metal-barstool",
    category: "Barstools",
    subcategory: "Metal",
    description: "Modern industrial-style metal barstool with footrest. Durable powder-coated finish for commercial use.",
    image: "https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=800",
    images: [
      "https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=800",
    ],
    specs: {
      "Width": "16\"",
      "Depth": "16\"",
      "Height": "42\"",
      "Seat Height": "30\"",
      "Weight": "15 lbs",
      "Material": "Steel"
    },
    features: [
      "Heavy-duty steel construction",
      "Powder-coated finish",
      "Integrated footrest",
      "Stackable for storage",
      "Indoor/outdoor use"
    ],
    customizations: {
      finishes: ["Matte Black", "Brushed Steel", "Bronze", "White"],
      seatOptions: ["Wood", "Upholstered", "Metal"]
    },
    featured: true,
  },
  {
    id: 3,
    name: "Upholstered Booth Seating",
    slug: "upholstered-booth-seating",
    category: "Booths",
    subcategory: "Upholstered",
    description: "Comfortable upholstered booth seating for restaurants. Custom sizes and fabrics available.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    images: [
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    ],
    specs: {
      "Width": "48\"",
      "Depth": "24\"",
      "Height": "42\"",
      "Seat Height": "18\"",
      "Material": "Hardwood Frame"
    },
    features: [
      "Commercial-grade foam cushioning",
      "Hardwood frame construction",
      "Easy to reupholster",
      "Custom sizes available",
      "Matching tables available"
    ],
    customizations: {
      fabrics: ["Vinyl", "Leather", "Fabric"],
      colors: ["Red", "Black", "Brown", "Gray", "Navy"],
      sizes: ["Single", "Double", "Triple", "Custom"]
    },
    isNew: false,
    featured: true,
  },
  {
    id: 4,
    name: "Round Table Top - Walnut",
    slug: "round-table-top-walnut",
    category: "Tables",
    subcategory: "Table Tops",
    description: "Premium walnut veneer round table top. Available in multiple sizes with various edge profiles.",
    image: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800",
    images: [
      "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800",
    ],
    specs: {
      "Diameter": "36\"",
      "Thickness": "1.25\"",
      "Material": "Walnut Veneer",
      "Weight": "35 lbs"
    },
    features: [
      "Premium walnut veneer",
      "Commercial-grade substrate",
      "Multiple edge profiles available",
      "Water-resistant finish",
      "Pre-drilled for base attachment"
    ],
    customizations: {
      sizes: ["24\"", "30\"", "36\"", "42\"", "48\""],
      edges: ["Square", "Rounded", "Bullnose", "Beveled"],
      finishes: ["Natural", "Dark Walnut", "Espresso"]
    },
  },
  {
    id: 5,
    name: "X-Base Table Base - Black",
    slug: "x-base-table-base-black",
    category: "Bases",
    subcategory: "Table Bases",
    description: "Sturdy X-style table base in powder-coated black. Suitable for tops up to 48\" diameter.",
    image: "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800",
    images: [
      "https://images.unsplash.com/photo-1615066390971-03e4e1c36ddf?w=800",
    ],
    specs: {
      "Base Width": "30\"",
      "Height": "29\"",
      "Material": "Steel",
      "Weight": "45 lbs",
      "Max Top Size": "48\""
    },
    features: [
      "Heavy-duty steel construction",
      "Adjustable glides",
      "Powder-coated finish",
      "Commercial-grade stability",
      "Easy assembly"
    ],
    customizations: {
      finishes: ["Black", "Chrome", "Bronze", "White"],
      heights: ["Bar Height (42\")", "Counter Height (36\")", "Standard (29\")"]
    },
  },
  {
    id: 6,
    name: "Outdoor Aluminum Chair",
    slug: "outdoor-aluminum-chair",
    category: "Outdoor",
    subcategory: "Chairs",
    description: "Weather-resistant aluminum chair designed for outdoor dining. Lightweight yet durable.",
    image: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800",
    images: [
      "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800",
    ],
    specs: {
      "Width": "19\"",
      "Depth": "21\"",
      "Height": "34\"",
      "Seat Height": "18\"",
      "Weight": "8 lbs",
      "Material": "Aluminum"
    },
    features: [
      "Weather-resistant aluminum",
      "UV-resistant powder coating",
      "Lightweight and stackable",
      "Drainage holes",
      "Commercial outdoor grade"
    ],
    customizations: {
      colors: ["Silver", "Black", "White", "Bronze"],
      armOptions: ["With Arms", "Without Arms"]
    },
    isNew: true,
  },
  {
    id: 7,
    name: "Swivel Barstool with Back",
    slug: "swivel-barstool-back",
    category: "Barstools",
    subcategory: "Swivel",
    description: "Comfortable swivel barstool with upholstered back and seat. 360-degree swivel mechanism.",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
    images: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800",
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
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    images: [
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
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
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    title: "Modern Restaurant Interior",
    category: "Restaurants"
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800",
    title: "Classic Dining Setup",
    category: "Dining"
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
    title: "Bar Area",
    category: "Bars"
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800",
    title: "Outdoor Patio",
    category: "Outdoor"
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
    phone: "(XXX) XXX-XXXX",
    email: "info@eaglechair.com",
    address: "Houston, TX"
  }
};


