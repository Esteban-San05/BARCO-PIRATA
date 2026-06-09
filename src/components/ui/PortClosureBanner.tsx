import { AlertOctagon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBusinessSettings } from '@features/settings/hooks/useBusinessSettings'

/**
 * Banner amable que se muestra en páginas públicas cuando el admin
 * marca el puerto como cerrado por emergencia.
 *
 * Renderiza null cuando el puerto está abierto, así que se puede
 * incluir directamente sin condicionales.
 */
export function PortClosureBanner() {
  const { t } = useTranslation()
  const { data } = useBusinessSettings()

  if (!data?.portClosed) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-pirate-50 border-b-2 border-pirate-300"
    >
      <div className="container-app py-4 sm:py-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-pirate-100 flex items-center justify-center shrink-0">
            <AlertOctagon className="w-5 h-5 sm:w-6 sm:h-6 text-pirate-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-pirate-800 text-base sm:text-lg leading-tight">
              {t('portClosure.title')}
            </h3>
            <p className="text-pirate-700 text-sm mt-1 leading-relaxed">
              {t('portClosure.message')}
            </p>
            <p className="text-pirate-600 text-xs mt-1.5">
              {t('portClosure.hint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
