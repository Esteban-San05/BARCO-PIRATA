import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { PublicLayout } from '@components/layout/PublicLayout'
import { AdminLayout } from '@components/layout/AdminLayout'
import { ProtectedRoute } from '@components/common/ProtectedRoute'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'
import { AdminThemeProvider } from '@app/providers/AdminThemeProvider'

// Lazy-loading de páginas para mejor performance (code splitting)
const HomePage           = lazy(() => import('@pages/public/HomePage'))
const ReservationPage    = lazy(() => import('@pages/public/ReservationPage'))
const ConfirmationPage   = lazy(() => import('@pages/public/ConfirmationPage'))
const ClimaPage          = lazy(() => import('@pages/public/ClimaPage'))
const GalleryPage        = lazy(() => import('@pages/public/GalleryPage'))

const LoginPage          = lazy(() => import('@pages/admin/LoginPage'))
const DashboardPage      = lazy(() => import('@pages/admin/DashboardPage'))
const ReservationsPage   = lazy(() => import('@pages/admin/ReservationsPage'))
const SalePage           = lazy(() => import('@pages/admin/SalePage'))
const ReportsPage        = lazy(() => import('@pages/admin/ReportsPage'))
const AdminSettingsPage  = lazy(() => import('@pages/admin/AdminSettingsPage'))
const SchedulePage       = lazy(() => import('@pages/admin/SchedulePage'))
const BitacoraPage       = lazy(() => import('@pages/admin/BitacoraPage'))
const BackupPage         = lazy(() => import('@pages/admin/BackupPage'))

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <LoadingSpinner size="lg" />
  </div>
)

const withSuspense = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
)

export const router = createBrowserRouter([
  // ─── Rutas públicas ──────────────────────────────────────────────────────
  {
    element: <PublicLayout />,
    children: [
      { path: '/',                      element: withSuspense(<HomePage />) },
      { path: '/reservar',              element: withSuspense(<ReservationPage />) },
      { path: '/reservar/confirmacion', element: withSuspense(<ConfirmationPage />) },
      { path: '/clima',                 element: withSuspense(<ClimaPage />) },
      { path: '/galeria',               element: withSuspense(<GalleryPage />) },
    ],
  },

  // ─── Login (sin layout común) ────────────────────────────────────────────
  {
    path: '/admin/login',
    element: withSuspense(<LoginPage />),
  },

  // ─── Rutas de administración (protegidas) ────────────────────────────────
  {
    element: (
      <ProtectedRoute>
        <AdminThemeProvider>
          <AdminLayout />
        </AdminThemeProvider>
      </ProtectedRoute>
    ),
    children: [
      { path: '/admin',                          element: withSuspense(<DashboardPage />) },
      { path: '/admin/reservaciones',            element: withSuspense(<ReservationsPage />) },
      { path: '/admin/venta/:reservationId',     element: withSuspense(<SalePage />) },
      { path: '/admin/reportes',                 element: withSuspense(<ReportsPage />) },
      { path: '/admin/ajustes',                  element: withSuspense(<AdminSettingsPage />) },
      { path: '/admin/horarios',                 element: withSuspense(<SchedulePage />) },
      { path: '/admin/bitacora',                 element: withSuspense(<BitacoraPage />) },
      { path: '/admin/respaldo',                 element: withSuspense(<BackupPage />) },
    ],
  },

  // ─── Fallback ────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
])
