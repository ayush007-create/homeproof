import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

// On laptops the app sits in a phone frame (#phone); sheets open inside it.
const portalTarget = () => document.getElementById("phone") ?? document.body;

// A floating bottom sheet (like native apps) for forms, menus and confirmations.
// Never use window.confirm(): confirmations happen on the page.
export function Sheet({ title, onClose, children, hideTitle = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Runs once when the sheet opens.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    const previous = document.activeElement;
    // Focus the first field, or the sheet itself.
    (ref.current.querySelector("input, textarea") ?? ref.current).focus();
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-handle" aria-hidden="true" />
        {!hideTitle && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    portalTarget()
  );
}

// A list of actions inside a sheet (e.g. Rename / Delete).
export function SheetActions({ actions }) {
  return (
    <div className="sheet-actions">
      {actions.map(({ label, icon: Icon, onClick, danger }) => (
        <button key={label} className={`sheet-action ${danger ? "danger" : ""}`} onClick={onClick}>
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

// Confirmation: icon tile, what happens, optionally a "what you'll lose" strip.
//   stats: [{ value, label }]  e.g. [{ value: 4, label: "rooms" }]
export function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose, busy, error, icon: Icon = Trash2, tone = "danger", stats }) {
  return (
    <Sheet title={title} onClose={onClose} hideTitle>
      <div className="confirm-head">
        <span className={`tile md ${tone === "danger" ? "danger" : ""}`}>
          <Icon size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>
      </div>
      {stats?.length > 0 && (
        <div className="loss-strip">
          {stats.map((s) => (
            <div key={s.label}>
              <span className="num">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="sheet-buttons">
        <button className="btn secondary" onClick={onClose}>Cancel</button>
        <button className={`btn ${tone === "danger" ? "danger" : "primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
