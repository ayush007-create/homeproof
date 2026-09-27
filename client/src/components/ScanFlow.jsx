import { useEffect, useRef, useState } from "react";
import { Check, DoorOpen, Focus, ListChecks, PackagePlus, RotateCcw, ScanLine, ShieldCheck, Video } from "lucide-react";
import { scanRoom } from "../api.js";
import { mmss } from "../format.js";
import { releaseFrames } from "../frames.js";
import { isPrecise, useHomeLocation } from "../location.js";
import { Camera } from "./Camera.jsx";
import { FieldError } from "./Field.jsx";
import { LocationPermissionSheet, LocationStatus } from "./Location.jsx";
import { ErrorState } from "./States.jsx";

const STEP_OF = { uploading: 1, analyzing: 2 }; // step 0 (picking shots) happens while recording
const PHOTO_CYCLE_MS = 1200; // how long each photo shows in the big frame while scanning

// Wording for a full room scan and for adding new things to a scanned room.
const COPY = {
  scan: {
    guideTitle: "How to film a room",
    guideTime: "20–60 sec",
    guide: [
      [DoorOpen, "Stand in the doorway and turn on good light."],
      [RotateCcw, "Walk slowly around the room."],
      [ScanLine, "Pause on valuable things: TVs, laptops, jewelry, bikes."],
    ],
    heading: "Finding your things…",
    steps: ["Picking the best shots", "Sending photos", "Identifying your things"],
    wait: "Gemini is naming each item and estimating what it would cost to replace. Usually 10–20 seconds.",
  },
  add: {
    guideTitle: "How to add new things",
    guideTime: "10–30 sec",
    guide: [
      [PackagePlus, "Film only what's new since your last scan."],
      [Focus, "Get close and hold each item in view for a second."],
      [ListChecks, "Things already on your list are skipped, and your edits and serial numbers stay."],
    ],
    heading: "Finding new things…",
    steps: ["Picking the best shots", "Sending photos", "Checking what's new"],
    wait: "Gemini is comparing these photos with your list and pricing anything new. Usually 10–20 seconds.",
  },
};

// Record → photos → send → Gemini identifies items. Recording only unlocks at
// the home, and stops if the user leaves; the location fixes go with the photos.
//   mode:      "scan" replaces the room's items, "add" adds new things to them
//   home:      the home being recorded (name, location, radiusM)
//   roomName:  shown above the scanning screen
//   intro:     content shown above the guide (e.g. the room name field)
//   validate:  return false to stop before recording (e.g. name missing)
//   getRoomId: returns the room to scan (creates it on the first call for a new room)
//   onDone:    receives the updated room, and in "add" mode the ids of the new items
//   onScanningChange: told when the scanning screen starts/stops (to hide the page title)
export function ScanFlow({ mode = "scan", home, homeId, roomName, intro, validate = () => true, getRoomId, onDone, onScanningChange }) {
  const copy = COPY[mode];
  const [stage, setStage] = useState("choose"); // choose | camera | uploading | analyzing | error
  const [frames, setFrames] = useState([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [chooseError, setChooseError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [shown, setShown] = useState(0); // photo showing in the big frame
  const framesRef = useRef([]);
  const [askPermission, setAskPermission] = useState(false);
  const [abortReason, setAbortReason] = useState("");
  const recordingRef = useRef(false);
  const fixesRef = useRef([]); // location fixes taken while recording

  // Watch the location while choosing and recording.
  const loc = useHomeLocation(home, {
    enabled: stage === "choose" || stage === "camera",
    onFix: (fix, inside) => {
      if (!recordingRef.current) return;
      fixesRef.current.push(fix);
      if (isPrecise(fix) && !inside) {
        setAbortReason(`Recording stopped: you left ${home.name}. Recordings only count when you're at home.`);
      }
    },
  });

  // Location blocked: explain why it's needed. While recording, that also stops it.
  useEffect(() => {
    if (loc.status !== "denied") return;
    setAskPermission(true);
    if (recordingRef.current) setAbortReason("Recording stopped because location was turned off.");
  }, [loc.status]);

  framesRef.current = frames;
  useEffect(() => () => releaseFrames(framesRef.current), []);

  const scanning = stage in STEP_OF;
  useEffect(() => {
    onScanningChange?.(scanning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  // Seconds counter while Gemini works.
  useEffect(() => {
    if (stage !== "analyzing") return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  // While sending and identifying, step through the photos one by one.
  useEffect(() => {
    if (stage !== "uploading" && stage !== "analyzing") return;
    const id = setInterval(() => setShown((i) => (i + 1) % Math.max(1, framesRef.current.length)), PHOTO_CYCLE_MS);
    return () => clearInterval(id);
  }, [stage]);

  function resetFrames(next = []) {
    releaseFrames(framesRef.current.filter((f) => !next.includes(f)));
    setFrames(next);
  }

  async function send(photos) {
    setError("");
    setProgress(0);
    setShown(0);
    setStage("uploading");
    try {
      const roomId = await getRoomId();
      const { room, addedIds } = await scanRoom(homeId, roomId, photos, {
        mode,
        location: fixesRef.current,
        onProgress: setProgress,
        onUploaded: () => setStage("analyzing"),
      });
      onDone(room, addedIds);
    } catch (err) {
      setError(err.message);
      setStage("error");
    }
  }

  function record() {
    setChooseError("");
    if (!validate()) return;
    if (loc.status === "denied") return setAskPermission(true);
    if (!loc.canRecord) return;
    setAbortReason("");
    setStage("camera");
  }

  function onRecordingChange(on) {
    recordingRef.current = on;
    // Start with the latest fix, so even a very short recording has one.
    if (on) fixesRef.current = loc.fix ? [loc.fix] : [];
  }

  if (stage === "choose" || stage === "camera") {
    return (
      <>
        {intro}
        <section className="how-to card" aria-label={copy.guideTitle}>
          <div className="how-head">
            <h3>{copy.guideTitle}</h3>
            <span className="eyebrow">{copy.guideTime}</span>
          </div>
          {copy.guide.map(([Icon, text], i) => (
            <div className="how-step" key={text}>
              <span className={`tile sm ${i === copy.guide.length - 1 ? "amber" : ""}`}><Icon size={18} /></span>
              <span>{text}</span>
            </div>
          ))}
        </section>
        <p className="trust-line">
          <ShieldCheck size={18} aria-hidden="true" />
          Up to 2 minutes per room. Your video is never uploaded, only a few photos.
        </p>
        <LocationStatus loc={loc} home={home} onAllow={() => setAskPermission(true)} />
        {chooseError && <FieldError>{chooseError}</FieldError>}

        <div className="bottom-bar">
          <button className="btn primary grow" onClick={record} disabled={!loc.canRecord && loc.status !== "denied"}>
            <Video size={20} /> Record
          </button>
        </div>

        {stage === "camera" && (
          <Camera
            canStart={loc.canRecord}
            waitingHint={`Go back to ${home.name} to record.`}
            placeNote={loc.status === "inside" ? `At ${home.name} · location verified` : null}
            abortReason={abortReason}
            onRecordingChange={onRecordingChange}
            onCancel={() => setStage("choose")}
            onError={(message) => {
              recordingRef.current = false;
              setStage("choose");
              setChooseError(message);
            }}
            onDone={(photos) => {
              resetFrames(photos);
              send(photos);
            }}
          />
        )}
        {askPermission && <LocationPermissionSheet onClose={() => setAskPermission(false)} onRetry={loc.retry} />}
      </>
    );
  }

  if (stage === "error") {
    return (
      <>
        <ErrorState title="That scan didn't work" message={error} onRetry={frames.length ? () => send(frames) : null} />
        <div className="bottom-bar">
          <button className="btn secondary grow" onClick={() => (resetFrames(), setStage("choose"))}>
            Record again
          </button>
        </div>
      </>
    );
  }

  // Scanning screen.
  const current = STEP_OF[stage];
  const photo = frames[Math.min(shown, frames.length - 1)];
  const photoIndex = frames.indexOf(photo);
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <section className="scanning" aria-live="polite">
      <div className="page-head">
        <span className="eyebrow">
          {roomName ? `${roomName} · ` : ""}
          {frames.length} photos
        </span>
        <h1>{copy.heading}</h1>
      </div>

      <div className="scan-stage">
        {photo && <img key={photo.url} src={photo.url} alt="" />}
        <span className="scan-line" aria-hidden="true" />
        {photo && <span className="tag scan-ts">{mmss(photo.time)}</span>}
        {photo && (
          <span className="scan-count">
            {photoIndex + 1} / {frames.length}
          </span>
        )}
      </div>

      {/* Photos already looked at get a check; the current one has a ring. */}
      <div className="scan-strip" aria-hidden="true">
        {frames.map((f, i) => {
          const state = i < photoIndex ? "done" : i === photoIndex ? "current" : "todo";
          return (
            <span key={f.url} className={state}>
              <img src={f.url} alt="" />
            </span>
          );
        })}
      </div>

      <ol className="steps-card card" style={{ margin: 0, listStyle: "none" }}>
        {copy.steps.map((label, i) => (
          <li key={label} className={`step-line ${i === current ? "active" : ""}`}>
            <span className={`step-dot ${i < current ? "done" : i === current ? "spinning" : ""}`}>
              {i < current ? <Check size={15} strokeWidth={3} /> : i > current ? i + 1 : null}
            </span>
            <span className="label">{label}</span>
            <span className="num">
              {i < current ? "done" : i === current ? (stage === "analyzing" ? clock(seconds) : `${Math.round(progress * 100)}%`) : ""}
            </span>
          </li>
        ))}
      </ol>
      <p className="muted small">{copy.wait}</p>
    </section>
  );
}
