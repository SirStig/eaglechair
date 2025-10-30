import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IS_DEMO } from '../data/demoData';
import { loadContentData } from '../utils/contentDataLoader';

const UpholsteryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [upholsteries, setUpholsteries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!IS_DEMO) {
        const content = await loadContentData();
        if (content?.upholsteries) {
          setUpholsteries(content.upholsteries);
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Get upholstery data (production only - no demo data for now)
  const upholsteriesData = IS_DEMO ? [] : upholsteries;

  // Extract unique types
  const types = ['all', ...new Set(upholsteriesData.map(u => u.fabric_type).filter(Boolean))];

  // Filter upholsteries
  const filteredUpholsteries = upholsteriesData.filter(upholstery => {
    const matchesSearch = upholstery.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         upholstery.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         upholstery.fabric_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         upholstery.color?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || upholstery.fabric_type === selectedType;
    return matchesSearch && matchesType && upholstery.is_active;
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
              <h1 className="text-3xl md:text-4xl font-bold text-dark-50">Upholstery Fabrics</h1>
              <p className="text-dark-300 mt-2">Explore our upholstery fabric selections</p>
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
                Search Fabrics
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, code, color, or description..."
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Fabric Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {types.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
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
                  Upholstery fabric samples are not available in demo mode. Connect to the backend to browse fabrics.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upholstery Grid */}
        {filteredUpholsteries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🪡</div>
            <h3 className="text-xl font-semibold text-dark-200 mb-2">
              {searchTerm || selectedType !== 'all' ? 'No fabrics found' : 'No fabrics available'}
            </h3>
            <p className="text-dark-400">
              {searchTerm || selectedType !== 'all' 
                ? 'Try adjusting your search or filters' 
                : IS_DEMO 
                  ? 'Upholstery fabrics will appear when connected to the backend' 
                  : 'Check back soon for fabric options'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUpholsteries.map((upholstery, index) => (
              <motion.div
                key={upholstery.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/20"
              >
                {/* Swatch Image */}
                {upholstery.swatch_image_url ? (
                  <div className="aspect-square overflow-hidden bg-dark-900">
                    <img
                      src={upholstery.swatch_image_url}
                      alt={upholstery.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-dark-700 to-dark-900 flex items-center justify-center">
                    <span className="text-6xl">🪡</span>
                  </div>
                )}

                {/* Fabric Info */}
                <div className="p-4">
                  {upholstery.fabric_type && (
                    <div className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-2">
                      {upholstery.fabric_type}
                    </div>
                  )}
                  
                  <h3 className="text-lg font-bold text-dark-50 mb-1">
                    {upholstery.name}
                  </h3>
                  
                  {upholstery.fabric_code && (
                    <div className="text-xs font-mono text-dark-400 mb-2">
                      {upholstery.fabric_code}
                    </div>
                  )}

                  {upholstery.color && (
                    <div className="text-xs text-dark-400 mb-2">
                      {upholstery.color}
                    </div>
                  )}

                  {upholstery.description && (
                    <p className="text-sm text-dark-300 line-clamp-2 mb-3">
                      {upholstery.description}
                    </p>
                  )}

                  {/* Specifications */}
                  {(upholstery.manufacturer || upholstery.content || upholstery.durability_rating) && (
                    <div className="text-xs text-dark-400 mb-3 space-y-1">
                      {upholstery.manufacturer && <div>Brand: {upholstery.manufacturer}</div>}
                      {upholstery.content && <div>Content: {upholstery.content}</div>}
                      {upholstery.durability_rating && <div>Durability: {upholstery.durability_rating}</div>}
                    </div>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {upholstery.grade && (
                      <span className="px-2 py-1 text-xs bg-dark-700 text-dark-200 rounded">
                        Grade {upholstery.grade}
                      </span>
                    )}
                    {upholstery.is_popular && (
                      <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                        Popular
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
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
              to="/resources/laminates"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🏛️</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Laminates
              </h3>
              <p className="text-dark-400 text-sm">
                View laminate brands and patterns
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

export default UpholsteryPage;
