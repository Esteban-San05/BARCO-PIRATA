import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { LoadingSpinner } from './LoadingSpinner'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        // Primario = navy sólido (acción principal dominante)
        primary:   'bg-navy-900 hover:bg-navy-800 text-white shadow-card focus:ring-navy-400',
        // Acento = oro pirata (CTAs: "Reservar ahora", "Pagar")
        accent:    'bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold shadow-gold focus:ring-gold-300',
        // Secundario = navy claro (botones alternos)
        secondary: 'bg-navy-100 hover:bg-navy-200 text-navy-900 focus:ring-navy-300',
        // Outline = borde navy
        outline:   'border-2 border-navy-900 text-navy-900 hover:bg-navy-900 hover:text-white focus:ring-navy-400',
        // Ghost = sin fondo, para navegación secundaria
        ghost:     'text-navy-700 hover:bg-navy-100 hover:text-navy-900 focus:ring-navy-300',
        // Danger = rojo pirata (cancelar, eliminar)
        danger:    'bg-pirate-500 hover:bg-pirate-600 text-white shadow-pirate focus:ring-pirate-400',
      },
      size: {
        sm: 'text-xs px-3 py-1.5',
        md: 'text-sm px-5 py-2.5',
        lg: 'text-base px-7 py-3',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading && <LoadingSpinner size="sm" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
