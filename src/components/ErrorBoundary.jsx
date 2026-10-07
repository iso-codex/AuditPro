import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-red-50 rounded-xl border border-red-100 m-4">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-red-700 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-6 max-w-md">
            We encountered an unexpected error while rendering this component.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw size={18} /> Reload Application
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 text-left bg-white p-4 rounded border text-sm text-red-900 overflow-auto w-full max-w-2xl max-h-64">
              <p className="font-bold">{this.state.error.toString()}</p>
              <pre className="mt-2 text-xs opacity-80">{this.state.errorInfo?.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
