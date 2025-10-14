import { Link } from 'react-router-dom';

const ResourcesDropdown = () => {
  const resources = [
    { name: 'Product Catalog', path: '/resources/catalog', icon: '📘' },
    { name: 'Fabric Swatches', path: '/resources/fabrics', icon: '🎨' },
    { name: 'Wood Finishes', path: '/resources/finishes', icon: '🪵' },
    { name: 'Installation Guides', path: '/resources/guides', icon: '📖' },
    { name: 'CAD Files', path: '/resources/cad', icon: '📐' },
    { name: 'Care Instructions', path: '/resources/care', icon: '🧹' },
  ];

  return (
    <div className="py-2">
      {resources.map((resource) => (
        <Link
          key={resource.path}
          to={resource.path}
          className="flex items-center px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors"
        >
          <span className="mr-3 text-lg">{resource.icon}</span>
          {resource.name}
        </Link>
      ))}
    </div>
  );
};

export default ResourcesDropdown;


