import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { FileText, ScanLine, Video } from "lucide-react";
import QRCode from "qrcode";
import { Wordmark } from "./Logo.jsx";

const STAGES = [
  { label: "Film each room", icon: Video },
  { label: "See every item & value", icon: ScanLine },
  { label: "Download a claim report", icon: FileText },
];

// Which stage the current screen belongs to (highlighted in the rail).
function stageFor(path) {
  if (/\/rooms\/new$/.test(path)) return 0;
  if (/\/rooms\/[^/]+$/.test(path)) return 1;
  if (/\/report$/.test(path)) return 2;
  return -1;
}

// On laptops and projectors (≥ 1024px) the app is shown in a phone frame with
// the brand and a 3-step rail on the left and a QR code on the right.
// On phones the rail and QR panel are hidden by CSS and nothing changes.
export function DeskFrame({ children }) {
  const { pathname } = useLocation();
  const stage = stageFor(pathname);
  const [qr, setQr] = useState("");
  // The address phones should open: the hosted site (VITE_PUBLIC_URL), or wherever this page is served from.
  const url = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#14202b", light: "#ffffff" } })
      .then(setQr)
      .catch(() => {});
  }, [url]);

  return (
    <div className="desk">
      <aside className="desk-rail" aria-hidden="true">
        <Wordmark size={36} />
        <p className="tagline">
          Film your room once. <span>Be ready for anything.</span>
        </p>
        <div className="rail-steps">
          {STAGES.map(({ label, icon: Icon }, i) => (
            <div key={label} className={`rail-step ${i === stage ? "active" : ""}`}>
              <Icon size={20} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </aside>

      <div className="desk-phone" id="phone">
        <div className="desk-scroll" id="phone-scroll">
          {children}
        </div>
      </div>

      <aside className="desk-side" aria-hidden="true">
        {qr && <div className="desk-qr" dangerouslySetInnerHTML={{ __html: qr }} />}
        <strong>Try it on your phone</strong>
        <span className="desk-url">{url.replace(/^https?:\/\//, "")}</span>
        <span className="muted">Install HomeProof from your browser. Your videos never leave your phone.</span>
      </aside>
    </div>
  );
}
