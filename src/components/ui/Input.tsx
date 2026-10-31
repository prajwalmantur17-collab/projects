import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const controlBase =
  'w-full min-h-12 rounded-xl border-2 border-cream-300 bg-white px-4 py-3 text-base text-ink shadow-xs transition-colors placeholder:text-ink-muted/70 hover:border-cream-300 focus:border-leaf-600 disabled:bg-cream-100 disabled:text-ink-muted'

function controlClasses(hasError: boolean, extra: string): string {
  return `${controlBase} ${hasError ? 'border-clay-500' : ''} ${extra}`
}

function FieldWrapper({
  htmlFor,
  label,
  hint,
  error,
  required,
  children,
}: {
  htmlFor: string
  label: string
  hint?: string
  error?: string | null
  required?: boolean
  children: ReactNode
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-base font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-clay-600" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm leading-snug text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-clay-700" role="alert">
          <span aria-hidden="true">•</span>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string | null
  containerClassName?: string
}

export function Input({
  label,
  hint,
  error,
  id,
  required,
  containerClassName = '',
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName}>
      <FieldWrapper
        htmlFor={inputId}
        label={label}
        hint={hint}
        error={error}
        required={required}
      >
        <input
          id={inputId}
          className={controlClasses(Boolean(error), className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required={required}
          {...props}
        />
      </FieldWrapper>
    </div>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  hint?: string
  error?: string | null
  containerClassName?: string
  children: ReactNode
}

export function Select({
  label,
  hint,
  error,
  id,
  required,
  containerClassName = '',
  className = '',
  children,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const describedBy = [hint ? `${selectId}-hint` : null, error ? `${selectId}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName}>
      <FieldWrapper htmlFor={selectId} label={label} hint={hint} error={error} required={required}>
        <select
          id={selectId}
          className={controlClasses(Boolean(error), className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required={required}
          {...props}
        >
          {children}
        </select>
      </FieldWrapper>
    </div>
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  hint?: string
  error?: string | null
  containerClassName?: string
}

export function Textarea({
  label,
  hint,
  error,
  id,
  required,
  containerClassName = '',
  className = '',
  rows = 3,
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const describedBy = [
    hint ? `${textareaId}-hint` : null,
    error ? `${textareaId}-error` : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={containerClassName}>
      <FieldWrapper
        htmlFor={textareaId}
        label={label}
        hint={hint}
        error={error}
        required={required}
      >
        <textarea
          id={textareaId}
          rows={rows}
          className={controlClasses(Boolean(error), className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          required={required}
          {...props}
        />
      </FieldWrapper>
    </div>
  )
}
