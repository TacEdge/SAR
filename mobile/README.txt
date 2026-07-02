SAROP Workspace — mobile-locked module views
=============================================

Open any file in this folder (M1.html ... M9.html) in a browser. Each one shows
that module rendered at a true 390 px phone viewport, inside a phone frame,
REGARDLESS of your window size. The module runs inside a 390 px iframe (the frame
is 416 px wide with 13 px padding on each side), so its mobile layout (single
column, bottom app bar, stacked map, etc.) is always active. Resize the window
freely and the phone layout does not change.

- M1.html  Stand-up
- M2.html  The COP            (map + operational overlays; offline-safe)
- M3.html  Tasking
- M4.html  Field Capture      (the field phone surface)
- M5.html  Log & Records
- M6.html  Forms Engine
- M7.html  Notifications & Callout
- M8.html  Resources & Staging
- M9.html  Close-out

Notes
-----
- Keep this folder structure intact: each Mx.html loads the matching module file
  in the parent folder, which in turn uses /vendor and /assets.
- The map modules (M2, M4) show live satellite imagery when online; with no
  connection they fall back to the offline cartographic basemap automatically.
- Fonts (IBM Plex) load from Google Fonts when online; offline they fall back
  to the system UI font.
- These are review copies of the mobile rendering. The live prototype uses one
  responsive file per module (the same files in the parent folder).
