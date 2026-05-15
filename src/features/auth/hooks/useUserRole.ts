import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@app/providers'
import { supabase } from '@lib/supabase'

export type UserRole = 'admin' | 'vendedor' | null

/**
 * Lee el `role` del perfil del usuario autenticado desde `user_profiles`.
 *
 * Se cachea en React Query (clave `['userRole', userId]`) para no spamear la
 * DB en cada render. La política `user_read_own_profile` de RLS permite a
 * cada usuario leer su propio perfil.
 */
export function useUserRole(): { role: UserRole; isLoading: boolean } {
  const { user, isLoading: authLoading } = useAuth()

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['userRole', user?.id],
    enabled:  !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 min
    queryFn: async (): Promise<UserRole> => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (error || !data) return null
      const r = (data as { role: string | null }).role
      return r === 'admin' || r === 'vendedor' ? r : null
    },
  })

  return {
    role: (role ?? null) as UserRole,
    isLoading: authLoading || (!!user?.id && roleLoading),
  }
}

/** Atajo: ¿es admin? */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { role, isLoading } = useUserRole()
  return { isAdmin: role === 'admin', isLoading }
}
