import { lazy } from 'react';
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
import PageErrorBoundary from '@/components/PageErrorBoundary';

// LE PAGINE SI SCARICANO QUANDO SI APRONO (10/10/2026).
//
// Prima erano ventisette import statici: tutte le pagine del gestionale
// finivano nello stesso pacchetto, e chi apriva la dashboard scaricava anche
// la fatturazione, le omologhe e la qualifica fornitori. Il chunk principale
// era 3,3 MB e la build lo diceva a ogni giro.
//
// Ora ogni pagina e' un file a parte, scaricato la prima volta che la si apre e
// poi tenuto in cache dal browser. L'attesa e' il tempo di qualche decina di kB,
// e intanto il menu resta a video: il Suspense sta dentro Layout, attorno
// all'Outlet, non attorno a tutto - altrimenti a ogni cambio di pagina
// scomparirebbe anche la barra laterale, che e' peggio di aspettare.
//
// Il guscio (Layout, ProtectedRoute, PageErrorBoundary, PageNotFound) resta
// eager: serve subito, e scaricarlo a parte vorrebbe dire due viaggi invece di
// uno.
//
// Una pagina aggiunta qui va aggiunta cosi', non con un import in testa:
// prove/paginePigre.mjs non lo lascia passare.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CaricamentoDati = lazy(() => import('@/pages/CaricamentoDati'));
const TargetStatus = lazy(() => import('@/pages/TargetStatus'));
const Assistente = lazy(() => import('@/pages/Assistente'));
const Report = lazy(() => import('@/pages/Report'));
const ReportMensile = lazy(() => import('@/pages/ReportMensile'));
const Terziarie = lazy(() => import('@/pages/Terziarie'));
const ExtraRaccolta = lazy(() => import('@/pages/ExtraRaccolta'));
const Assegnati = lazy(() => import('@/pages/Assegnati'));
const AssegnatiAci = lazy(() => import('@/pages/AssegnatiAci'));
const Secondarie = lazy(() => import('@/pages/Secondarie'));
const AlertEngine = lazy(() => import('@/pages/AlertEngine'));
const Fatturazione = lazy(() => import('@/pages/Fatturazione'));
const PredittivitaSecondarie = lazy(() => import('@/pages/PredittivitaSecondarie'));
const PrimarieRete = lazy(() => import('@/pages/PrimarieRete'));
const PrimarieAci = lazy(() => import('@/pages/PrimarieAci'));
const TodoPage = lazy(() => import('@/pages/TodoPage'));
const Pdr = lazy(() => import('@/pages/Pdr'));
const Giacenze = lazy(() => import('@/pages/Giacenze'));
const QualificaFornitori = lazy(() => import('@/pages/QualificaFornitori'));
const Richieste = lazy(() => import('@/pages/Richieste'));
const Utenti = lazy(() => import('@/pages/Utenti'));
const Omologhe = lazy(() => import('@/pages/Omologhe'));
const DichiarazioniRentri = lazy(() => import('@/pages/DichiarazioniRentri'));
const DichiarazioniImpianti = lazy(() => import('@/pages/DichiarazioniImpianti'));
const Verifiche = lazy(() => import('@/pages/Verifiche'));
const VerificheFornitori = lazy(() => import('@/pages/VerificheFornitori'));
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
          {/* I target annuali sono ora nella scheda Impianti e stoccaggi di Target & Status */}
          <Route path="/target-annuali" element={<Navigate to="/target-status?tab=impianti" replace />} />
          <Route path="/target-status" element={<PageErrorBoundary><TargetStatus /></PageErrorBoundary>} />
          <Route path="/report-mensile" element={<PageErrorBoundary><ReportMensile /></PageErrorBoundary>} />
          <Route path="/primarie-rete" element={<PrimarieRete />} />
          <Route path="/terziarie" element={<Terziarie />} />
          <Route path="/extra-raccolta" element={<ExtraRaccolta />} />
          <Route path="/assegnati" element={<Assegnati />} />
          <Route path="/assegnati-aci" element={<AssegnatiAci />} />
          <Route path="/secondarie" element={<Secondarie />} />
          <Route path="/alert-engine" element={<AlertEngine />} />
          <Route path="/fatturazione" element={<Fatturazione />} />
          <Route path="/qualifica-fornitori" element={<PageErrorBoundary><QualificaFornitori /></PageErrorBoundary>} />
          <Route path="/assistente" element={<PageErrorBoundary><Assistente /></PageErrorBoundary>} />
          <Route path="/report" element={<PageErrorBoundary><Report /></PageErrorBoundary>} />
          <Route path="/verifiche" element={<PageErrorBoundary><Verifiche /></PageErrorBoundary>} />
          <Route path="/verifiche-fornitori" element={<PageErrorBoundary><VerificheFornitori /></PageErrorBoundary>} />
          <Route path="/predittivita-secondarie" element={<PredittivitaSecondarie />} />
          <Route path="/primarie-aci" element={<PrimarieAci />} />
          <Route path="/todo" element={<TodoPage />} />
          <Route path="/pdr" element={<Pdr />} />
          <Route path="/giacenze" element={<Giacenze />} />
          <Route path="/richieste" element={<PageErrorBoundary><Richieste /></PageErrorBoundary>} />
          <Route path="/utenti" element={<PageErrorBoundary><Utenti /></PageErrorBoundary>} />
          <Route path="/omologhe" element={<PageErrorBoundary><Omologhe /></PageErrorBoundary>} />
          <Route path="/dichiarazioni-rentri" element={<PageErrorBoundary><DichiarazioniRentri /></PageErrorBoundary>} />
          <Route path="/dichiarazioni-impianti" element={<PageErrorBoundary><DichiarazioniImpianti /></PageErrorBoundary>} />
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