import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Check, ChevronLeft } from "lucide-react";
import { api } from "../api.js";
import { Field } from "../components/Field.jsx";
import { RoomIcon } from "../components/RoomIcon.jsx";
import { ScanFlow } from "../components/ScanFlow.jsx";

const QUICK_PICKS = ["Bedroom", "Kitchen", "Living room", "Bathroom", "Office", "Garage"];

export default function RoomNew() {
  const { homeId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [home, setHome] = useState(null);
  const roomIdRef = useRef(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    api.home(homeId).then((r) => setHome(r.home)).catch(() => {});
  }, [homeId]);

  // The room is created just before the photos are sent (once, even if the scan is retried).
  async function getRoomId() {
    if (!roomIdRef.current) {
      const { room } = await api.createRoom(homeId, { name: name.trim() });
      roomIdRef.current = room._id;
    }
    return roomIdRef.current;
  }

  function validate() {
    if (name.trim()) return true;
    setNameError("Name the room first, or tap one of the suggestions.");
    return false;
  }

  const locked = Boolean(roomIdRef.current);

  return (
    <main className="page has-bar">
      <div className="page-nav">
        <Link to={`/homes/${homeId}`} className="back-link">
          <ChevronLeft size={22} /> {home?.name || "Home"}
        </Link>
      </div>
      {!scanning && (
        <div className="page-head">
          <h1>Add a room</h1>
        </div>
      )}

      {home && <ScanFlow
        home={home}
        homeId={homeId}
        roomName={name.trim()}
        onScanningChange={setScanning}
        getRoomId={getRoomId}
        validate={validate}
        onDone={(room) => navigate(`/homes/${homeId}/rooms/${room._id}`, { replace: true, state: { justScanned: true } })}
        intro={
          <div className="stack-sm">
            <Field
              label="Room name"
              placeholder="e.g. Bedroom"
              value={name}
              maxLength={60}
              disabled={locked}
              onChange={(e) => (setName(e.target.value), setNameError(""))}
              error={nameError}
            />
            {!locked && (
              <div className="chips" role="group" aria-label="Suggestions">
                {QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    className={`chip-btn ${name === pick ? "selected" : ""}`}
                    aria-pressed={name === pick}
                    onClick={() => (setName(pick), setNameError(""))}
                  >
                    {name === pick ? <Check size={16} /> : <RoomIcon name={pick} size={16} />} {pick}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />}
    </main>
  );
}
