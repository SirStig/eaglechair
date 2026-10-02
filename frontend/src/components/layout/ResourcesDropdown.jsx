import { Link } from 'react-router-dom';
import { PRODUCT_KNOWLEDGE_PAGES } from '../../config/productKnowledge';

const ResourcesDropdown = () => (
  <div className="py-2">
    {PRODUCT_KNOWLEDGE_PAGES.map(({ key, name, path, icon: Icon }) => (
      <Link
        key={key}
        to={path}
        className="flex items-center px-4 py-2 text-sm text-dark-50 hover:bg-dark-700 transition-colors rounded-md"
      >
        <Icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden />
        {name}
      </Link>
    ))}
  </div>
);

export default ResourcesDropdown;
