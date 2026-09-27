import { useEffect, useRef, useState } from "react";
import { formatDistance } from "../location.js";
import { useTheme } from "../theme.js";

// A modern vector map of the home: the pin, and the circle where recording
// works. MapLibre draws OpenFreeMap tiles (free, no key), recoloured to match
// the app in light and dark mode. The library loads only when a map is shown.

const STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// Map colours per theme, matching the app's palette.
const PALETTE = {
  light: { background: "#f2f6f8", water: "#c9e0e9", park: "#dfece4", building: "#e2e8ec", residential: "#eef2f4" },
  dark: { background: "#0e161c", water: "#0d2835", park: "#12211d", building: "#1a252d", residential: "#111b21" },
};

const HOUSE_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

// A circle of `meters` around a point, as a GeoJSON polygon.
function circle(lng, lat, meters, steps = 72) {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [ring] }, properties: {} };
}

function recolour(map, theme) {
  const c = PALETTE[theme];
  for (const layer of map.getStyle().layers) {
    const set = (prop, value) => map.setPaintProperty(layer.id, prop, value);
    // At street level, city and country names only clutter the spot around the pin.
    if (layer.type === "symbol" && /^(place|label)_(city|town|state|country)/.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
      continue;
    }
    if (layer.type === "background") set("background-color", c.background);
    else if (layer.type !== "fill") continue;
    else if (layer.id === "water") set("fill-color", c.water);
    else if (layer.id.includes("park") || layer.id === "landcover_wood") set("fill-color", c.park);
    else if (layer.id === "building") set("fill-color", c.building);
    else if (layer.id === "landuse_residential") set("fill-color", c.residential);
  }
}

export function HomeMap({ lat, lng, radiusM = 150 }) {
  const box = useRef(null);
  const theme = useTheme();
  const [state, setState] = useState("loading"); // loading | ready | failed

  useEffect(() => {
    let map;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const [lib, worker] = await Promise.all([
          import("maplibre-gl"),
          // MapLibre builds tiles in a web worker; Vite bundles it into one file and gives its URL.
          import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
          import("maplibre-gl/dist/maplibre-gl.css"),
        ]);
        const maplibregl = lib.default ?? lib; // v6 has named exports only
        maplibregl.setWorkerUrl(worker.default);
        if (cancelled || !box.current) return;
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0e6a87";
        const zone = circle(lng, lat, radiusM);
        const ring = zone.geometry.coordinates[0];
        const lngs = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);

        map = new maplibregl.Map({
          container: box.current,
          style: STYLES[theme],
          bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          fitBoundsOptions: { padding: { top: 28, bottom: 44, left: 28, right: 28 } },
          interactive: false, // a picture of the spot; the sheet scrolls normally over it
          attributionControl: { compact: true },
          fadeDuration: 0,
        });
        // Tiles that never arrive (offline, blocked): show the fallback instead of a blank box.
        const giveUp = setTimeout(() => !cancelled && setState((s) => (s === "loading" ? "failed" : s)), 12_000);
        map.once("load", () => clearTimeout(giveUp));
        map.on("load", () => {
          if (cancelled) return;
          recolour(map, theme);
          map.addSource("zone", { type: "geojson", data: zone });
          map.addLayer({ id: "zone-fill", type: "fill", source: "zone", paint: { "fill-color": accent, "fill-opacity": theme === "dark" ? 0.16 : 0.12 } });
          map.addLayer({
            id: "zone-line",
            type: "line",
            source: "zone",
            paint: { "line-color": accent, "line-width": 2, "line-dasharray": [2, 1.5], "line-opacity": 0.9 },
          });
          const pin = document.createElement("div");
          pin.className = "map-pin";
          pin.innerHTML = `<span class="map-pin-pulse"></span><span class="map-pin-head">${HOUSE_ICON}</span><span class="map-pin-tip"></span>`;
          new maplibregl.Marker({ element: pin, anchor: "bottom" }).setLngLat([lng, lat]).addTo(map);
          // Keep the map credit folded behind its ⓘ button so it doesn't cover the zone label.
          const credit = box.current?.querySelector(".maplibregl-ctrl-attrib");
          credit?.classList.remove("maplibregl-compact-show");
          credit?.removeAttribute("open");
          setState("ready");
        });
      } catch (err) {
        console.warn("Map unavailable:", err?.message || err);
        if (!cancelled) setState("failed"); // no WebGL, or the library didn't load
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng, radiusM, theme]);

  return (
    <div className={`home-map ${state}`}>
      <div ref={box} className="home-map-canvas" aria-label="Map of your home and the area where recording works" role="img" />
      {state === "loading" && <div className="home-map-skeleton" aria-hidden="true" />}
      {state === "failed" && (
        <div className="home-map-fallback">
          <span className="map-pin static"><span className="map-pin-head" dangerouslySetInnerHTML={{ __html: HOUSE_ICON }} /><span className="map-pin-tip" /></span>
          <span className="num">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </div>
      )}
      <span className="home-map-chip">
        <span className="zone-dot" aria-hidden="true" /> Recording zone · {formatDistance(radiusM)}
      </span>
    </div>
  );
}
