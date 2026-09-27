import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LogOut, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../auth.jsx";
import { toggleMute, useVoice } from "../voice.js";
import { toggleTheme, useTheme } from "../theme.js";
import { Wordmark } from "./Logo.jsx";

export function TopBar() {
  const { user, logout } = useAuth();
  const voice = useVoice();
  const theme = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the menu on outside tap or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !menuRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="topbar">
      <Link to="/homes" className="brand" aria-label="HomeProof, go to My Homes">
        <Wordmark />
      </Link>
      <div className="top-actions">
        <button
          className="round-btn"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <div className="menu-wrap" ref={menuRef}>
          <button className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
            <Avatar user={user} />
          </button>
          {open && (
            <div className="menu" role="menu">
              <div className="menu-user">
                <Avatar user={user} size={40} />
                <div>
                  <strong>{user.name}</strong>
                  <span className="muted small">{user.email}</span>
                </div>
              </div>
              {voice.available && (
                <button className="menu-item" role="menuitemcheckbox" aria-checked={!voice.muted} onClick={toggleMute}>
                  {voice.muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  <span>Voice summaries</span>
                  <span className={`switch ${voice.muted ? "" : "on"}`} aria-hidden="true" />
                </button>
              )}
              <button
                className="menu-item"
                role="menuitem"
                onClick={async () => {
                  await logout();
                  navigate("/login", { replace: true });
                }}
              >
                <LogOut size={20} /> <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function Avatar({ user, size = 36 }) {
  const [broken, setBroken] = useState(false);
  if (user?.avatarUrl && !broken) {
    return (
      <img className="avatar" src={user.avatarUrl} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    );
  }
  return (
    <span className="avatar initial" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {(user?.name || "?").trim()[0]?.toUpperCase()}
    </span>
  );
}
