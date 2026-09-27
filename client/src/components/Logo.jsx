import { Check, House } from "lucide-react";

// HomeProof mark: teal tile with a house, plus an amber "checked" badge.
export function Logo({ size = 32 }) {
  return (
    <span className="logo-mark" style={{ width: size, height: size, borderRadius: size * 0.29 }} aria-hidden="true">
      <House size={size * 0.55} />
      <span className="logo-badge">{size >= 40 && <Check size={size * 0.23} strokeWidth={3.5} />}</span>
    </span>
  );
}

export function Wordmark({ size = 28 }) {
  return (
    <span className="wordmark">
      <Logo size={size} />
      <span>HomeProof</span>
    </span>
  );
}
