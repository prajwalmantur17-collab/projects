import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors transition-transform transition-shadow duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 disabled:active:brightness-100 focus-visible:outline-3 select-none'

const variants: Record<Variant, string> = {
  primary: 'bg-leaf-700 text-cream-50 hover:bg-leaf-800 active:bg-leaf-900 shadow-soft',
  secondary: 'bg-harvest-400 text-ink hover:bg-harvest-300 active:bg-harvest-500',
  outline: 'border-2 border-leaf-700 bg-white text-leaf-800 hover:bg-leaf-50 active:bg-leaf-100',
  ghost: 'text-leaf-800 hover:bg-leaf-50 active:bg-leaf-100',
  danger: 'bg-clay-600 text-white hover:bg-clay-700 active:bg-clay-800',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

export interface LinkButtonProps extends LinkProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function LinkButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className ?? ''}`}
      {...props}
    >
      {icon}
      {children}
    </Link>
  )
}
