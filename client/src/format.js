export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

// "Sep 24" this year, "Sep 24, 2025" for older dates.
export function shortDate(d) {
  if (!d) return "";
  const date = new Date(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;

// "about $3,200": rounded the way people say amounts out loud.
export function spokenMoney(n) {
  const step = n >= 1000 ? 100 : 10;
  return money(Math.round(n / step) * step);
}

// Seconds → "MM:SS" (for evidence timestamps).
export function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
