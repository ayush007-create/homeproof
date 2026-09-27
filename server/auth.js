import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail, findUserById } from "./store.js";

// Login is built in-house: passwords are hashed with bcrypt, and the session is
// a signed JWT stored in an httpOnly cookie (JavaScript in the page can't read it).

const COOKIE = "hp_session";
const SESSION_DAYS = 7;
const MIN_PASSWORD = 8;

// Locally the site and API share an origin (Vite proxy), so SameSite=Lax works.
// In production the frontend and API may be on different sites, which needs SameSite=None; Secure.
const crossSite =
  process.env.NODE_ENV === "production" ||
  (process.env.CLIENT_ORIGIN || "").split(",").some((o) => o.trim().startsWith("https://"));

const cookieOptions = {
  httpOnly: true,
  sameSite: crossSite ? "none" : "lax",
  secure: crossSite,
  path: "/",
};

function setSession(res, user) {
  const token = jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

// What the client is allowed to see about a user (never the password hash).
export const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl || null,
});

// Route guard: sets req.userId, or answers 401.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: "Please log in." });
  }
}

const fieldError = (res, field, error, status = 400) => res.status(status).json({ error, field });
const looksLikeEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const authRouter = express.Router();

authRouter.post("/signup", async (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!name) return fieldError(res, "name", "Enter your name.");
  if (!looksLikeEmail(email)) return fieldError(res, "email", "Enter a valid email address.");
  if (password.length < MIN_PASSWORD) {
    return fieldError(res, "password", `Use at least ${MIN_PASSWORD} characters.`);
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return fieldError(res, "email", "An account with this email already exists. Log in instead.", 409);
  }

  const user = await createUser({ name: name.slice(0, 80), email, passwordHash: await bcrypt.hash(password, 10) });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!looksLikeEmail(email)) return fieldError(res, "email", "Enter a valid email address.");
  if (!password) return fieldError(res, "password", "Enter your password.");

  const user = await findUserByEmail(email);
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return fieldError(res, "password", "That email and password don't match.", 401);
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(COOKIE, cookieOptions);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await findUserById(req.userId);
  if (!user) return res.status(401).json({ error: "Please log in." });
  res.json({ user: publicUser(user) });
});
