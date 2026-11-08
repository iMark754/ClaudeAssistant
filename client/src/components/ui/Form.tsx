import clsx from 'clsx';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const controlBase =
  'w-full rounded-lg border bg-white px-3 text-sm text-slate-900 shadow-xs transition-colors placeholder:text-slate-400 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:border-brand-600';

const controlState = (invalid?: boolean) => (invalid ? 'border-red-400 focus-visible:outline-red-500' : 'border-slate-300 hover:border-slate-400');

interface ControlProps {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & ControlProps>(function TextInput(
  { invalid, className, ...rest },
  ref,
) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={clsx(controlBase, controlState(invalid), 'h-10', className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps>(function TextArea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx(controlBase, controlState(invalid), 'min-h-24 py-2 leading-relaxed', className)} {...rest} />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & ControlProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={clsx(controlBase, controlState(invalid), 'h-10 pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

/**
 * Label + control + hint/error. The control receives `id`, `aria-describedby`
 * and `invalid` automatically.
 */
export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean; required?: boolean }>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, invalid: Boolean(error), required })
    : children;

  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
