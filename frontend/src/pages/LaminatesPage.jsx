import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLaminates } from '../hooks/useContent';
import { Layers, Palette, Scissors, Book } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const LaminatesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const { data: laminates = [], loading } = useLaminates();

  const laminatesData = laminates || [];

  // Extract unique brands
  const brands = ['all', ...new Set(laminatesData.map(l => l.brand).filter(Boolean))];

  // Filter laminates
  const filteredLaminates = laminatesData.filter(laminate => {
    const matchesSearch = laminate.patternName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.patternCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         laminate.colorFamily?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBrand = selectedBrand === 'all' || laminate.brand === selectedBrand;
    return matchesSearch && matchesBrand && laminate.isActive !== false;
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
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Laminates</h1>
              <p className="text-slate-600 mt-2">Browse laminate brands and patterns</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg p-6 border border-cream-200 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Laminates
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by pattern, code, color, or description..."
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Brand
              </label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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

        {filteredLaminates.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {searchTerm || selectedBrand !== 'all' ? 'No laminates found' : 'No laminates available'}
            </h3>
            <p className="text-slate-500">
              {searchTerm || selectedBrand !== 'all' 
                ? 'Try adjusting your search or filters' 
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
                className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10"
              >
                {laminate.swatchImageUrl ? (
                  <div className="aspect-square overflow-hidden rounded-full bg-slate-100">
                    <img
                      src={laminate.swatchImageUrl}
                      alt={laminate.patternName}
                      className="w-full h-full object-cover scale-125"
                    />
                  </div>
                ) : laminate.fullImageUrl ? (
                  <div className="aspect-square overflow-hidden rounded-full bg-slate-100">
                    <img
                      src={laminate.fullImageUrl}
                      alt={laminate.patternName}
                      className="w-full h-full object-cover scale-125"
                    />
                  </div>
                ) : (
                  <div className="aspect-square rounded-full bg-slate-100 flex items-center justify-center">
                    <Layers className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="p-4">
                  {laminate.brand && (
                    <div className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-2">
                      {laminate.brand}
                    </div>
                  )}
                  
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {laminate.patternName}
                  </h3>
                  
                  {laminate.patternCode && (
                    <div className="text-xs font-mono text-slate-500 mb-2">
                      {laminate.patternCode}
                    </div>
                  )}

                  {laminate.colorFamily && (
                    <div className="text-xs text-slate-500 mb-2">
                      {laminate.colorFamily}
                    </div>
                  )}

                  {laminate.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {laminate.description}
                    </p>
                  )}

                  {(laminate.finishType || laminate.thickness || laminate.grade) && (
                    <div className="text-xs text-slate-500 mb-3 space-y-1">
                      {laminate.finishType && <div>Finish: {laminate.finishType}</div>}
                      {laminate.thickness && <div>Thickness: {laminate.thickness}</div>}
                      {laminate.grade && <div>Grade: {laminate.grade}</div>}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {laminate.isPopular && (
                      <span className="px-2 py-1 text-xs bg-primary-600 text-white rounded">
                        Popular
                      </span>
                    )}
                    {laminate.isInStock && (
                      <span className="px-2 py-1 text-xs bg-green-600 text-white rounded">
                        In Stock
                      </span>
                    )}
                    {!laminate.isInStock && laminate.leadTimeDays && (
                      <span className="px-2 py-1 text-xs bg-yellow-600 text-white rounded">
                        {laminate.leadTimeDays} days
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {filteredLaminates.length > 0 && (
          <div className="mt-12 bg-white rounded-lg border border-cream-200 p-6">
            <h2 className="text-xl font-bold text-slate-800 mb-4">Supplier Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {brands.filter(b => b !== 'all').map(brand => {
                const supplier = filteredLaminates.find(l => l.brand === brand);
                return supplier && supplier.supplierName ? (
                  <div key={brand} className="border-l-4 border-primary-500 pl-4">
                    <h3 className="font-semibold text-slate-800 mb-2">{supplier.supplierName}</h3>
                    {supplier.supplierWebsite && (
                      <a 
                        href={supplier.supplierWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700"
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

        <div className="mt-16 pt-8 border-t border-cream-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/resources/woodfinishes"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Palette className="w-8 h-8 text-primary-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Wood Finishes
              </h3>
              <p className="text-slate-500 text-sm">
                Browse available wood finish options and colors
              </p>
            </Link>

            <Link
              to="/resources/upholstery"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Scissors className="w-8 h-8 text-primary-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Upholstery Fabrics
              </h3>
              <p className="text-slate-500 text-sm">
                View our upholstery fabric selections
              </p>
            </Link>

            <Link
              to="/virtual-catalogs"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Book className="w-8 h-8 text-primary-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Virtual Catalogs
              </h3>
              <p className="text-slate-500 text-sm">
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
