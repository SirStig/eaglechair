import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';
import Card from './ui/Card';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isExpanded: false 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Optionally log to error reporting service
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    // Reset error boundary state
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      isExpanded: false 
    });
    
    // Optionally reload the page for a clean state
    // window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleExpanded = () => {
    this.setState(prev => ({ isExpanded: !prev.isExpanded }));
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, isExpanded } = this.state;
      const errorMessage = error?.message || 'An unexpected error occurred';
      const errorStack = errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-dark-800 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-2xl"
          >
            <Card className="relative overflow-hidden">
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 via-transparent to-secondary-500/5 pointer-events-none" />
              
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="flex-shrink-0 w-16 h-16 bg-secondary-500/10 rounded-full flex items-center justify-center border-2 border-secondary-500/20"
                  >
                    <AlertTriangle className="w-8 h-8 text-secondary-500" />
                  </motion.div>
                  
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-dark-50 mb-2">
                      Something went wrong
                    </h1>
                    <p className="text-dark-300">
                      We encountered an unexpected error. Don't worry, your data is safe.
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                <div className="mb-6 p-4 bg-dark-700/50 rounded-lg border border-dark-500">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-secondary-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark-100 mb-1">
                        Error Details
                      </p>
                      <p className="text-sm text-dark-300 font-mono break-words">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expandable Error Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mb-6 overflow-hidden"
                    >
                      <div className="p-4 bg-dark-700/30 rounded-lg border border-dark-500">
                        <p className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">
                          Technical Details
                        </p>
                        <pre className="text-xs text-dark-300 font-mono overflow-auto max-h-64 p-3 bg-dark-800 rounded border border-dark-600">
                          {errorStack || 'No stack trace available'}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={this.handleReset}
                    variant="primary"
                    size="md"
                    className="flex-1"
                    icon={RefreshCw}
                  >
                    Try Again
                  </Button>
                  
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    size="md"
                    className="flex-1"
                    icon={RefreshCw}
                  >
                    Reload Page
                  </Button>
                  
                  <Button
                    onClick={this.handleGoHome}
                    variant="transparent"
                    size="md"
                    className="flex-1"
                    icon={Home}
                  >
                    Go Home
                  </Button>
                </div>

                {/* Toggle Details Button */}
                <button
                  onClick={this.toggleExpanded}
                  className="mt-4 w-full text-sm text-dark-400 hover:text-dark-200 transition-colors flex items-center justify-center gap-2 py-2 rounded-lg hover:bg-dark-700/50"
                >
                  <span>{isExpanded ? 'Hide' : 'Show'} Technical Details</span>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </motion.div>
                </button>
              </div>
            </Card>

            {/* Footer Note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 text-center"
            >
              <p className="text-sm text-dark-400">
                If this problem persists, please contact support.
              </p>
            </motion.div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

