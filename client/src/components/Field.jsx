import { useId } from "react";
import { CircleAlert } from "lucide-react";

// Labelled input with its error shown right under it (never a pop-up).
// `optional` adds a light "(optional)" after the label.
export function Field({ label, optional, error, hint, ...inputProps }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="opt"> (optional)</span>}
      </label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error || hint ? `${id}-note` : undefined} {...inputProps} />
      {error ? <FieldError id={`${id}-note`}>{error}</FieldError> : hint && <p className="field-hint" id={`${id}-note`}>{hint}</p>}
    </div>
  );
}

export function FieldError({ children, id }) {
  return (
    <p className="field-error" id={id} role="alert">
      <CircleAlert size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
