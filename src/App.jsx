import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import CaricamentoDati from '@/pages/CaricamentoDati';
import TargetStatus from '@/pages/TargetStatus';
import ReportMensile from '@/pages/ReportMensile';
import Terziarie from '@/pages/Terziarie';
import Assegnati from '@/pages/Assegnati';
import Secondarie from '@/pages/Secondarie';
import AlertEngine from '@/pages/AlertEngine';
import PrimarieRete from '@/pages/PrimarieRete';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/caricamento-dati" element={<CaricamentoDati />} />
          <Route path="/target-status" element={<TargetStatus />} />
          <Route path="/report-mensile" element={<ReportMensile />} />
          <Route path="/primarie-rete" element={<PrimarieRete />} />
          <Route path="/terziarie" element={<Terziarie />} />
          <Route path="/assegnati" element={<Assegnati />} />
          <Route path="/secondarie" element={<Secondarie />} />
          <Route path="/alert-engine" element={<AlertEngine />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App