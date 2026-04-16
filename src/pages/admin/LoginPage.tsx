import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Anchor, Lock } from 'lucide-react'
import { useAuth } from '@app/providers'
import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { COMPANY } from '@constants/index'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/admin'
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async ({ email, password }: LoginValues) => {
    setAuthError(null)
    try {
      await signIn(email, password)
      navigate(from, { replace: true })
    } catch {
      setAuthError('Credenciales incorrectas. Verifica tu email y contraseña.')
    }
  }

  return (
    <div className="min-h-screen wave-bg flex items-center justify-center px-4 relative overflow-hidden">
      {/* Halo dorado decorativo */}
      <div className="absolute inset-0 bg-treasure-glow pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-gold-400/10 border border-gold-400/30 p-4 rounded-2xl">
              <Anchor className="w-10 h-10 text-gold-400" />
            </div>
          </div>
          <h1 className="text-2xl font-display font-bold text-gold-shimmer">{COMPANY.shortName}</h1>
          <p className="text-navy-200 mt-1 text-sm">Panel de Administración</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-modal p-8 border border-gold-200">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-navy-900" />
            <h2 className="text-lg font-semibold text-navy-900">Iniciar Sesión</h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              required
              placeholder="admin@barcopirata.mx"
              autoComplete="email"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Contraseña"
              type="password"
              required
              autoComplete="current-password"
              {...register('password')}
              error={errors.password?.message}
            />

            {authError && (
              <div className="panel-danger text-sm">
                {authError}
              </div>
            )}

            <Button type="submit" isLoading={isSubmitting} className="w-full mt-2">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
