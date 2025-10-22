import { Link } from 'react-router-dom';

const ProductsDropdown = () => {
  const categories = [
    {
      title: 'Indoor Seating',
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800&h=1000&fit=crop',
      items: [
        { name: 'Wood Chairs', path: '/products/chairs/wood' },
        { name: 'Metal Chairs', path: '/products/chairs/metal' },
        { name: 'Lounge Chairs', path: '/products/chairs/lounge' },
        { name: 'Wood Barstools', path: '/products/barstools/wood' },
        { name: 'Metal Barstools', path: '/products/barstools/metal' },
        { name: 'Swivel Barstools', path: '/products/barstools/swivel' },
      ],
    },
    {
      title: 'Tables & Bases',
      image: 'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?w=800&h=1000&fit=crop',
      items: [
        { name: 'Table Tops', path: '/products/tables/tops' },
        { name: 'Table Gallery', path: '/products/tables/gallery' },
        { name: 'Table Edges', path: '/products/tables/edges' },
        { name: 'Table Bases', path: '/products/bases' },
        { name: 'Outdoor Bases', path: '/products/bases/outdoor' },
      ],
    },
    {
      title: 'Booths & Benches',
      image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=1000&fit=crop',
      items: [
        { name: 'Upholstered Booths', path: '/products/booths/upholstered' },
        { name: 'Wooden Booths', path: '/products/booths/wooden' },
        { name: 'Settee Benches', path: '/products/booths/settee' },
        { name: 'Bar Booths', path: '/products/booths/bar' },
        { name: 'Benches', path: '/products/benches' },
        { name: 'Ottomans', path: '/products/ottomans' },
      ],
    },
    {
      title: 'Outdoor Patio',
      image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=1000&fit=crop',
      items: [
        { name: 'Outdoor Chairs', path: '/products/outdoor/chairs' },
        { name: 'Outdoor Barstools', path: '/products/outdoor/barstools' },
        { name: 'Outdoor Tables', path: '/products/outdoor/tables' },
        { name: 'Outdoor Bases', path: '/products/outdoor/bases' },
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
              {/* Background Image - Full Height */}
              <img
                src={category.image}
                alt={category.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1617104678098-de229db51175?w=800&h=1000&fit=crop';
                }}
              />
              
              {/* Dark overlay - stronger for better button visibility */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/80 group-hover:from-black/50 group-hover:via-black/60 group-hover:to-black/75 transition-all duration-300"></div>
              
              {/* Content Container - Full Height with Flex */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                {/* Category Title at Top */}
                <div>
                  <h3 className="text-white font-bold text-2xl sm:text-3xl mb-2 drop-shadow-lg">
                    {category.title}
                  </h3>
                  <div className="w-16 h-1 bg-primary-500 rounded-full"></div>
                </div>
                
                {/* Category Navigation Links - Overlaid on Image at Bottom */}
                <div className="space-y-1">
                  {category.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="block w-full text-left px-2 py-2 text-white/90 hover:text-white hover:translate-x-2 transition-all duration-200 text-sm font-medium"
                    >
                      {item.name}
                    </Link>
                  ))}
                  
                  {/* View All link with distinct styling */}
                  <Link
                    to={`/products?category=${category.title.toLowerCase().replace(/\s+/g, '-')}`}
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


