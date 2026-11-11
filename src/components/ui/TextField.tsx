import { useId, type InputHTMLAttributes } from 'react'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  id?: string
  hint?: string
  error?: string
}

export function TextField({
  label,
  id,
  hint,
  error,
  className = '',
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const {
    'aria-describedby': externalDescribedBy,
    'aria-invalid': inputInvalid,
    ...inputProps
  } = props
  const describedBy = [externalDescribedBy, hintId, errorId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="text-field">
      <label className="text-field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : inputInvalid}
        className={`text-field__control ${className}`.trim()}
        id={inputId}
        {...inputProps}
      />
      {hint && !error && (
        <p className="text-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-field__error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}
