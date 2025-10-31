import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCatalogs } from '../hooks/useContent';
import { Book, Palette, Scissors, BookOpen } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const VirtualCatalogsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: catalogs = [], loading } = useCatalogs();

  // Get catalogs data
  const catalogsData = catalogs || [];

  // Extract unique categories
  const categories = ['all', ...new Set(catalogsData.map(cat => cat.catalogType || cat.category).filter(Boolean))];

  // Filter catalogs
  const filteredCatalogs = catalogsData.filter(catalog => {
    const matchesSearch = catalog.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         catalog.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || (catalog.catalogType || catalog.category) === selectedCategory;
    return matchesSearch && matchesCategory && catalog.isActive !== false;
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
              <h1 className="text-3xl md:text-4xl font-bold text-dark-50">Virtual Catalogs</h1>
              <p className="text-dark-300 mt-2">Download product catalogs, line sheets, and guides</p>
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
                Search Catalogs
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
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

        {/* Catalogs Grid */}
        {filteredCatalogs.length === 0 ? (
          <div className="text-center py-16">
            <Book className="w-16 h-16 text-dark-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-dark-200 mb-2">
              {searchTerm || selectedCategory !== 'all' ? 'No catalogs found' : 'No catalogs available'}
            </h3>
            <p className="text-dark-400">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filters' 
                : 'Check back soon for downloadable catalogs'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCatalogs.map((catalog, index) => (
              <motion.div
                key={catalog.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-dark-800 rounded-lg border border-dark-700 overflow-hidden hover:border-primary-500 transition-all duration-300 group"
              >
                {/* Catalog Cover Image */}
                {catalog.coverImageUrl ? (
                  <div className="aspect-[3/4] overflow-hidden bg-dark-900">
                    <img
                      src={catalog.coverImageUrl}
                      alt={catalog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[3/4] bg-gradient-to-br from-dark-700 to-dark-900 flex items-center justify-center">
                    <Book className="w-16 h-16 text-dark-500" />
                  </div>
                )}

                {/* Catalog Info */}
                <div className="p-6">
                  {(catalog.catalogType || catalog.category) && (
                    <div className="text-xs font-semibold text-primary-400 uppercase tracking-wide mb-2">
                      {catalog.catalogType || catalog.category}
                    </div>
                  )}
                  
                  <h3 className="text-xl font-bold text-dark-50 mb-2 group-hover:text-primary-400 transition-colors">
                    {catalog.title}
                  </h3>
                  
                  {catalog.description && (
                    <p className="text-dark-300 text-sm mb-4 line-clamp-3">
                      {catalog.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-3 text-xs text-dark-400 mb-4">
                    {catalog.fileSize && (
                      <span>Size: {catalog.fileSize}</span>
                    )}
                    {catalog.pageCount && (
                      <span>{catalog.pageCount} pages</span>
                    )}
                    {catalog.version && (
                      <span>v{catalog.version}</span>
                    )}
                    {catalog.year && (
                      <span>{catalog.year}</span>
                    )}
                  </div>

                  {/* Download Button */}
                  {catalog.fileUrl && (
                    <a
                      href={catalog.fileUrl}
                      download
                      className="block w-full text-center px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-medium rounded-lg transition-colors"
                    >
                      Download {catalog.fileType?.toUpperCase() || 'PDF'}
                    </a>
                  )}

                  {/* Download Count */}
                  {catalog.downloadCount !== undefined && (
                    <div className="text-xs text-dark-500 mt-3">
                      {catalog.downloadCount} downloads
                    </div>
                  )}
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
              <Palette className="w-8 h-8 text-primary-400 mb-3" />
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
              <Scissors className="w-8 h-8 text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Upholstery Fabrics
              </h3>
              <p className="text-dark-400 text-sm">
                View our upholstery fabric selections
              </p>
            </Link>

            <Link
              to="/resources/guides"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <BookOpen className="w-8 h-8 text-primary-400 mb-3" />
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Guides & Instructions
              </h3>
              <p className="text-dark-400 text-sm">
                Installation guides, care instructions, and more
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualCatalogsPage;
