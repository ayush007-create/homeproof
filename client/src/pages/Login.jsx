import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { FileText, ScanLine, ShieldCheck, Video } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { Field, FieldError } from "../components/Field.jsx";
import { Logo } from "../components/Logo.jsx";
import { Splash } from "../components/States.jsx";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login"); // login | signup
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const goTo = location.state?.from || "/homes";
  if (auth.user === undefined) return <Splash />;
  if (auth.user) return <Navigate to={goTo} replace />;

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    setErrors({ ...errors, [key]: undefined, form: undefined });
  };

  function check() {
    const next = {};
    if (mode === "signup" && !form.name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (mode === "signup" && form.password.length < 8) next.password = "Use at least 8 characters.";
    if (mode === "login" && !form.password) next.password = "Enter your password.";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function submit(e) {
    e.preventDefault();
    if (!check()) return;
    setBusy(true);
    try {
      if (mode === "signup") await auth.signup(form);
      else await auth.login({ email: form.email, password: form.password });
      navigate(goTo, { replace: true });
    } catch (err) {
      setErrors({ [err.field || "form"]: err.message });
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(mode === "login" ? "signup" : "login");
    setErrors({});
  }

  return (
    <main className="login page">
      <div className="login-brand">
        <div className="brand-row">
          <Logo size={48} />
          <h1 className="name">HomeProof</h1>
        </div>
        <p className="tagline">
          Film your room once.
          <br />
          <span>Be ready for anything.</span>
        </p>
      </div>

      {/* How it works, before the form (not a marketing page). */}
      <div className="how-tiles">
        <div className="how-tile"><Video size={20} />Film each room</div>
        <div className="how-tile"><ScanLine size={20} />We list every item &amp; value</div>
        <div className="how-tile"><FileText size={20} />Download a claim report</div>
      </div>

      <div className="login-card card">
        <h2>{mode === "login" ? "Log in" : "Create your account"}</h2>

        <form onSubmit={submit} noValidate className="stack-sm">
          {mode === "signup" && (
            <Field label="Name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
          )}
          <Field label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} error={errors.email} />
          <Field
            label="Password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
          />
          {errors.form && <FieldError>{errors.form}</FieldError>}
          <button className="btn primary full" disabled={busy}>
            {busy ? "One moment…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="switch-mode">
          {mode === "login" ? "New to HomeProof?" : "Already have an account?"}{" "}
          <button className="link-btn" onClick={switchMode}>{mode === "login" ? "Sign up" : "Log in"}</button>
        </p>
      </div>

      <p className="trust-line">
        <ShieldCheck size={20} aria-hidden="true" /> Your videos never leave your phone. Only item photos are saved.
      </p>
    </main>
  );
}
