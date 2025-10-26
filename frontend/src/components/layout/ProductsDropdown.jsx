import { Link } from 'react-router-dom';

const ProductsDropdown = () => {
  const categories = [
    {
      title: 'Chairs',
      slug: 'chairs',
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=1000&fit=crop',
      items: [
        { name: 'Wood Chairs', category: 'chairs', subcategory: 'Wood' },
        { name: 'Metal Chairs', category: 'chairs', subcategory: 'Metal' },
        { name: 'Lounge Chairs', category: 'chairs', subcategory: 'Lounge' },
        { name: 'Arm Chairs', category: 'chairs', subcategory: 'Arm' },
        { name: 'Outdoor Chairs', category: 'chairs', subcategory: 'Outdoor' },
      ],
    },
    {
      title: 'Barstools',
      slug: 'barstools',
      image: 'https://images.unsplash.com/photo-1551298370-9d3d53740c72?w=800&h=1000&fit=crop',
      items: [
        { name: 'Wood Barstools', category: 'barstools', subcategory: 'Wood' },
        { name: 'Metal Barstools', category: 'barstools', subcategory: 'Metal' },
        { name: 'Swivel Barstools', category: 'barstools', subcategory: 'Swivel' },
        { name: 'Backless Barstools', category: 'barstools', subcategory: 'Backless' },
        { name: 'Outdoor Barstools', category: 'barstools', subcategory: 'Outdoor' },
      ],
    },
    {
      title: 'Tables & Bases',
      slug: 'tables',
      image: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800&h=1000&fit=crop',
      items: [
        { name: 'Table Tops', category: 'tables', subcategory: 'Table Tops' },
        { name: 'Table Gallery', category: 'tables', subcategory: 'Table Gallery' },
        { name: 'Edges and Sizing', category: 'tables', subcategory: 'Edges and Sizing' },
        { name: 'Table Bases', category: 'bases', subcategory: '' },
        { name: 'Outdoor Bases', category: 'bases', subcategory: 'Outdoor' },
      ],
    },
    {
      title: 'Booths & Outdoor',
      slug: 'booths',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=1000&fit=crop',
      items: [
        { name: 'Upholstered Booths', category: 'booths', subcategory: 'Upholstered' },
        { name: 'Wooden Booths', category: 'booths', subcategory: 'Wooden' },
        { name: 'Settee Benches', category: 'booths', subcategory: 'Settee' },
        { name: 'Outdoor Seating', category: 'outdoor', subcategory: 'Chairs' },
        { name: 'Outdoor Tables', category: 'outdoor', subcategory: 'Tables' },
      ],
    },
  ];

  return (
    <div className="w-full bg-dark-800/95 backdrop-blur-md">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
        {categories.map((category) => (
          <div key={category.title} className="relative group">
            {/* Full height container with minimum height */}
            <div className="relative h-[500px] sm:h-[600px] overflow-hidden">
              {/* Background Image - Full Height - Clickable */}
              <Link 
                to={`/products?category=${category.slug}`}
                className="absolute inset-0"
              >
                <img
                  src={category.image}
                  alt={category.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1617104678098-de229db51175?w=800&h=1000&fit=crop';
                  }}
                />
              </Link>
              
              {/* Dark overlay - stronger for better button visibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80 group-hover:from-black/50 group-hover:via-black/60 group-hover:to-black/75 transition-all duration-300 pointer-events-none"></div>
              
              {/* Content Container - Full Height with Flex */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8 pointer-events-none">
                {/* Category Title at Top */}
                <div>
                  <h3 className="text-white font-bold text-2xl sm:text-3xl mb-2 drop-shadow-lg">
                    {category.title}
                  </h3>
                  <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                </div>
                
                {/* Category Navigation Links - Overlaid on Image at Bottom */}
                <div className="space-y-1 pointer-events-auto">
                  {category.items.map((item) => {
                    const url = item.subcategory 
                      ? `/products?category=${item.category}&subcategory=${encodeURIComponent(item.subcategory)}`
                      : `/products?category=${item.category}`;
                    
                    return (
                      <Link
                        key={item.name}
                        to={url}
                        className="block w-full text-left px-2 py-2 text-white/90 hover:text-white hover:translate-x-2 transition-all duration-200 text-sm font-medium"
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                  
                  {/* View All link with distinct styling */}
                  <Link
                    to={`/products?category=${category.slug}`}
                    className="block w-full text-left px-2 py-2 text-primary-400 hover:text-primary-300 hover:translate-x-2 transition-all duration-200 text-sm font-bold mt-3"
                  >
                    View All {category.title} →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsDropdown;

