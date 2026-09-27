import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Phones only open the camera on https. Run `npm run dev:phone` to serve the
// dev site over https on your Wi-Fi, then open the "Network" URL on the phone.
const phone = process.env.HTTPS === "1";

export default defineConfig({
  plugins: [react(), ...(phone ? [basicSsl()] : [])],
  // The map library (~285 kB gzipped) is its own chunk, loaded only when a map is shown.
  build: { chunkSizeWarningLimit: 1200 },
  worker: { format: "es" }, // the map's web worker is an ES module
  server: {
    host: true,
    // Lets a Cloudflare quick tunnel (https://….trycloudflare.com) reach the dev server.
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
