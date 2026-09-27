import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { api, setUnauthorizedHandler } from "./api.js";
import { Splash } from "./components/States.jsx";

// Who is logged in. `user` is undefined while checking, null when logged out.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const value = {
    user,
    async login(data) {
      setUser((await api.login(data)).user);
    },
    async signup(data) {
      setUser((await api.signup(data)).user);
    },
    async logout() {
      await api.logout().catch(() => {});
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Wraps every screen except /login. Logged-out users go to /login and come back afterwards.
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
