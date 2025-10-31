import { Link } from 'react-router-dom';
import { Book, Palette, Building, Spool, PocketKnife, BookImage, Handshake } from 'lucide-react';

const ResourcesDropdown = () => {
  const resources = [
    { name: 'Virtual Catalogs', path: '/virtual-catalogs', icon: <BookImage /> },
    { name: 'Wood Finishes', path: '/resources/woodfinishes', icon: <Palette /> },
    { name: 'Laminates', path: '/resources/laminates', icon: <Building /> },
    { name: 'Upholstery Fabrics', path: '/resources/upholstery', icon: <Spool /> },
    { name: 'Hardware', path: '/resources/hardware', icon: <PocketKnife /> },
    { name: 'Guides & CAD Files', path: '/resources/guides', icon: <Book /> },
    { name: 'Seat & Back Terms', path: '/resources/seat-back-terms', icon: <Handshake /> },
  ];

  return (
    <div className="py-2">
      {resources.map((resource) => (
        <Link
          key={resource.path}
          to={resource.path}
          className="flex items-center px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
        >
          <span className="mr-3 text-lg">{resource.icon}</span>
          {resource.name}
        </Link>
      ))}
    </div>
  );
};

export default ResourcesDropdown;


