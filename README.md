# SAROP Workspace prototype

A thin, clickable shell that stitches the nine standalone SAROP Workspace screens
into one prototype for an iPad demo. It is a desirability prototype, not the
product build: no backend, no data model, no framework, just static HTML, CSS and
JS.

## What it is

- `index.html` is the shell: a persistent left navigation listing the nine
  modules, Previous / Next paging, and one global Land / Marine domain toggle.
  On phone widths (<=760px) the sidebar collapses to a slide-in drawer opened by
  a left-edge handle, so the module fills the screen.
- Mobile-first: the shell and every module respond down to phone width (a phone
  breakpoint at 560px stacks each screen to a single column with a wrapping app
  bar and larger targets; the COP stacks its map above the rail; Field Capture
  fills the screen). Desktop and iPad layouts are unchanged above the breakpoint.
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

Modules (incident-workflow order): M1 Stand-up, M2 Notifications & Callout,
M3 Resources & Staging, M4 Tasking, M5 The COP, M6 Field Capture, M7 Log &
Records, M8 Forms Engine, M9 Close-out.

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

## The map component

`vendor/sarop-map.js` is the single map component, reused by both the COP (M5)
and Field Capture (M6). It wraps MapLibre GL with the incident's area-of-operation
geodata, the Esri satellite + Terrarium terrain base, and an always-present
offline-safe background so the map is never blank. `setOnline(false)` drops the
satellite/terrain and leaves the vector picture fully usable with no tile fetch,
which is how M6 stays usable offline. Note: this static prototype does not bundle
real tiles for true offline imagery (that needs a connected build step or a
service worker); offline degrades gracefully to the styled base with all vector
data still rendering.

## Screens

Every screen now carries an additive phone breakpoint (a `@media (max-width:560px)`
block appended to its own `<style>`) for the mobile-first pass; nothing above the
breakpoint changed, so the desktop / iPad layouts are as originally found. Beyond
that responsive addition, three screens were changed on request:

- `M6 Field Capture Screen.html` gained an operator map. A Capture / Map tab pair
  keeps capture-first; the Map tab reuses the COP map component scoped to the
  operator's own picture: the assigned task geometry (Sector B, TASK-014), the own
  track, and the on-device captures, with each marker carrying its sync state
  (Captured / Queued / Synced) exactly as the list chips do. Tapping the map (or
  "Capture here") opens the same capture flow pre-filled with the coordinate, so
  entries land in the same on-device queue. The map is fully usable with Signal =
  Offline, and respects the Day / Night theme.
- `M5 The COP Screen.html` now shows real satellite imagery with a 2D / 3D tilt.
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
- `M8 Forms Engine Screen.html` was replaced with the complete Forms Engine: the
  full form set (subject and intelligence, search urgency, planning, field and
  casualty, outward and debrief), a generic field renderer, the scored urgency
  land / marine config pair, and the debrief variants. It keeps the standard
  Land / Marine toggle, so the shell drives its domain as before.
