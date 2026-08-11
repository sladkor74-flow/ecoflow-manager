import React from 'react';

export default class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PageErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-3xl mx-auto">
          <div className="border border-red-200 bg-red-50 rounded-lg p-6 space-y-3">
            <h2 className="text-lg font-heading font-bold text-red-700">Errore di caricamento pagina</h2>
            <p className="text-sm text-red-600">
              Si è verificato un errore durante il rendering di questa pagina. L'errore è stato catturato per evitare il crash completo dell'app.
            </p>
            <pre className="text-xs bg-red-100 border border-red-200 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
              {this.state.error?.message || String(this.state.error)}
              {this.state.error?.stack ? '\n\n' + this.state.error.stack.split('\n').slice(0, 8).join('\n') : ''}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="px-3 py-1.5 text-sm border border-red-300 rounded-md hover:bg-red-100 text-red-700"
              >
                Riprova
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 text-sm border border-red-300 rounded-md hover:bg-red-100 text-red-700"
              >
                Ricarica app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}