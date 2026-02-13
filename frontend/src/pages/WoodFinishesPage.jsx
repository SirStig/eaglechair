import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useFinishes } from '../hooks/useContent';
import { Palette, Layers, Scissors, Book } from 'lucide-react';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const WoodFinishesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const { data: finishes = [], loading } = useFinishes();

  const finishesData = finishes || [];
  const types = ['all', ...new Set(finishesData.map(f => f.finishType).filter(Boolean))];
  const grades = ['all', 'Standard', 'Premium', 'Premium Plus', 'Artisan'];

  const filteredFinishes = finishesData.filter(finish => {
    const isActive = finish.isActive !== undefined ? finish.isActive : true;
    if (!isActive) return false;
    
    const matchesSearch = finish.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         finish.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         finish.colorFamily?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || finish.finishType === selectedType;
    const grade = finish.grade || 'Standard';
    const matchesGrade = selectedGrade === 'all' || grade === selectedGrade;
    return matchesSearch && matchesType && matchesGrade;
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
              <h1 className="text-3xl md:text-4xl font-bold text-slate-800">Wood Finishes</h1>
              <p className="text-slate-600 mt-2">Explore our selection of premium wood finishes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg p-6 border border-cream-200 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Search Finishes
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, color, or description..."
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Finish Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {types.map(type => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Grade
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                {grades.map(g => (
                  <option key={g} value={g}>
                    {g === 'all' ? 'All Grades' : g}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredFinishes.length === 0 ? (
          <div className="text-center py-16">
            <Palette className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {searchTerm || selectedType !== 'all' || selectedGrade !== 'all' ? 'No finishes found' : 'No finishes available'}
            </h3>
            <p className="text-slate-500">
              {searchTerm || selectedType !== 'all' || selectedGrade !== 'all'
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
                className="bg-white rounded-lg border border-cream-200 overflow-hidden hover:border-primary-500 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/10"
              >
                {finish.swatchImageUrl ? (
                  <div className="aspect-square overflow-hidden rounded-full bg-slate-100">
                    <img
                      src={finish.swatchImageUrl}
                      alt={finish.name}
                      className="w-full h-full object-cover scale-125"
                    />
                  </div>
                ) : finish.imageUrl ? (
                  <div className="aspect-square overflow-hidden rounded-full bg-slate-100">
                    <img
                      src={finish.imageUrl}
                      alt={finish.name}
                      className="w-full h-full object-cover scale-125"
                    />
                  </div>
                ) : (
                  <div className="aspect-square bg-slate-100 flex items-center justify-center rounded-full">
                    <Palette className="w-16 h-16 text-slate-400" />
                  </div>
                )}

                <div className="p-4">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">
                    {finish.name}
                  </h3>
                  
                  {finish.finishCode && (
                    <div className="text-xs font-mono text-primary-600 mb-2">
                      {finish.finishCode}
                    </div>
                  )}

                  {finish.colorFamily && (
                    <div className="text-xs text-slate-500 mb-2">
                      {finish.colorFamily}
                    </div>
                  )}

                  {finish.description && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                      {finish.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded font-medium">
                      {finish.grade || 'Standard'}
                    </span>
                    {finish.finishType && (
                      <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded">
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

        <div className="mt-16 pt-8 border-t border-cream-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/resources/laminates"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <Layers className="w-8 h-8 text-primary-500 mb-3" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Laminates
              </h3>
              <p className="text-slate-500 text-sm">
                View laminate brands and patterns available
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
                Browse our upholstery fabric selections
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

export default WoodFinishesPage;
