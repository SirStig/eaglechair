import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IS_DEMO, demoLegalDocuments } from '../data/demoData';
import { legalDocuments } from '../data/contentData';

const PrivacyPolicyPage = () => {
  // Get Privacy Policy from legal documents (use demo or production data)
  const legalData = IS_DEMO ? demoLegalDocuments : legalDocuments;
  const privacyDoc = legalData.find(doc => doc.slug === 'privacy-policy');
  
  if (!privacyDoc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-dark-100">Privacy Policy not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto py-12 px-4"
      >
        <div className="bg-dark-800 rounded-lg shadow-xl p-8 md:p-12 border border-dark-700">
          <Link to="/" className="inline-block mb-6 text-primary-500 hover:text-primary-400">
            ← Back to Home
          </Link>

          <h1 className="text-4xl font-bold text-dark-50 mb-4">{privacyDoc.title}</h1>
          <p className="text-dark-300 mb-8">{privacyDoc.short_description || privacyDoc.shortDescription}</p>
          
          {(privacyDoc.effective_date || privacyDoc.effectiveDate) && (
            <div className="text-sm text-dark-400 mb-8">
              <strong>Effective Date:</strong> {privacyDoc.effective_date || privacyDoc.effectiveDate}
            </div>
          )}

          <div className="prose prose-invert max-w-none">
            <div className="text-dark-200 whitespace-pre-wrap leading-relaxed">
              {privacyDoc.content}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-dark-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link to="/terms" className="text-primary-500 hover:text-primary-400">
              View Terms of Service →
            </Link>
            <Link to="/general-information" className="text-primary-500 hover:text-primary-400">
              View All Policies →
            </Link>
            <Link to="/register" className="text-primary-500 hover:text-primary-400 font-medium">
              Continue to Registration →
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PrivacyPolicyPage;
