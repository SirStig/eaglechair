import { m } from 'framer-motion';
import Card from '../../ui/Card';
import { Download } from 'lucide-react';
import { AdminPage, AdminPageHeader } from '../ui/AdminPage';

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
    <AdminPage width="default">
      <AdminPageHeader
        eyebrow="System"
        title="Downloads"
        description="EagleChair software and utilities."
      />

      <div className="space-y-6">
        {SOFTWARE.map((item, index) => (
          <m.div
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
          </m.div>
        ))}
      </div>
    </AdminPage>
  );
};

export default AdminDownloads;
