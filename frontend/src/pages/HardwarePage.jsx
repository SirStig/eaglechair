import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useHardware } from '../hooks/useContent';
import { Wrench, BookOpen, Book, MessageSquare } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const HardwarePage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: hardware = [], loading } = useHardware();

  const hardwareData = hardware || [];

  // Extract unique categories
  const categories = ['all', ...new Set(hardwareData.map(h => h.category).filter(Boolean))];

  // Filter hardware
  const filteredHardware = hardwareData.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.modelNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory && item.isActive !== false;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-50 to-cream-100 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-cream-100">
      <div className="bg-cream-50/80 border-b border-cream-200 sticky top-[80px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <Link to="/" className="text-primary-500 hover:text-primary-600 text-sm mb-2 inline-block">
                ← Back to Home
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Hardware Components</h1>
              <p className="text-slate-600 mt-2">Glides, casters, table bases, and fasteners</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg p-6 border border-cream-200 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Hardware
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, model number, or description..."
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredHardware.length === 0 ? (
          <div className="text-center py-16">
            <Wrench className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {searchTerm || selectedCategory !== 'all' ? 'No hardware found' : 'No hardware available'}
            </h3>
            <p className="text-slate-500">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Check back soon for hardware options'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredHardware.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-all duration-300"
              >
                {item.image_url ? (
                  <div className="aspect-video overflow-hidden bg-slate-100">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-contain p-4"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-slate-100 flex items-center justify-center">
                    <Wrench className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="p-6">
                  {item.category && (
                    <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                      {item.category}
                    </div>
                  )}
                  
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {item.name}
                  </h3>

                  {item.modelNumber && (
                    <div className="text-sm font-mono text-slate-600 mb-3">
                      Model: {item.modelNumber}
                    </div>
                  )}

                  {item.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-3">
                      {item.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-slate-500 mb-4">
                    {item.material && (
                      <div>
                        <span className="font-medium text-slate-700">Material:</span> {item.material}
                      </div>
                    )}
                    {item.finish && (
                      <div>
                        <span className="font-medium text-slate-700">Finish:</span> {item.finish}
                      </div>
                    )}
                    {item.dimensions && (
                      <div>
                        <span className="font-medium text-slate-700">Dimensions:</span> {item.dimensions}
                      </div>
                    )}
                    {item.weightCapacity && (
                      <div>
                        <span className="font-medium text-slate-700">Capacity:</span> {item.weightCapacity}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.isFeatured && (
                      <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                        Featured
                      </span>
                    )}
                    {item.sku && (
                      <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded font-mono">
                        SKU: {item.sku}
                      </span>
                    )}
                  </div>

                  {item.installationNotes && (
                    <div className="mt-4 pt-4 border-t border-cream-200">
                      <div className="text-xs font-medium text-slate-700 mb-1">Installation Notes:</div>
                      <p className="text-xs text-slate-500 line-clamp-2">{item.installationNotes}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-cream-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/resources/guides"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <BookOpen className="w-8 h-8 text-primary-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Installation Guides
              </h3>
              <p className="text-slate-500 text-sm">
                Detailed installation instructions and diagrams
              </p>
            </Link>

            <Link
              to="/virtual-catalogs"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">📚</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Product Catalogs
              </h3>
              <p className="text-slate-500 text-sm">
                Download complete product catalogs
              </p>
            </Link>

            <Link
              to="/contact"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Contact Us
              </h3>
              <p className="text-slate-500 text-sm">
                Questions about hardware? Get in touch
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HardwarePage;
