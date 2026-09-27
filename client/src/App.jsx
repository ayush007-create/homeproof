import { useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { api } from "./api.js";
import { RequireAuth } from "./auth.jsx";
import { DeskFrame } from "./components/DeskFrame.jsx";
import { TopBar } from "./components/TopBar.jsx";
import { setLocationSettings } from "./location.js";
import { setVoiceAvailable, useVoice } from "./voice.js";
import Home from "./pages/Home.jsx";
import Homes from "./pages/Homes.jsx";
import Login from "./pages/Login.jsx";
import Report from "./pages/Report.jsx";
import Room from "./pages/Room.jsx";
import RoomNew from "./pages/RoomNew.jsx";

export default function App() {
  // Ask the server which optional features (voice) are on, and the location rules.
  useEffect(() => {
    api
      .config()
      .then((c) => {
        setVoiceAvailable(c.voice);
        setLocationSettings(c.location);
      })
      .catch(() => {});
  }, []);

  return (
    <DeskFrame>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/homes" element={<Homes />} />
          <Route path="/homes/:homeId" element={<Home />} />
          <Route path="/homes/:homeId/rooms/new" element={<RoomNew />} />
          <Route path="/homes/:homeId/rooms/:roomId" element={<Room />} />
          <Route path="/homes/:homeId/report" element={<Report />} />
        </Route>
        <Route path="*" element={<Navigate to="/homes" replace />} />
      </Routes>
    </DeskFrame>
  );
}

// Top bar + the current screen + footer, for every logged-in screen.
function Layout() {
  const { pathname } = useLocation();
  const voice = useVoice();
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("phone-scroll")?.scrollTo(0, 0); // laptop phone frame
  }, [pathname]);

  return (
    <div className="app">
      <TopBar />
      {/* key restarts the enter animation on each new screen */}
      <div className="screen" key={pathname}>
        <Outlet />
      </div>
      <footer className="app-footer">
        <span>Values are estimates, not appraisals.</span>
        {voice.available && <span>Voice by ElevenLabs</span>}
      </footer>
    </div>
  );
}
