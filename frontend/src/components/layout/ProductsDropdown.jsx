import { Link } from 'react-router-dom';

const ProductsDropdown = () => {
  const categories = [
    {
      title: 'Indoor Seating',
      image: '/images/categories/chairs.jpg',
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
      image: '/images/categories/tables.jpg',
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
      image: '/images/categories/booths.jpg',
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
      image: '/images/categories/outdoor.jpg',
      items: [
        { name: 'Outdoor Chairs', path: '/products/outdoor/chairs' },
        { name: 'Outdoor Barstools', path: '/products/outdoor/barstools' },
        { name: 'Outdoor Tables', path: '/products/outdoor/tables' },
        { name: 'Outdoor Bases', path: '/products/outdoor/bases' },
      ],
    },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-4 gap-6">
        {categories.map((category) => (
          <div key={category.title} className="space-y-3">
            <div className="relative h-32 rounded-lg overflow-hidden mb-2">
              <img
                src={category.image}
                alt={category.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '/placeholder-category.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end">
                <h3 className="text-dark-50 font-semibold p-3">{category.title}</h3>
              </div>
            </div>
            <ul className="space-y-2">
              {category.items.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="text-sm text-dark-100 hover:text-primary-500 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsDropdown;


