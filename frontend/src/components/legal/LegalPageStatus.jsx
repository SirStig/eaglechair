import { Link } from 'react-router-dom';
import { PageLoader } from '../ui/LoadingSpinner';

/**
 * Loading / error / missing states shared by the public legal pages.
 */
export const LegalPageLoading = () => <PageLoader tone="dark" />;

export const LegalPageMessage = ({ title, message, onRetry }) => (
  <div className="min-h-[70vh] flex items-center justify-center px-4">
    <div role={onRetry ? 'alert' : undefined} className="max-w-md text-center">
      <h1 className="text-2xl font-bold text-dark-50 mb-3">{title}</h1>
      <p className="text-dark-200 mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            Try again
          </button>
        )}
        <Link
          to="/contact"
          className="px-5 py-2.5 bg-dark-700 hover:bg-dark-600 text-dark-50 font-semibold rounded-lg transition-colors border border-dark-600"
        >
          Contact Us
        </Link>
      </div>
    </div>
  </div>
);

export const LegalPageError = ({ onRetry }) => (
  <LegalPageMessage
    title="Couldn't load our policies"
    message="Please check your connection and try again, or contact us for a copy."
    onRetry={onRetry}
  />
);
