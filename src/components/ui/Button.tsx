import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Size = 'md' | 'lg' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-leaf-700 select-none cursor-pointer'

const variants: Record<Variant, string> = {
  primary: 'bg-leaf-700 text-white hover:bg-leaf-800 active:bg-leaf-900 shadow-soft hover:shadow-lift',
  secondary: 'bg-harvest-400 text-ink hover:bg-harvest-500 active:bg-harvest-600 shadow-soft font-bold',
  outline: 'border border-cream-300 bg-white text-ink hover:bg-cream-100 hover:border-leaf-600 hover:text-leaf-800 active:bg-cream-200 shadow-2xs',
  ghost: 'text-leaf-800 hover:bg-leaf-50 active:bg-leaf-100',
  danger: 'bg-clay-600 text-white hover:bg-clay-700 active:bg-clay-800 shadow-soft',
}

const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 text-xs',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-13 px-6 text-base',
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
