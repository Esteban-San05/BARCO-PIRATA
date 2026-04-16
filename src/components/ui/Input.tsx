import { forwardRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
            {props.required && <span className="text-pirate-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'input-field',
            error && 'border-pirate-400 focus:ring-pirate-400',
            className
          )}
          {...props}
        />
        {error && <p className="error-message">{error}</p>}
        {hint && !error && <p className="text-xs text-navy-500 mt-1">{hint}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
