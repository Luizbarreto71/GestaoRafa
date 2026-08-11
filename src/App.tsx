import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StockPage = lazy(() => import('./pages/StockPage'));
const SalesPage = lazy(() => import('./pages/SalesPage'));
const MovementsPage = lazy(() => import('./pages/MovementsPage'));
const StockMovementPage = lazy(() => import('./pages/StockMovementPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function FullScreenLoader() {
  return (
    <div className="flex h-full min-h-[60vh] w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <FullScreenLoader /> : isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="/estoque"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <StockPage />
            </Suspense>
          }
        />
        <Route
          path="/vendas"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <SalesPage />
            </Suspense>
          }
        />
        <Route
          path="/movimentacao"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <StockMovementPage />
            </Suspense>
          }
        />
        <Route
          path="/movimentacoes"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <MovementsPage />
            </Suspense>
          }
        />
        <Route
          path="/clientes"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <CustomersPage />
            </Suspense>
          }
        />
        <Route
          path="/relatorios"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <ReportsPage />
            </Suspense>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <SettingsPage />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
