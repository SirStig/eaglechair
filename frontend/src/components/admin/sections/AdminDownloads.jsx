import { motion } from 'framer-motion';
import Card from '../../ui/Card';
import { Download } from 'lucide-react';

const SOFTWARE = [
  {
    id: 'eci-cleaner',
    name: 'ECI Cleaner',
    description: 'CAD file cleanup utility for DXF and VectorScript files. Cleans CNC machine files for rough edges and optimizes geometry for manufacturing.',
    features: [
      'Remove redundant points',
      'Smooth lines and curves',
      'Clean jagged edges',
      'Optimize geometry for manufacturing and design workflows',
    ],
    downloads: [
      { label: 'macOS', href: '/assets/ECI-Cleaner/ECI%20Cleaner.dmg', filename: 'ECI Cleaner.dmg' },
    ],
  },
];

const AdminDownloads = () => {
  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-dark-50 mb-2">Downloads</h1>
        <p className="text-xs sm:text-sm text-dark-300">EagleChair software and utilities</p>
      </div>

      <div className="space-y-6">
        {SOFTWARE.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <Card className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-dark-50 mb-2">{item.name}</h2>
              <p className="text-sm text-dark-300 mb-6">{item.description}</p>

              <ul className="text-dark-200 space-y-2 mb-6">
                {item.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-primary-500 mt-0.5">•</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                {item.downloads.map((d) => (
                  <a
                    key={d.label}
                    href={d.href}
                    download={d.filename}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download for {d.label}
                  </a>
                ))}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AdminDownloads;
