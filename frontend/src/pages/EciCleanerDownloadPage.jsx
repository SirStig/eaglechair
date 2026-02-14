import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const DOWNLOADS = [
  {
    label: 'macOS',
    href: '/assets/ECI-Cleaner/ECI-Cleaner-macOS.zip',
    filename: 'ECI-Cleaner-macOS.zip',
  },
];

const EciCleanerDownloadPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[720px] mx-auto py-16 px-4"
      >
        <Link
          to="/"
          className="inline-block mb-8 text-primary-500 hover:text-primary-400 text-sm font-medium"
        >
          ← Back to Home
        </Link>

        <div className="bg-dark-800 rounded-xl shadow-xl p-8 md:p-12 border border-dark-700">
          <h1 className="text-3xl md:text-4xl font-bold text-dark-50 mb-3">
            ECI Cleaner
          </h1>
          <p className="text-dark-300 mb-8">
            CAD file cleanup utility for DXF and VectorScript files.
          </p>

          <ul className="text-dark-200 space-y-2 mb-10">
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Remove redundant points</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Smooth lines and curves</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Clean jagged edges</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-500 mt-0.5">•</span>
              <span>Optimize geometry for manufacturing and design workflows</span>
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-4">
            {DOWNLOADS.map((d) => (
              <a
                key={d.label}
                href={d.href}
                download={d.filename}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-500 hover:bg-primary-600 text-dark-900 font-semibold rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download for {d.label}
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EciCleanerDownloadPage;
