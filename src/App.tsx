import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { Layout } from './components/Layout';
import { EmptyState, InlineLink, ToastProvider } from './components/ui';
import { useDatabase } from './store/useDatabase';
import { Dashboard } from './pages/Dashboard';

const Assets = lazy(() => import('./pages/Assets').then((m) => ({ default: m.Assets })));
const AssetDetail = lazy(() => import('./pages/Assets').then((m) => ({ default: m.AssetDetail })));
const Findings = lazy(() => import('./pages/Findings').then((m) => ({ default: m.Findings })));
const PPE = lazy(() => import('./pages/PPE').then((m) => ({ default: m.PPE })));
const Documents = lazy(() => import('./pages/Documents').then((m) => ({ default: m.Documents })));
const Alerts = lazy(() => import('./pages/Alerts').then((m) => ({ default: m.Alerts })));

function FailureScreen() {
  return (
    <div className="fatal-error">
      <h1>No se pudo mostrar esta vista</h1>
      <p>Tus datos siguen en este navegador. Recarga la aplicación para intentarlo de nuevo.</p>
      <button className="button primary" onClick={() => window.location.reload()}>
        Recargar aplicación
      </button>
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <FailureScreen /> : this.props.children;
  }
}
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Layout />} errorElement={<FailureScreen />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/activos" element={<Assets />} />
      <Route path="/activos/:id" element={<AssetDetail />} />
      <Route path="/hallazgos" element={<Findings />} />
      <Route path="/epp" element={<PPE />} />
      <Route path="/estudios-documentos" element={<Documents />} />
      <Route path="/alertas" element={<Alerts />} />
      <Route
        path="*"
        element={
          <EmptyState
            title="Esta página no existe"
            description="Continúa desde el centro de control."
            action={<InlineLink to="/dashboard">Ir al centro de control</InlineLink>}
          />
        }
      />
    </Route>,
  ),
);
export function App() {
  const { ready, loadingFiles, error, initialize } = useDatabase();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (!ready || loadingFiles) return;
    const timer = window.setInterval(() => {
      void useDatabase
        .getState()
        .refreshAlerts()
        .catch(() => {});
    }, 60000);
    return () => window.clearInterval(timer);
  }, [ready, loadingFiles]);
  if (!ready || loadingFiles)
    return (
      <div className="loading-state" role="status">
        <h1>SIGEE</h1>
        <p>{error || 'Preparando tus registros y archivos…'}</p>
        {error && (
          <button className="button primary" onClick={() => void initialize()}>
            Reintentar carga
          </button>
        )}
      </div>
    );
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense
          fallback={
            <div className="loading-state" role="status">
              Cargando SIGEE…
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}
