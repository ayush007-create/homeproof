import { useEffect, useRef, useState } from "react";

// The part of the photo (with the frame's aspect ratio) centred on the item, with some margin.
// box = [ymin, xmin, ymax, xmax] on a 0–1000 scale (from Gemini). Returns pixels.
export function regionAround(box, imgW, imgH, aspect, padding = 1.25) {
  const [y1, x1, y2, x2] = box.map((n) => n / 1000);
  let width = Math.max((x2 - x1) * imgW, (y2 - y1) * imgH * aspect, Math.min(imgW, imgH * aspect) * 0.3) * padding;
  width = Math.min(width, imgW, imgH * aspect); // can't be bigger than the photo
  const height = width / aspect;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);
  return {
    x: clamp(((x1 + x2) / 2) * imgW - width / 2, imgW - width),
    y: clamp(((y1 + y2) / 2) * imgH - height / 2, imgH - height),
    width,
    height,
  };
}

// Item photo zoomed in on the item, filling its parent (which must clip).
// Works for any frame shape: square thumbnails, the wide hero photo, the PDF preview.
// Without a box it shows the whole photo, centre-cropped.
export function ItemPhoto({ src, box, alt = "" }) {
  const ref = useRef(null);
  const [natural, setNatural] = useState(null);
  const [frame, setFrame] = useState(null);

  // Watch the parent's size so the crop stays right when the layout changes.
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent || !box) return;
    const observer = new ResizeObserver(([entry]) => setFrame({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(parent);
    return () => observer.disconnect();
  }, [box]);

  let style;
  if (box && natural && frame?.w && frame?.h) {
    const r = regionAround(box, natural.w, natural.h, frame.w / frame.h);
    style = {
      width: `${(natural.w / r.width) * 100}%`,
      left: `${(-r.x / r.width) * 100}%`,
      top: `${(-r.y / r.height) * 100}%`,
    };
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      className={style ? "cropped" : ""}
      style={style}
      onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
    />
  );
}
