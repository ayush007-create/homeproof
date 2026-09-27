import { Link } from "react-router";
import { LocateOff, MapPin, MapPinCheck, MapPinOff, RefreshCw } from "lucide-react";
import { PERMISSION_MESSAGE, formatAccuracy, formatDistance } from "../location.js";
import { Sheet } from "./Sheet.jsx";

// Shown when location is blocked: why HomeProof needs it and how to allow it.
export function LocationPermissionSheet({ onClose, onRetry }) {
  return (
    <Sheet title="Allow location" onClose={onClose} hideTitle>
      <div className="confirm-head">
        <span className="tile md"><MapPin size={22} /></span>
        <div>
          <h2>Allow location</h2>
          <p>{PERMISSION_MESSAGE}</p>
        </div>
      </div>
      <div className="permission-steps">
        <span className="eyebrow">How to allow it</span>
        <p><strong>iPhone (Safari):</strong> tap <strong>aA</strong> in the address bar → Website Settings → Location → Allow.</p>
        <p><strong>Android (Chrome):</strong> tap the icon left of the address → Permissions → Location → Allow.</p>
        <p><strong>Laptop:</strong> click the icon left of the address → Location → Allow.</p>
      </div>
      <div className="sheet-buttons">
        <button className="btn secondary" onClick={onClose}>Not now</button>
        <button
          className="btn primary"
          onClick={() => {
            onClose();
            onRetry();
          }}
        >
          <RefreshCw size={18} /> Try again
        </button>
      </div>
    </Sheet>
  );
}

// Where the user is compared with the home, above the Record button.
//   loc: from useHomeLocation
export function LocationStatus({ loc, home, onAllow }) {
  const card = (tone, icon, title, sub, action) => (
    <div className={`loc-card card ${tone}`} role="status">
      {icon}
      <div className="text">
        <strong>{title}</strong>
        {sub && <span>{sub}</span>}
      </div>
      {action}
    </div>
  );
  const retry = (
    <button className="btn secondary sm" onClick={loc.retry}>
      Try again
    </button>
  );

  switch (loc.status) {
    case "off":
      return null;
    case "checking":
      return card("", <span className="spin accent loc-spin" aria-hidden="true" />, `Checking you're at ${home.name}…`, "Recording unlocks at home.");
    case "inside":
      return card(
        "ok",
        <span className="tile sm ok"><MapPinCheck size={18} /></span>,
        `You're at ${home.name}`,
        `Location verified · ${formatAccuracy(loc.fix.acc)}`
      );
    case "outside":
      return card(
        "warn",
        <span className="tile sm amber"><MapPinOff size={18} /></span>,
        `You're ${formatDistance(loc.distance)} from ${home.name}`,
        "Recording unlocks when you're at home."
      );
    case "imprecise":
      return card(
        "warn",
        <span className="tile sm amber"><LocateOff size={18} /></span>,
        `Your location is too rough (${formatAccuracy(loc.fix.acc)})`,
        "Turn on Precise Location and Wi-Fi, then try again.",
        retry
      );
    case "denied":
      return card(
        "warn",
        <span className="tile sm amber"><LocateOff size={18} /></span>,
        "Location is off for HomeProof",
        "It's needed to prove the video was recorded at your home.",
        <button className="btn primary sm" onClick={onAllow}>Allow</button>
      );
    case "no-address":
      return card(
        "warn",
        <span className="tile sm amber"><MapPin size={18} /></span>,
        "Add this home's address first",
        "Recording unlocks only at the home's address.",
        <Link className="btn primary sm" to={`/homes/${home._id}?address=1`}>Add</Link>
      );
    case "unsupported":
      return card("warn", <span className="tile sm amber"><LocateOff size={18} /></span>, "This browser can't share your location", "Open HomeProof in Safari or Chrome to record.");
    default:
      return card("warn", <span className="tile sm amber"><LocateOff size={18} /></span>, "Couldn't get your location", "Check that location is on, then try again.", retry);
  }
}
