import React from 'react';
import AzureFileExplorer from './AzureFileExplorer.jsx';
import LoginPage from './LoginPage';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  const [loggedIn, setLoggedIn] = React.useState(() => {
    return localStorage.getItem('isLoggedIn') === 'true';
  });

  React.useEffect(() => {
    localStorage.setItem('isLoggedIn', loggedIn ? 'true' : 'false');
  }, [loggedIn]);
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={loggedIn ? <Navigate to="/" replace /> : <LoginPage onLogin={() => setLoggedIn(true)} />}
        />
        <Route
          path="/"
          element={loggedIn ? <AzureFileExplorer /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    // You can log errorInfo to an error reporting service here
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-boundary">
          <h2 className="app-error-title">Something went wrong.</h2>
          <pre className="app-error-details">{this.state.error?.toString()}</pre>
          <button className="app-error-reload-btn" onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWithErrorBoundary(props) {
  return (
    <ErrorBoundary>
      <App {...props} />
    </ErrorBoundary>
  );
}
