import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, EllipsisVertical, PackagePlus, Pencil, Plus, RotateCcw, ScanLine, SearchX, ShieldCheck, Square, Trash2, Volume2, X } from "lucide-react";
import { api } from "../api.js";
import { money, plural, spokenMoney } from "../format.js";
import Results from "../Results.jsx";
import { NoItemsArt } from "../components/Illustrations.jsx";
import { RoomIcon } from "../components/RoomIcon.jsx";
import { ScanFlow } from "../components/ScanFlow.jsx";
import { Sheet, SheetActions } from "../components/Sheet.jsx";
import { CardSkeletons, EmptyState, ErrorState, Skeleton } from "../components/States.jsx";
import { playNow, prepareSpeech, say, stopSpeech } from "../voice.js";
import { DeleteSheet, EditSheet } from "./Home.jsx";

// What the voice says after a scan.
function scanSentence(items) {
  if (!items.length) return "";
  const total = items.reduce((s, it) => s + it.estValue, 0);
  const top = items.reduce((a, b) => (b.estValue > a.estValue ? b : a));
  return (
    `I found ${plural(items.length, "item")} worth about ${spokenMoney(total)}. ` +
    `Your most valuable item is your ${top.name}, around ${spokenMoney(top.estValue)}.`
  );
}

// What the voice says after new things are added.
function addedSentence(added, room) {
  if (!added.length) return "I didn't find anything new. Everything in that clip is already on your list.";
  const total = added.reduce((s, it) => s + it.estValue, 0);
  const roomTotal = room.items.reduce((s, it) => s + it.estValue, 0);
  return (
    `I added ${plural(added.length, "new item")} worth about ${spokenMoney(total)}. ` +
    `${room.name} is now worth about ${spokenMoney(roomTotal)}.`
  );
}

export default function Room() {
  const { homeId, roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [sheet, setSheet] = useState(null); // options | rename | rescan | delete
  const [scanning, setScanning] = useState(null); // null | "scan" (replace items) | "add" (add new things)
  const [justAdded, setJustAdded] = useState(null); // ids of the items the last "add" clip found
  const [fresh, setFresh] = useState(Boolean(location.state?.justScanned)); // reveal + voice
  const [scanKey, setScanKey] = useState(0);
  const playVoice = useRef(null);
  const [home, setHome] = useState(null);
  const [scanStarted, setScanStarted] = useState(false); // scanning screen showing (hides the title)
  const [voiceNote, setVoiceNote] = useState("");

  useEffect(() => {
    api.home(homeId).then((r) => setHome(r.home)).catch(() => {});
  }, [homeId]);

  const load = useCallback(() => {
    setError(null);
    api.room(homeId, roomId).then((r) => setRoom(r.room)).catch(setError);
  }, [homeId, roomId]);
  useEffect(() => {
    load();
  }, [load]);

  // A refresh shouldn't replay the reveal and the voice.
  useEffect(() => {
    if (location.state?.justScanned) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start fetching the voice line as soon as a fresh scan is on screen.
  useEffect(() => {
    if (fresh && room && !playVoice.current) playVoice.current = prepareSpeech(scanSentence(room.items));
  }, [fresh, room]);

  const back = (
    <Link to={`/homes/${homeId}`} className="back-link">
      <ChevronLeft size={22} /> {home?.name || "Home"}
    </Link>
  );

  if (error) {
    return (
      <main className="page">
        {back}
        <ErrorState
          title={error.status === 404 ? "Room not found" : "Couldn't load this room"}
          message={error.status === 404 ? "It may have been deleted." : error.message}
          onRetry={error.status === 404 ? null : load}
        />
      </main>
    );
  }

  if (!room) {
    return (
      <main className="page">
        {back}
        <Skeleton className="sk-title" />
        <Skeleton className="sk-hero" />
        <CardSkeletons count={4} />
      </main>
    );
  }

  if (scanning && home) {
    const adding = scanning === "add";
    return (
      <main className="page has-bar">
        <div className="page-nav">
          <button className="back-link" onClick={() => setScanning(null)}>
            <ChevronLeft size={22} /> Cancel
          </button>
        </div>
        {!scanStarted && (
          <div className="page-head">
            <span className="eyebrow">{adding ? "Add new items" : room.scannedAt ? "Re-scan" : "Scan"}</span>
            <h1>{room.name}</h1>
          </div>
        )}
        <ScanFlow
          mode={scanning}
          home={home}
          homeId={homeId}
          roomName={room.name}
          onScanningChange={setScanStarted}
          getRoomId={async () => room._id}
          onDone={(updated, addedIds) => {
            setRoom(updated);
            setScanning(null);
            playVoice.current = null;
            if (adding) {
              // Keep the list as it is and point out what's new.
              const ids = new Set(addedIds);
              setJustAdded(addedIds);
              setFresh(false);
              say(addedSentence(updated.items.filter((it) => ids.has(it._id)), updated));
            } else {
              setJustAdded(null);
              setFresh(true);
            }
            setScanKey((k) => k + 1);
            window.scrollTo(0, 0);
            document.getElementById("phone-scroll")?.scrollTo(0, 0);
          }}
        />
      </main>
    );
  }

  const startScan = () => (room.items.length ? setSheet("rescan") : setScanning("scan"));
  const startAdd = () => setScanning("add");
  const added = justAdded && room.items.filter((it) => justAdded.includes(it._id));

  return (
    <main className="page has-bar">
      <div className="page-nav">
        {back}
        <button className="icon-btn" onClick={() => setSheet("options")} aria-label="Room options">
          <EllipsisVertical size={22} />
        </button>
      </div>
      <div className="room-head">
        <span className="tile md"><RoomIcon name={room.name} /></span>
        <h1>{room.name}</h1>
        {room.items.length > 0 && <SummaryButton text={scanSentence(room.items)} onNote={setVoiceNote} />}
      </div>
      {room.locationProof && (
        <p className="verified-line">
          <ShieldCheck size={16} aria-hidden="true" /> Recorded at {home?.name || "this home"} · location verified
        </p>
      )}
      {voiceNote && <p className="voice-note" role="status">{voiceNote}</p>}
      {added && <AddedBanner added={added} onClose={() => setJustAdded(null)} />}

      {room.items.length ? (
        <Results
          key={scanKey}
          homeId={homeId}
          room={room}
          reveal={fresh}
          newIds={justAdded}
          onRoomChange={setRoom}
          onFirstItem={() => playVoice.current?.()}
        />
      ) : room.scannedAt ? (
        <EmptyState art={<NoItemsArt />} title="No items found">
          Try again with more light, slower movement and the camera closer to your things.
        </EmptyState>
      ) : (
        <EmptyState art={<NoItemsArt />} title="This room hasn't been scanned yet">
          Film the room and HomeProof will list what's in it.
        </EmptyState>
      )}

      <div className="bottom-bar">
        {room.items.length ? (
          <>
            <button className="btn secondary" onClick={startScan} aria-label="Re-scan the whole room">
              <RotateCcw size={18} />
              <span className="wide-only">Re-scan</span>
            </button>
            <button className="btn secondary grow" onClick={startAdd}>
              <Plus size={20} /> Add<span className="hide-xs"> items</span>
            </button>
            <Link to={`/homes/${homeId}`} className="btn primary grow">
              <Check size={20} /> Done
            </Link>
          </>
        ) : (
          <button className="btn primary grow" onClick={() => setScanning("scan")}>
            <ScanLine size={20} /> {room.scannedAt ? "Scan again" : "Scan this room"}
          </button>
        )}
      </div>

      {sheet === "options" && (
        <Sheet title={room.name} onClose={() => setSheet(null)}>
          <SheetActions
            actions={[
              { label: "Rename room", icon: Pencil, onClick: () => setSheet("rename") },
              ...(room.items.length ? [{ label: "Add new items", icon: PackagePlus, onClick: () => (setSheet(null), startAdd()) }] : []),
              { label: "Re-scan room", icon: RotateCcw, onClick: () => (setSheet(null), startScan()) },
              { label: "Delete room", icon: Trash2, danger: true, onClick: () => setSheet("delete") },
            ]}
          />
        </Sheet>
      )}
      {sheet === "rename" && (
        <EditSheet
          title="Rename room"
          label="Room name"
          value={room.name}
          maxLength={60}
          required
          onClose={() => setSheet(null)}
          onSave={async (name) => setRoom((await api.updateRoom(homeId, roomId, { name })).room)}
        />
      )}
      {sheet === "rescan" && (
        <DeleteSheet
          title="Re-scan this room?"
          message={`The new scan will replace the ${plural(room.items.length, "item")} in ${room.name}, including any edits and serial numbers you added. To keep them and film only new things, use Add items instead.`}
          icon={RotateCcw}
          tone="neutral"
          confirmLabel="Replace items"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            setSheet(null);
            setScanning("scan");
          }}
        />
      )}
      {sheet === "delete" && (
        <DeleteSheet
          title="Delete this room?"
          message={`${room.name} and its ${plural(room.items.length, "item")} and photos will be removed. This can't be undone.`}
          stats={[
            { value: room.items.length, label: room.items.length === 1 ? "item" : "items" },
            { value: room.items.filter((it) => it.photoId).length, label: "photos" },
            { value: money(room.items.reduce((sum, it) => sum + it.estValue, 0)), label: "estimated" },
          ]}
          confirmLabel="Delete room"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await api.deleteRoom(homeId, roomId);
            navigate(`/homes/${homeId}`, { replace: true });
          }}
        />
      )}
    </main>
  );
}

// Shown after an "add items" clip: how many new things were added and what they're worth.
function AddedBanner({ added, onClose }) {
  const total = added.reduce((s, it) => s + it.estValue, 0);
  return (
    <div className={`added-banner card ${added.length ? "" : "none"}`} role="status">
      <span className={`tile sm ${added.length ? "" : "amber"}`}>
        {added.length ? <PackagePlus size={18} /> : <SearchX size={18} />}
      </span>
      <div className="text">
        {added.length ? (
          <>
            <strong>{plural(added.length, "new item")} added</strong>
            <span>+{money(total)} to this room. Marked “New” below.</span>
          </>
        ) : (
          <>
            <strong>No new items found</strong>
            <span>Everything in that clip is already on your list.</span>
          </>
        )}
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
        <X size={18} />
      </button>
    </div>
  );
}

// Plays the spoken room summary (ElevenLabs). Tap again to stop.
function SummaryButton({ text, onNote }) {
  const [state, setState] = useState("idle"); // idle | loading | playing

  useEffect(() => stopSpeech, []); // stop talking when leaving the room

  async function onClick() {
    if (state === "playing") return stopSpeech();
    onNote("");
    setState("loading");
    const result = await playNow(text, { onPlaying: () => setState("playing") });
    setState("idle");
    if (result === "unavailable") onNote("Voice isn't set up yet.");
    if (result === "failed") onNote("Couldn't play the summary. Try again.");
  }

  return (
    <button
      className="pill-btn"
      onClick={onClick}
      disabled={state === "loading"}
      aria-label={state === "playing" ? "Stop the spoken summary" : "Play the spoken summary"}
    >
      {state === "loading" ? (
        <><span className="spin accent" /> Loading…</>
      ) : state === "playing" ? (
        <><Square size={14} fill="currentColor" /> Stop</>
      ) : (
        <><Volume2 size={16} /> Summary</>
      )}
    </button>
  );
}
