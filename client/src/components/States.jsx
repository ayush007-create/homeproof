import { CircleAlert, RefreshCw } from "lucide-react";
import { Logo } from "./Logo.jsx";

// Shown while we check whether the user is logged in.
export function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <Logo size={56} />
    </div>
  );
}

export function Skeleton({ className = "", style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// Placeholder cards while a list loads.
export function CardSkeletons({ count = 3, tall = false }) {
  return (
    <div className="stack-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`card skeleton-card ${tall ? "tall" : ""}`}>
          <Skeleton className="sk-icon" />
          <div className="sk-lines">
            <Skeleton style={{ width: "55%" }} />
            <Skeleton style={{ width: "35%" }} />
          </div>
          <Skeleton className="sk-money" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="state" role="alert">
      <span className="state-icon error-tone">
        <CircleAlert size={26} />
      </span>
      <h2>{title}</h2>
      {message && <p className="muted">{message}</p>}
      {onRetry && (
        <button className="btn secondary" onClick={onRetry}>
          <RefreshCw size={18} /> Try again
        </button>
      )}
    </div>
  );
}

// Left-aligned empty state with the illustration in a soft banded tile.
export function EmptyState({ art, title, children, action }) {
  return (
    <div className="state empty">
      {art && <div className="state-art">{art}</div>}
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}
