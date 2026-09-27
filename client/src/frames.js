// Turns a room walk-through into photos on the phone, so only photos are sent
// (never a video). Change these numbers to tune scanning.
export const PHOTO_EVERY_SECONDS = 2;
export const MAX_PHOTOS = 30;
export const MAX_RECORD_SECONDS = 120;
const MAX_SIDE = 1024; // px, longest side
const JPEG_QUALITY = 0.72;

// Draws the live camera to a canvas and returns a JPEG photo.
export function snapshot(video, time) {
  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, time, url: URL.createObjectURL(blob) }) : reject(new Error("Could not take photo"))),
      "image/jpeg",
      JPEG_QUALITY
    )
  );
}

// Keeps `count` evenly spaced entries (always including the first and last).
export function pickEvenly(list, count) {
  if (list.length <= count) return list;
  return Array.from({ length: count }, (_, i) => list[Math.round((i * (list.length - 1)) / (count - 1))]);
}

export function releaseFrames(frames) {
  frames.forEach((f) => f?.url && URL.revokeObjectURL(f.url));
}
