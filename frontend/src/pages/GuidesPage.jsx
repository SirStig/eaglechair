import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadContentData } from '../utils/contentDataLoader';

const GuidesPage = () => {
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const content = await loadContentData();
      if (content?.catalogs) {
        setCatalogs(content.catalogs);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Get guides from catalogs with category = "Guide" or similar
  const guidesData = catalogs.filter(c => 
    c.category?.toLowerCase().includes('guide') || 
    c.category?.toLowerCase().includes('instruction') ||
    c.title?.toLowerCase().includes('guide')
  );

  const guideCategories = [
    {
      id: 'installation',
      title: 'Installation Guides',
      icon: '🔧',
      description: 'Step-by-step installation instructions for our furniture',
      guides: guidesData.filter(g => g.title?.toLowerCase().includes('installation'))
    },
    {
      id: 'care',
      title: 'Care & Maintenance',
      icon: '✨',
      description: 'Keep your furniture looking its best with proper care',
      guides: guidesData.filter(g => g.title?.toLowerCase().includes('care') || g.title?.toLowerCase().includes('maintenance'))
    },
    {
      id: 'assembly',
      title: 'Assembly Instructions',
      icon: '📋',
      description: 'Detailed assembly guides for all products',
      guides: guidesData.filter(g => g.title?.toLowerCase().includes('assembly'))
    },
    {
      id: 'technical',
      title: 'Technical Specifications',
      icon: '📐',
      description: 'CAD files, dimensions, and technical drawings',
      guides: guidesData.filter(g => g.title?.toLowerCase().includes('cad') || g.title?.toLowerCase().includes('technical') || g.title?.toLowerCase().includes('spec'))
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-50 to-cream-100">
      <div className="bg-cream-50/80 border-b border-cream-200 sticky top-[80px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <Link to="/" className="text-primary-500 hover:text-primary-600 text-sm mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800">Guides & Resources</h1>
            <p className="text-slate-600 mt-2">Installation guides, care instructions, CAD files, and more</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-12">
          {guideCategories.map(category => (
            <section key={category.id} className="bg-white rounded-lg border border-cream-200 p-4 sm:p-6 lg:p-8">
              <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="text-3xl sm:text-4xl lg:text-5xl">{category.icon}</div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">{category.title}</h2>
                  <p className="text-sm sm:text-base text-slate-600">{category.description}</p>
                </div>
              </div>

              {category.guides.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-slate-500">
                  No guides available in this category yet
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {category.guides.map(guide => (
                    <div
                      key={guide.id}
                      className="bg-cream-50/50 border border-cream-200 rounded-lg p-4 hover:border-primary-500 transition-colors"
                    >
                      <h3 className="font-semibold text-slate-800 mb-2">{guide.title}</h3>
                      {guide.description && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{guide.description}</p>
                      )}
                      {guide.file_url && (
                        <a
                          href={guide.file_url}
                          download
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Download PDF →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 sm:mt-16 bg-white border border-cream-200 rounded-lg p-6 sm:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">Need Help?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">📞 Contact Support</h3>
              <p className="text-sm text-slate-600 mb-3">
                Can't find what you're looking for? Our team is here to help.
              </p>
              <Link to="/contact" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Contact Us →
              </Link>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">📚 Virtual Catalogs</h3>
              <p className="text-sm text-slate-600 mb-3">
                Browse our complete product catalogs and line sheets.
              </p>
              <Link to="/virtual-catalogs" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                View Catalogs →
              </Link>
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">💬 Request a Quote</h3>
              <p className="text-sm text-slate-600 mb-3">
                Get pricing and availability for your project.
              </p>
              <Link to="/quote-request" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                Get Quote →
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-cream-200">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/resources/hardware"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🔧</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Hardware
              </h3>
              <p className="text-slate-500 text-sm">
                Browse hardware components
              </p>
            </Link>

            <Link
              to="/resources/seat-back-terms"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">📖</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Terminology
              </h3>
              <p className="text-slate-500 text-sm">
                Seat and back terminology guide
              </p>
            </Link>

            <Link
              to="/resources/woodfinishes"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🎨</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Wood Finishes
              </h3>
              <p className="text-slate-500 text-sm">
                View finish options
              </p>
            </Link>

            <Link
              to="/resources/upholstery"
              className="bg-white border border-cream-200 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">🪡</div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2 group-hover:text-primary-600">
                Upholstery
              </h3>
              <p className="text-slate-500 text-sm">
                Browse fabric options
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidesPage;
