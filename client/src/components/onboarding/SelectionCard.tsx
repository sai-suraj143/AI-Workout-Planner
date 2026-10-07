import { CheckIcon } from '../icons';

export type SelectionVariant = 'card' | 'chip';

interface SelectionCardProps<T extends string | number> {
  /** Radio groups: every option in the group shares the same `name`. */
  name: string;
  type?: 'radio' | 'checkbox';
  /** Value reported to `onChange` — matches the backend option value. */
  value: T;
  label: string;
  /** Optional supporting copy rendered inside the label. */
  description?: string;
  checked: boolean;
  onChange: (value: T) => void;
  variant?: SelectionVariant;
}

const INDICATOR_BASE = 'flex shrink-0 items-center justify-center border-2 transition-colors';

const radioIndicator = (checked: boolean) => (
  <span
    aria-hidden="true"
    className={`${INDICATOR_BASE} h-5 w-5 rounded-full ${
      checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
    }`}
  >
    <span className={`h-2 w-2 rounded-full ${checked ? 'bg-white' : 'bg-transparent'}`} />
  </span>
);

const checkboxIndicator = (checked: boolean) => (
  <span
    aria-hidden="true"
    className={`${INDICATOR_BASE} h-5 w-5 rounded-md ${
      checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
    }`}
  >
    <CheckIcon className={`h-3 w-3 ${checked ? 'opacity-100' : 'opacity-0'}`} />
  </span>
);

/**
 * A native `<input>` (visually hidden) inside a real `<label>`.
 *
 * Using the native control means keyboard operation, arrow-key navigation for
 * radio groups, focus handling and screen-reader semantics all come for free —
 * the visible card is decoration around a genuine form control rather than a
 * clickable `<div>`.
 *
 * Generic over the option value so callers keep their literal union types and
 * never have to cast.
 */
function SelectionCard<T extends string | number>({
  name,
  type = 'radio',
  value,
  label,
  description,
  checked,
  onChange,
  variant = 'card',
}: SelectionCardProps<T>) {
  const indicator = type === 'radio' ? radioIndicator(checked) : checkboxIndicator(checked);

  if (variant === 'chip') {
    return (
      <label
        className={[
          'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium',
          'transition-colors focus-within:ring-4 focus-within:ring-brand-500/25 focus-within:outline-none',
          checked
            ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-600/30'
            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
        ].join(' ')}
      >
        <input
          type={type}
          name={name}
          value={String(value)}
          checked={checked}
          onChange={() => onChange(value)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 ${
            type === 'radio' ? 'rounded-full' : 'rounded'
          } ${
            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
          }`}
        >
          {type === 'checkbox' ? (
            <CheckIcon className={`h-2.5 w-2.5 ${checked ? 'opacity-100' : 'opacity-0'}`} />
          ) : null}
        </span>
        <span className="min-w-0 break-words">{label}</span>
      </label>
    );
  }

  return (
    <label
      className={[
        'flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-3.5',
        'transition-colors focus-within:ring-4 focus-within:ring-brand-500/25 focus-within:outline-none',
        checked
          ? 'border-brand-600 bg-brand-50/70 ring-2 ring-brand-600/30'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <input
        type={type}
        name={name}
        value={String(value)}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {indicator}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

export default SelectionCard;
