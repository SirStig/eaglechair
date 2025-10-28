import { Link } from 'react-router-dom';

const SeatBackTermsPage = () => {
  const terminology = [
    {
      category: 'Seat Styles',
      icon: '💺',
      terms: [
        {
          term: 'Upholstered Seat',
          description: 'Padded seat cushion covered in fabric or vinyl for maximum comfort. Available in various densities and fabric grades.',
          image: null
        },
        {
          term: 'Wood Seat',
          description: 'Solid wood construction, often contoured for comfort. Can be finished in any of our standard wood finishes.',
          image: null
        },
        {
          term: 'Saddle Seat',
          description: 'Contoured wood seat with a gentle dip in the center for natural ergonomic support.',
          image: null
        },
        {
          term: 'Vinyl/Upholstered Seat',
          description: 'Durable vinyl covering over padded foam, ideal for high-traffic commercial environments.',
          image: null
        }
      ]
    },
    {
      category: 'Back Styles',
      icon: '🪑',
      terms: [
        {
          term: 'Ladder Back',
          description: 'Traditional style with horizontal slats. Available in 2-slat, 3-slat, or 4-slat configurations.',
          image: null
        },
        {
          term: 'Solid Back',
          description: 'Single piece back construction for maximum support and clean aesthetic.',
          image: null
        },
        {
          term: 'Upholstered Back',
          description: 'Padded and fabric-covered back for premium comfort. Can be fully or partially upholstered.',
          image: null
        },
        {
          term: 'Spindle Back',
          description: 'Vertical turned spindles creating a classic Windsor-style appearance.',
          image: null
        },
        {
          term: 'X-Back',
          description: 'Crossed back design offering both structural support and visual interest.',
          image: null
        },
        {
          term: 'Schoolhouse Back',
          description: 'Simple vertical slat design reminiscent of traditional schoolhouse chairs.',
          image: null
        }
      ]
    },
    {
      category: 'Construction Terms',
      icon: '🔨',
      terms: [
        {
          term: 'Mortise and Tenon',
          description: 'Traditional joinery method creating strong, long-lasting connections. A tenon (projection) fits into a mortise (hole).',
          image: null
        },
        {
          term: 'Dowel Construction',
          description: 'Cylindrical wooden pins used to join components. Provides excellent strength when properly glued.',
          image: null
        },
        {
          term: 'Stretchers',
          description: 'Horizontal support bars connecting chair legs for added stability and strength.',
          image: null
        },
        {
          term: 'Apron',
          description: 'Horizontal piece connecting the chair legs just below the seat, adding structural integrity.',
          image: null
        },
        {
          term: 'Rabbet Joint',
          description: 'Step-shaped recess cut along an edge, creating a strong connection point.',
          image: null
        }
      ]
    },
    {
      category: 'Dimensions',
      icon: '📏',
      terms: [
        {
          term: 'Seat Height',
          description: 'Distance from floor to top of seat. Standard dining: 18", Counter: 24", Bar: 30".',
          image: null
        },
        {
          term: 'Overall Height',
          description: 'Total height from floor to top of chair back. Typical range: 32"-48".',
          image: null
        },
        {
          term: 'Seat Width',
          description: 'Width of the seat surface from side to side. Typical range: 16"-20".',
          image: null
        },
        {
          term: 'Seat Depth',
          description: 'Depth of seat from front edge to back. Typical range: 16"-18".',
          image: null
        },
        {
          term: 'Arm Height',
          description: 'Height of armrest from floor. Should allow chair to slide under table (typically 25"-27").',
          image: null
        }
      ]
    },
    {
      category: 'Finish & Material Terms',
      icon: '🎨',
      terms: [
        {
          term: 'Stain',
          description: 'Penetrating color that enhances wood grain while allowing natural beauty to show through.',
          image: null
        },
        {
          term: 'Lacquer',
          description: 'Clear protective finish providing durability and easy maintenance. Available in various sheen levels.',
          image: null
        },
        {
          term: 'Two-Tone Finish',
          description: 'Combination of two different finishes, typically seat/back in one color and frame in another.',
          image: null
        },
        {
          term: 'Distressed Finish',
          description: 'Intentionally aged appearance with subtle wear marks for rustic, vintage character.',
          image: null
        },
        {
          term: 'COM (Customer\'s Own Material)',
          description: 'Option to provide your own fabric/vinyl for upholstery. Must meet minimum yardage requirements.',
          image: null
        },
        {
          term: 'Grade',
          description: 'Upholstery fabric pricing tier based on material cost and quality (Grade A, B, C, etc.).',
          image: null
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <div className="bg-dark-900/80 border-b border-dark-700 sticky top-[80px] z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <Link to="/" className="text-primary-500 hover:text-primary-400 text-sm mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-dark-50">Seat & Back Terminology</h1>
            <p className="text-dark-300 mt-2">Understanding furniture construction and design terms</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Introduction */}
        <div className="bg-gradient-to-r from-primary-900/20 to-dark-800 border border-primary-700/30 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-dark-50 mb-4">Understanding Our Furniture</h2>
          <p className="text-dark-200 mb-4">
            This guide explains the terminology we use to describe our chairs, barstools, and other seating products. 
            Understanding these terms will help you make informed decisions when selecting furniture for your project.
          </p>
          <p className="text-dark-300">
            All our furniture is built using traditional construction methods with modern enhancements for durability 
            in commercial environments. Every piece is crafted with care in our Houston, Texas facility.
          </p>
        </div>

        {/* Terminology Sections */}
        <div className="space-y-12">
          {terminology.map((section, index) => (
            <section key={index} className="bg-dark-800 rounded-lg border border-dark-700 p-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="text-5xl">{section.icon}</div>
                <h2 className="text-3xl font-bold text-dark-50">{section.category}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {section.terms.map((item, termIndex) => (
                  <div
                    key={termIndex}
                    className="bg-dark-900 border border-dark-600 rounded-lg p-6 hover:border-primary-500 transition-colors"
                  >
                    <h3 className="text-xl font-bold text-primary-400 mb-3">{item.term}</h3>
                    <p className="text-dark-200 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Visual Diagrams Note */}
        <div className="mt-12 bg-dark-800 border border-dark-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-dark-50 mb-4">📐 Need Visual References?</h2>
          <p className="text-dark-200 mb-4">
            For detailed diagrams showing these components on actual products, please refer to:
          </p>
          <ul className="space-y-2 text-dark-300">
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">→</span>
              <span>Individual product specification sheets (available on each product page)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">→</span>
              <span>Our virtual catalogs section for complete line sheets</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-400 mt-1">→</span>
              <span>CAD files and technical drawings (available for download)</span>
            </li>
          </ul>
        </div>

        {/* Related Resources */}
        <div className="mt-16 pt-8 border-t border-dark-700">
          <h2 className="text-2xl font-bold text-dark-50 mb-6">Related Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/resources/guides"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">📖</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Guides & Instructions
              </h3>
              <p className="text-dark-400 text-sm">
                Installation and care guides
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
                Download complete product catalogs
              </p>
            </Link>

            <Link
              to="/contact"
              className="bg-dark-800 border border-dark-700 rounded-lg p-6 hover:border-primary-500 transition-colors group"
            >
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-lg font-semibold text-dark-50 mb-2 group-hover:text-primary-400">
                Contact Us
              </h3>
              <p className="text-dark-400 text-sm">
                Questions? Our team can help
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatBackTermsPage;
