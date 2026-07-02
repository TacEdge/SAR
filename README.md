# SAROP Workspace prototype

A thin, clickable shell that stitches the nine standalone SAROP Workspace screens
into one prototype for an iPad demo. It is a desirability prototype, not the
product build: no backend, no data model, no framework, just static HTML, CSS and
JS.

## What it is

- `index.html` is the shell: a persistent left navigation listing the nine
  modules, a top bar with the TacEdge SAR / SAROP Workspace identity, Previous /
  Next paging, and one global Land / Marine domain toggle.
- Each screen loads unchanged inside a central iframe, keeping its own styles and
  scripts fully isolated.
- The domain toggle drives the active screen through the screen's own means: it
  sets `data-domain` on the screen (which every screen's CSS keys off) and, where
  the screen has a built-in Land / Marine control, also clicks that control so its
  in-screen toggle stays in sync.
- Cross-module hand-offs are connected: a module's primary action moves you to the
  module it leads to (stand-up "Go active" to the COP, tasking "Push to field" to
  Field Capture, "Send callout" to Resources & Staging, "Reconcile for close-out"
  to Close-out). Each screen's own behaviour runs first; the shell only adds the
  onward navigation, so no screen file is changed. Deep behaviours that need real
  architecture (persistence, sync, report emit) are intentionally left as-is.

Modules: M1 Stand-up, M2 The COP, M3 Tasking, M4 Field Capture, M5 Log &
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

## Design system

`design-system.html` is the canonical token source for the whole product: the
brand palette, semantic signal colours, typography, spacing, radii, and the
component and surface specifications. The shell and every screen use these exact
tokens (no drift). It is deployed alongside the prototype (open
`design-system.html`) but is intentionally not a screen in the walkthrough nav.

## Screens

Seven of the nine `M*.html` screen files are loaded byte-for-byte as originally
found. The shell files (`index.html`, `shell.css`, `shell.js`), the design system
and this README were added. Two screens were changed on request:

- `M2 The COP Screen.html` now shows real satellite imagery with a 2D / 3D tilt.
  Its abstract base map was replaced with a MapLibre GL map over Esri World
  Imagery (an open basemap, no API key), draped over real terrain from the free
  AWS Terrarium elevation tiles, so the coordinator can tilt the picture into 3D
  (a 2D / 3D toggle sits on the map; drag with the right mouse button or two
  fingers to rotate and pitch). The operational overlays (operational area,
  search sectors, search paths, completed track, and the unit and clue pins) are
  anchored to real coordinates near Luxmore Hut and drape over the terrain. The
  existing behaviour (task to sector to resource cross-highlighting, layer
  toggles, domain switch) is preserved. MapLibre GL is vendored under
  `vendor/maplibre/`, so the page needs no CDN; only the satellite and elevation
  tiles require an internet connection.
- `M6 Forms Engine Screen.html` was replaced with the complete Forms Engine: the
  full form set (subject and intelligence, search urgency, planning, field and
  casualty, outward and debrief), a generic field renderer, the scored urgency
  land / marine config pair, and the debrief variants. It keeps the standard
  Land / Marine toggle, so the shell drives its domain as before.
