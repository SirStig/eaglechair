import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IS_DEMO } from '../data/demoData';
import { loadContentData } from '../utils/contentDataLoader';

const LaminatesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [laminates, setLaminates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!IS_DEMO) {
        const content = await loadContentData();
        if (content?.laminates) {
          setLaminates(content.laminates);
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Get laminates data (production only - no demo data for now)
  const laminatesData = IS_DEMO ? [] : laminates;

  // Extract unique brands
  const brands = ['all', ...new Set(laminatesData.map(l => l.brand).filter(Boolean))];

  // Filter laminates
  const filteredLaminates = laminatesData.filter(laminate => {
    const matchesSearch = laminate.pattern_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.pattern_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.color_family?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = selectedBrand === 'all' || laminate.brand === selectedBrand;
    return matchesSearch && matchesBrand && laminate.is_active;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-900/80 border-b border-dark-700 sticky top-[80px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Link to="/" className="text-primary-500 hover:text-primary-400 text-sm mb-2 inline-block">
                ← Back to Home
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-dark-50">Laminates</h1>
              <p className="text-dark-300 mt-2">Browse laminate brands and patterns</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-dark-800 rounded-lg p-6 border border-dark-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Search Laminates
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by pattern, code, color, or description..."
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Brand Filter */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Brand
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {brands.map(brand => (
                  <option key={brand} value={brand}>
                    {brand === 'all' ? 'All Brands' : brand}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {IS_DEMO && (
          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="text-yellow-500 text-2xl">⚠️</div>
              <div>
                <h3 className="text-yellow-500 font-semibold mb-1">Demo Mode Active</h3>
                <p className="text-dark-200">
                  Laminate samples are not available in demo mode. Connect to the backend to browse laminate options.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Laminates Grid */}
        {filteredLaminates.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏛️</div>
            <h3 className="text-xl font-semibold text-dark-200 mb-2">
              {searchTerm || selectedBrand !== 'all' ? 'No laminates found' : 'No laminates available'}
            </h3>
            <p className="text-dark-400">
              {searchTerm || selectedBrand !== 'all' 
                ? 'Try adjusting your search or filters' 
                : IS_DEMO 
                  ? 'Laminate options will appear when connected to the backend' 
                  : 'Check back soon for laminate options'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredLaminates.map((laminate, index) => (
              <motion.div
                key={laminate.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/20"
              >
                {/* Swatch Image */}
                {laminate.swatch_image_url ? (
                  <div className="aspect-square overflow-hidden bg-dark-900">
                    <img
                      src={laminate.swatch_image_url}
                      alt={laminate.pattern_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-dark-700 to-dark-900 flex items-center justify-center">
                    <span className="text-6xl">🏛️</span>
                  </div>
                )}

                {/* Laminate Info */}
                <div className="p-4">
                  {laminate.brand && (
                    <div className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-2">
                      {laminate.brand}
                    </div>
                  )}
                  
                  <h3 className="text-lg font-bold text-dark-50 mb-1">
                    {laminate.pattern_name}
                  </h3>
                  
                  {laminate.pattern_code && (
                    <div className="text-xs font-mono text-dark-400 mb-2">
                      {laminate.pattern_code}
                    </div>
                  )}

                  {laminate.color_family && (
                    <div className="text-xs text-dark-400 mb-2">
                      {laminate.color_family}
                    </div>
                  )}

                  {laminate.description && (
                    <p className="text-sm text-dark-300 line-clamp-2 mb-3">
                      {laminate.description}
                    </p>
                  )}

                  {/* Specifications */}
                  {(laminate.finish_type || laminate.thickness || laminate.grade) && (
                    <div className="text-xs text-dark-400 mb-3 space-y-1">
                      {laminate.finish_type && <div>Finish: {laminate.finish_type}</div>}
                      {laminate.thickness && <div>Thickness: {laminate.thickness}</div>}
                      {laminate.grade && <div>Grade: {laminate.grade}</div>}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {laminate.is_popular && (
                      <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                        Popular
                      </span>
                    )}
                    {laminate.is_in_stock && (
                      <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                        In Stock
                      </span>
                    )}
                    {!laminate.is_in_stock && laminate.lead_time_days && (
                      <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
                        {laminate.lead_time_days} days
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Supplier Information */}
        {!IS_DEMO && filteredLaminates.length > 0 && (
          <div className="mt-12 bg-dark-800 rounded-lg border border-dark-700 p-6">
            <h2 className="text-xl font-bold text-dark-50 mb-4">Supplier Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {brands.filter(b => b !== 'all').map(brand => {
                const supplier = filteredLaminates.find(l => l.brand === brand);
                return supplier && supplier.supplier_name ? (
                  <div key={brand} className="border-l-4 border-primary-500 pl-4">
                    <h3 className="font-semibold text-dark-100 mb-2">{supplier.supplier_name}</h3>
                    {supplier.supplier_website && (
                      <a 
                        href={supplier.supplier_website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-400 hover:text-primary-300"
                      >
                        Visit Website →
                      </a>
                    )}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* Related Resources */}
        <div className="mt-16 pt-8 border-t border-dark-700">
          <h2 className="text-2xl font-bold text-dark-50 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/resources/woodfinishes"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🎨</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Wood Finishes
              </h3>
              <p className="text-dark-400 text-sm">
                Browse available wood finish options and colors
              </p>
            </Link>

            <Link
              to="/resources/upholstery"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🪡</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Upholstery Fabrics
              </h3>
              <p className="text-dark-400 text-sm">
                View our upholstery fabric selections
              </p>
            </Link>

            <Link
              to="/virtual-catalogs"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">📚</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Virtual Catalogs
              </h3>
              <p className="text-dark-400 text-sm">
                Download product catalogs and guides
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaminatesPage;
