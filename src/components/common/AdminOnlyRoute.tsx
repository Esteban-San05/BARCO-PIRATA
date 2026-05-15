import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '@features/auth/hooks/useUserRole'
import { LoadingSpinner } from '@components/ui/LoadingSpinner'

/**
 * Restringe rutas a usuarios con `role = 'admin'`.
 *
 * Vendedores y otros autenticados son redirigidos al dashboard. La capa de
 * RLS en Supabase también valida por rol (mig 00015), así que esto es UX
 * — el backend rechazaría la operación de todos modos.
 */
export function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading } = useIsAdmin()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAdmin) {
    // Redirige al dashboard sin pista de que la ruta existe
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
