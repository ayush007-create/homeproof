import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Images, MapPinCheck, X } from "lucide-react";
import {
  MAX_PHOTOS,
  MAX_RECORD_SECONDS,
  PHOTO_EVERY_SECONDS,
  pickEvenly,
  releaseFrames,
  snapshot,
} from "../frames.js";
import { unlockAudio } from "../voice.js";

function cameraError(err) {
  if (!window.isSecureContext) {
    return "The camera only works on https. Open the deployed site, or run the dev server with npm run dev:phone.";
  }
  if (err?.name === "NotAllowedError") {
    return "Camera access was blocked. Allow the camera in your browser settings, then try again.";
  }
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
    return "No camera found on this device. Open HomeProof on your phone to record.";
  }
  return "Couldn't open the camera. Close other apps using it, then try again.";
}

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Full-screen camera. While "recording" it takes a photo of the live camera
// every 2 seconds; no video file is ever made. onDone gets the photos.
//   canStart:    false while the user isn't at the home (the shutter stays off)
//   waitingHint: shown instead of the usual hint while canStart is false
//   placeNote:   shown while recording (e.g. "At Miami Apartment")
//   abortReason: set it to stop recording and throw the photos away (e.g. the user left home)
//   onRecordingChange: told when recording starts and stops
export function Camera({ onDone, onCancel, onError, canStart = true, waitingHint, placeNote, abortReason, onRecordingChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const framesRef = useRef([]);
  const pendingRef = useRef(new Set());
  const timersRef = useRef([]);
  const startedAtRef = useRef(0);
  const deliveredRef = useRef(false);
  const stoppingRef = useRef(false);
  const [status, setStatus] = useState("starting"); // starting | ready | recording | finishing
  const [elapsed, setElapsed] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        setStatus("ready");
      })
      .catch((err) => !cancelled && onError(cameraError(err)));
    if (!navigator.mediaDevices) onError(cameraError());

    document.body.classList.add("no-scroll");
    return () => {
      cancelled = true;
      timersRef.current.forEach(clearInterval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      document.body.classList.remove("no-scroll");
      if (!deliveredRef.current) releaseFrames(framesRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const time = (performance.now() - startedAtRef.current) / 1000;
    const job = snapshot(video, time)
      .then((frame) => {
        framesRef.current.push(frame);
        setPhotoCount(framesRef.current.length);
        setFlash((n) => n + 1);
      })
      .catch(() => {})
      .finally(() => pendingRef.current.delete(job));
    pendingRef.current.add(job);
  }

  // Stops without keeping anything (the user left home, location went off…).
  useEffect(() => {
    if (!abortReason || stoppingRef.current || status !== "recording") return;
    stoppingRef.current = true;
    timersRef.current.forEach(clearInterval);
    timersRef.current = [];
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onRecordingChange?.(false);
    onError(abortReason); // closes the camera; unmounting releases the photos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abortReason, status]);

  function start() {
    if (!canStart) return;
    onRecordingChange?.(true);
    framesRef.current = [];
    startedAtRef.current = performance.now();
    setElapsed(0);
    setStatus("recording");
    takePhoto();
    timersRef.current = [
      setInterval(takePhoto, PHOTO_EVERY_SECONDS * 1000),
      setInterval(() => {
        const s = (performance.now() - startedAtRef.current) / 1000;
        setElapsed(s);
        if (s >= MAX_RECORD_SECONDS) stop();
      }, 250),
    ];
  }

  async function stop() {
    if (stoppingRef.current) return; // tap and auto-stop at 2:00 can happen together
    stoppingRef.current = true;
    unlockAudio(); // this tap lets the voice summary play later
    timersRef.current.forEach(clearInterval);
    timersRef.current = [];
    setStatus("finishing");
    const last = framesRef.current.at(-1);
    const now = (performance.now() - startedAtRef.current) / 1000;
    if (!last || now - last.time > 1) takePhoto(); // one last photo at the end
    await Promise.all([...pendingRef.current]);

    onRecordingChange?.(false);
    const all = [...framesRef.current].sort((a, b) => a.time - b.time);
    if (!all.length) {
      // Stopped before the camera gave a single picture.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      return onError("That was too quick to take a photo. Record for a few seconds.");
    }
    const kept = pickEvenly(all, MAX_PHOTOS);
    releaseFrames(all.filter((f) => !kept.includes(f)));
    deliveredRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onDone(kept);
  }

  const recording = status === "recording";
  const left = MAX_RECORD_SECONDS - elapsed;

  return createPortal(
    <div className="camera" role="dialog" aria-label="Camera">
      <video ref={videoRef} autoPlay playsInline muted />
      {flash > 0 && <span key={flash} className="shot-flash" aria-hidden="true" />}

      <div className="camera-top">
        {recording ? (
          <span className="icon-btn light placeholder" aria-hidden="true" />
        ) : (
          <button className="icon-btn light" onClick={onCancel} aria-label="Close camera">
            <X size={24} />
          </button>
        )}
        <div className={`cam-pill ${recording ? "on" : ""}`}>
          <span className="dot" />
          <span>{clock(elapsed)}</span>
          <span className="limit">/ {clock(MAX_RECORD_SECONDS)}</span>
        </div>
        <span className="cam-pill" aria-live="polite" aria-label={`${photoCount} photos taken`}>
          <Images size={16} /> {photoCount}
        </span>
      </div>
      <div className="rec-progress" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (elapsed / MAX_RECORD_SECONDS) * 100)}%` }} />
      </div>
      {/* Framing corners: a hint to pause on one thing at a time. */}
      <div className="frame-corners" aria-hidden="true">
        <span /><span /><span /><span />
      </div>

      <div className="camera-bottom">
        <p className="camera-hint" aria-live="polite">
          {status === "starting" && "Opening camera…"}
          {status === "ready" && (canStart ? "Walk slowly around the room. Point at everything you own." : waitingHint)}
          {recording && (left <= 15 ? `${Math.ceil(left)} seconds left` : "Tap stop whenever you're done")}
          {status === "finishing" && "Saving photos…"}
        </p>
        {recording && placeNote && (
          <p className="camera-place"><MapPinCheck size={15} aria-hidden="true" /> {placeNote}</p>
        )}
        <button
          className={`shutter ${recording || status === "finishing" ? "recording" : ""}`}
          onClick={recording ? stop : start}
          disabled={status === "starting" || status === "finishing" || (status === "ready" && !canStart)}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          <span />
        </button>
      </div>
    </div>,
    document.body
  );
}
