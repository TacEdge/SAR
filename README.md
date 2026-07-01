# SAROP Workspace prototype

A thin, clickable shell that stitches the nine standalone SAROP Workspace screens
into one walkthrough for an iPad demo. It is a desirability prototype for a single
conversation, not the product build: no backend, no data model, no framework, just
static HTML, CSS and JS.

## What it is

- `index.html` is the shell: a persistent left navigation listing the nine screens
  in flow order, a top bar with the TacEdge SAR / SAROP Workspace identity, a
  Previous / Next guided path, and one global Land / Marine domain toggle.
- Each screen loads unchanged inside a central iframe, keeping its own styles and
  scripts fully isolated.
- The domain toggle drives the active screen through the screen's own means: it
  sets `data-domain` on the screen (which every screen's CSS keys off) and, where
  the screen has a built-in Land / Marine control, also clicks that control so its
  in-screen toggle stays in sync.

Flow order: M1 Stand-up, M2 The COP, M3 Tasking, M4 Field Capture, M5 Log &
Records, M6 Forms Engine, M7 Notifications & Callout, M8 Resources & Staging,
M9 Close-out.

## Run it locally

From the repository root, serve the folder with any static server, for example:

```
python3 -m http.server 8000
```

Then open <http://localhost:8000/> and click "Begin walkthrough". A same-origin
server is needed (rather than opening `index.html` from the file system) so the
shell can reach into each iframe to apply the domain.

## Deploy it

It is a folder of static files, so any static host works:

- Netlify: drag the repository folder onto the Netlify drop zone.
- GitHub Pages: enable Pages for the branch and serve from the root.

No build step, no dependencies.

## Screens

Eight of the nine `M*.html` screen files are loaded byte-for-byte as found. The
shell files (`index.html`, `shell.css`, `shell.js`) and this README were added.

One screen was changed on request: `M2 The COP Screen.html` now shows real
satellite imagery. Its abstract base map was replaced with a Leaflet map over
Esri World Imagery (an open basemap, no API key), and the operational overlays
(operational area, search sectors, search paths, completed track, and the unit
and clue pins) are anchored to real coordinates near Luxmore Hut so they pan and
zoom with the map. The existing behaviour (task to sector to resource
cross-highlighting, layer toggles, domain switch) is preserved. Leaflet is
vendored under `vendor/leaflet/`, so the page needs no CDN; only the satellite
tiles require an internet connection.
