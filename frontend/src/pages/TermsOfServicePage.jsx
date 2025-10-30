import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { IS_DEMO, demoLegalDocuments } from '../data/demoData';
import { loadContentData } from '../utils/contentDataLoader';

const TermsOfServicePage = () => {
  const [legalDocuments, setLegalDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!IS_DEMO) {
        const content = await loadContentData();
        if (content?.legalDocuments) {
          setLegalDocuments(content.legalDocuments);
        }
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Get Terms of Service from legal documents (use demo or production data)
  const legalData = IS_DEMO ? demoLegalDocuments : legalDocuments;
  const termsDoc = legalData.find(doc => doc.slug === 'conditions-of-sale');
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-dark-100">Loading...</div>
      </div>
    );
  }
  
  if (!termsDoc) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900 flex items-center justify-center">
        <div className="text-dark-100">Terms of Service not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[1400px] mx-auto py-12 px-4"
      >
        <div className="bg-dark-800 rounded-lg shadow-xl p-8 md:p-12 border border-dark-700">
          <Link to="/" className="inline-block mb-6 text-primary-500 hover:text-primary-400">
            ← Back to Home
          </Link>

          <h1 className="text-4xl font-bold text-dark-50 mb-4">{termsDoc.title}</h1>
          <p className="text-dark-300 mb-8">{termsDoc.short_description || termsDoc.shortDescription}</p>
          
          {(termsDoc.effective_date || termsDoc.effectiveDate) && (
            <div className="text-sm text-dark-400 mb-8">
              <strong>Effective Date:</strong> {termsDoc.effective_date || termsDoc.effectiveDate}
            </div>
          )}


          <div className="prose prose-invert max-w-none">
            <div className="text-dark-200 whitespace-pre-wrap leading-relaxed">
              {termsDoc.content}
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-dark-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link to="/privacy" className="text-primary-500 hover:text-primary-400">
              View Privacy Policy →
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

export default TermsOfServicePage;
