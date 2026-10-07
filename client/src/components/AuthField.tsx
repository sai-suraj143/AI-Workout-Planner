import { useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { AlertIcon, EyeIcon, EyeOffIcon } from './icons';

interface BaseFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Leading icon element. */
  icon: ReactNode;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const fieldClassName = (hasError: boolean) =>
  `af-input ${hasError ? 'af-input-error' : ''}`;

const FieldError = ({ id, error }: { id: string; error?: string }) => {
  if (!error) return null;
  return (
    <p id={id} className="af-field-error" role="alert">
      <AlertIcon />
      <span>{error}</span>
    </p>
  );
};

/** Text input with leading icon, label, hint and inline validation message. */
export const TextField = ({
  id,
  name,
  label,
  value,
  onChange,
  icon,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
  error,
  required,
}: BaseFieldProps) => {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="af-label">
        {label}
      </label>
      <div className="relative">
        <span
          className={`pointer-events-none absolute inset-y-0 left-3.5 flex items-center ${
            error ? 'text-red-500' : 'text-slate-400'
          }`}
        >
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${fieldClassName(Boolean(error))} pl-11`}
        />
      </div>
      {hint && !error ? (
        <p id={hintId} className="af-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} error={error} />
    </div>
  );
};

interface PasswordFieldProps extends Omit<BaseFieldProps, 'type'> {
  /** Button label announcing the action, e.g. "Show password". */
  toggleLabel?: string;
}

/** Password input with a show/hide toggle. */
export const PasswordField = ({
  id,
  name,
  label,
  value,
  onChange,
  icon,
  autoComplete = 'current-password',
  placeholder = '••••••••',
  hint,
  error,
  required,
  toggleLabel,
}: PasswordFieldProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="af-label">
        {label}
      </label>
      <div className="relative">
        <span
          className={`pointer-events-none absolute inset-y-0 left-3.5 flex items-center ${
            error ? 'text-red-500' : 'text-slate-400'
          }`}
        >
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${fieldClassName(Boolean(error))} af-input-has-toggle pl-11`}
        />
        <button
          type="button"
          onClick={() => setIsVisible((prev) => !prev)}
          className="af-toggle"
          aria-label={`${toggleLabel ?? 'Toggle password'} (${isVisible ? 'hide' : 'show'})`}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {hint && !error ? (
        <p id={hintId} className="af-hint">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} error={error} />
    </div>
  );
};

/** Form-level (server / submission) error banner with a live region. */
export const FormError = ({ message }: { message: string | null }) => {
  if (!message) return null;
  return (
    <div className="af-alert-error" role="alert" aria-live="assertive">
      <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};