import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useFinishes } from '../hooks/useContent';
import { Palette, Layers, Scissors, Book } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const WoodFinishesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const { data: finishes = [], loading } = useFinishes();

  // Get finishes data
  const finishesData = finishes || [];

  // Extract unique types
  const types = ['all', ...new Set(finishesData.map(f => f.finishType).filter(Boolean))];

  // Filter finishes
  const filteredFinishes = finishesData.filter(finish => {
    // Default isActive to true if not set (for backwards compatibility)
    const isActive = finish.isActive !== undefined ? finish.isActive : true;
    if (!isActive) return false;
    
    const matchesSearch = finish.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         finish.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         finish.colorFamily?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || finish.finishType === selectedType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

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
              <h1 className="text-3xl md:text-4xl font-bold text-dark-50">Wood Finishes</h1>
              <p className="text-dark-300 mt-2">Explore our selection of premium wood finishes</p>
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
                Search Finishes
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, color, or description..."
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Finish Type
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

        {/* Finishes Grid */}
        {filteredFinishes.length === 0 ? (
          <div className="text-center py-16">
            <Palette className="w-16 h-16 text-dark-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-dark-200 mb-2">
              {searchTerm || selectedType !== 'all' ? 'No finishes found' : 'No finishes available'}
            </h3>
            <p className="text-dark-400">
              {searchTerm || selectedType !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Check back soon for available finishes'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFinishes.map((finish, index) => (
              <motion.div
                key={finish.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/20"
              >
                {/* Swatch Image */}
                {finish.swatchImageUrl ? (
                  <div className="aspect-square overflow-hidden bg-dark-900">
                    <img
                      src={finish.swatchImageUrl}
                      alt={finish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : finish.imageUrl ? (
                  <div className="aspect-square overflow-hidden bg-dark-900">
                    <img
                      src={finish.imageUrl}
                      alt={finish.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-gradient-to-br from-dark-700 to-dark-900 flex items-center justify-center">
                    <Palette className="w-16 h-16 text-dark-500" />
                  </div>
                )}

                {/* Finish Info */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-dark-50 mb-1">
                    {finish.name}
                  </h3>
                  
                  {finish.finishCode && (
                    <div className="text-xs font-mono text-primary-400 mb-2">
                      {finish.finishCode}
                    </div>
                  )}

                  {finish.colorFamily && (
                    <div className="text-xs text-dark-400 mb-2">
                      {finish.colorFamily}
                    </div>
                  )}

                  {finish.description && (
                    <p className="text-sm text-dark-300 line-clamp-2 mb-3">
                      {finish.description}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {finish.finishType && (
                      <span className="px-2 py-1 text-xs bg-dark-700 text-dark-200 rounded">
                        {finish.finishType}
                      </span>
                    )}
                    {finish.isPopular && (
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
              to="/resources/laminates"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Layers className="w-8 h-8 text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Laminates
              </h3>
              <p className="text-dark-400 text-sm">
                View laminate brands and patterns available
              </p>
            </Link>

            <Link
              to="/resources/upholstery"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Scissors className="w-8 h-8 text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Upholstery Fabrics
              </h3>
              <p className="text-dark-400 text-sm">
                Browse our upholstery fabric selections
              </p>
            </Link>

            <Link
              to="/virtual-catalogs"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Book className="w-8 h-8 text-primary-400 mb-3" />
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

export default WoodFinishesPage;
