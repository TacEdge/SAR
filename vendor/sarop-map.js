/* ============================================================
   SAROP shared map component (reused by M2 The COP and M4 Field
   Capture). Wraps MapLibre GL with the incident's area-of-operation
   geodata, the satellite + terrain base, and an offline-safe base so
   the same component serves the desktop COP and the offline field cut.

   Base layers:
   - 'base'    : an always-present background fill (offline-safe). The map
                 is never blank; vector overlays always render over it.
   - 'basemap' : the online raster basemap, added only when online. With a
                 LINZ API key set below this is a LINZ Basemaps layer
                 (topo-raster or aerial, Web Mercator); without a key it
                 falls back to Esri World Imagery as before.
   - terrain   : AWS Terrarium DEM, applied only when online AND opts.terrain.

   Markup: SaropMap.attachMarkup(ctrl, opts) wires the TacEdge drawing/
   editing tooling (vendor/tacedge-markup.js) onto a created map. Modules
   only ever talk to the returned handle — never to the engine directly.

   Consumers add their own overlays in opts.onReady(map, ctrl); the
   component keeps 'sat' beneath those overlays and toggles it with
   ctrl.setOnline(bool). No connectivity is assumed: setOnline(false)
   leaves the vector picture fully usable with no tile fetch.
   ============================================================ */
window.SaropMap = (function(){
  'use strict';

  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var DEM  = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

  /* ============================================================
     LINZ Basemaps configuration (extracted from the TacEdge
     Coordination platform's basemap resolver).

     >>> SET THE API KEY HERE — this is the single place it lives. <<<
     Get a free key at https://basemaps.linz.govt.nz (menu → API keys).
     The nine module files never see the key; they only call the
     SaropMap adapter. While the placeholder below is unchanged the
     map falls back to the previous Esri World Imagery basemap.

     Projection: Web Mercator (EPSG:3857) — same scheme the
     Coordination platform uses. NZTM2000Quad tiles exist for aerial
     but MapLibre GL renders Web Mercator, so 3857 is used throughout.
     ============================================================ */
  var LINZ_API_KEY = 'c01kwjjnt5w5dxd7hdj0pd1kg8q';

  var LINZ_TILES = {
    // 'Topo Gridless Maps' — the combined Topo50/Topo250 raster tileset.
    'linz-topo':   { url: 'https://basemaps.linz.govt.nz/v1/tiles/topo-raster/EPSG:3857/{z}/{x}/{y}.webp?api=', maxzoom: 15 },
    'linz-aerial': { url: 'https://basemaps.linz.govt.nz/v1/tiles/aerial/EPSG:3857/{z}/{x}/{y}.webp?api=',      maxzoom: 20 }
  };
  var LINZ_ATTRIB = 'Basemap © Toitū Te Whenua Land Information New Zealand (CC BY 4.0)';
  function hasLinzKey(){
    return !!LINZ_API_KEY && LINZ_API_KEY.indexOf('PUT-YOUR') !== 0;
  }

  /* ---- area of operation geodata (lng/lat), near Luxmore Hut / Kepler Track ---- */
  var geo = {
    CENTER:[167.6235,-45.3888], LKP:[167.6178,-45.3805],
    CLUE:[167.6098,-45.3852], R2:[167.6135,-45.3838], R4:[167.6402,-45.3968],
    AREA:{type:'Feature',geometry:{type:'Polygon',coordinates:[[[167.598,-45.372],[167.652,-45.372],[167.658,-45.408],[167.600,-45.410],[167.598,-45.372]]]}},
    SECTORS:{type:'FeatureCollection',features:[
      {type:'Feature',properties:{sector:'A'},geometry:{type:'Polygon',coordinates:[[[167.602,-45.374],[167.628,-45.374],[167.626,-45.390],[167.604,-45.390],[167.602,-45.374]]]}},
      {type:'Feature',properties:{sector:'B'},geometry:{type:'Polygon',coordinates:[[[167.630,-45.391],[167.652,-45.391],[167.652,-45.404],[167.630,-45.404],[167.630,-45.391]]]}}
    ]},
    PATHS:{type:'Feature',geometry:{type:'LineString',coordinates:[[167.607,-45.377],[167.624,-45.378],[167.609,-45.381],[167.623,-45.383],[167.611,-45.386],[167.622,-45.388]]}},
    TRACK:{type:'Feature',geometry:{type:'LineString',coordinates:[[167.634,-45.393],[167.642,-45.395],[167.637,-45.398],[167.646,-45.401],[167.641,-45.403]]}}
  };
  function sector(id){
    return geo.SECTORS.features.filter(function(f){ return f.properties.sector===id; })[0];
  }

  /* ---- NZTM-style readout. A local linear approximation anchored so the
     numbers sit in the same range the capture cards use (1573xxx E / 5180xxx N).
     Decorative but consistent, matching how the COP already treats NZTM as a
     display string rather than the source of truth. ---- */
  var A_LNG=167.6235, A_LAT=-45.3888, E0=1573100, N0=5180300;
  var M_LAT=111320, M_LNG=111320*Math.cos(A_LAT*Math.PI/180);
  function lngLatToNZTM(lng,lat){
    return { E: Math.round(E0 + (lng-A_LNG)*M_LNG), N: Math.round(N0 + (lat-A_LAT)*M_LAT) };
  }
  function fmtNZTM(lng,lat){ var p=lngLatToNZTM(lng,lat); return 'NZTM '+p.E+'E '+p.N+'N'; }

  /* ---- create the base map ---- */
  function create(opts){
    opts = opts || {};
    var terrain = opts.terrain !== false;

    /* Raster basemap sources. 'sat' (Esri) is always defined so the key-less
       fallback keeps working; the LINZ sources are added only when a key is
       set. The active basemap renders through the single 'basemap' layer. */
    var sources = {
      sat: { type:'raster', tiles:[ESRI], tileSize:256, maxzoom:18, attribution:'Imagery © Esri, Maxar, Earthstar Geographics' },
      dem: { type:'raster-dem', tiles:[DEM], tileSize:256, maxzoom:14, encoding:'terrarium', attribution:'Elevation: Terrarium (AWS Open Data)' }
    };
    if(hasLinzKey()){
      for(var lk in LINZ_TILES){
        sources[lk] = { type:'raster', tiles:[LINZ_TILES[lk].url + LINZ_API_KEY], tileSize:256,
                        maxzoom: LINZ_TILES[lk].maxzoom, attribution: LINZ_ATTRIB };
      }
    }

    var map = new maplibregl.Map({
      container: opts.container,
      center: opts.center || geo.CENTER,
      zoom: opts.zoom || 12.6,
      pitch: opts.pitch || 0,
      bearing: opts.bearing || 0,
      minZoom: opts.minZoom || 9,
      maxZoom: opts.maxZoom || 17,
      maxPitch: (opts.maxPitch != null ? opts.maxPitch : 80),
      interactive: opts.interactive !== false,
      attributionControl: false,
      style: {
        version: 8,
        sources: sources,
        layers: [ { id:'base', type:'background', paint:{ 'background-color': opts.baseColor || '#E7EAD9' } } ]
      }
    });

    if(opts.rotate === false){
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); } catch(e){}
    } else {
      try { if(map.touchZoomRotate) map.touchZoomRotate.enableRotation(); } catch(e){}
    }
    map.on('error', function(){ /* swallow tile / DEM errors so offline never throws */ });

    // Default basemap: LINZ topo when a key is set, else the Esri fallback.
    var requestedBasemap = opts.basemap ||
      (hasLinzKey() ? 'linz-topo' : 'satellite');

    var ctrl = { map: map, online: !!opts.online, terrain: terrain, baseBefore: null,
                 _inited: false, _satSeen: false, _satErr: 0, basemapOnline: null,
                 basemap: null };

    function basemapSourceFor(name){
      if(name === 'linz-topo' || name === 'linz-aerial'){
        return hasLinzKey() ? name : 'sat';
      }
      return 'sat';
    }
    function normalizeBasemap(name){
      if((name === 'linz-topo' || name === 'linz-aerial') && hasLinzKey()) return name;
      return 'satellite';
    }
    ctrl.basemap = normalizeBasemap(requestedBasemap);
    function basemapSource(){ return basemapSourceFor(ctrl.basemap); }

    // add / remove the online raster basemap and terrain with connectivity
    ctrl.setOnline = function(on){
      ctrl.online = !!on;
      try {
        if(on){
          if(!map.getLayer('basemap')){
            map.addLayer({ id:'basemap', type:'raster', source:basemapSource(), paint:{ 'raster-fade-duration':200 } }, ctrl.baseBefore || undefined);
          }
          if(terrain){ try { map.setTerrain({ source:'dem', exaggeration: opts.exaggeration || 1.3 }); } catch(e){} }
        } else {
          try { map.setTerrain(null); } catch(e){}
          if(map.getLayer('basemap')) map.removeLayer('basemap');
        }
      } catch(e){}
      armDetect();
    };

    /* Switch the online basemap: 'linz-topo' | 'linz-aerial' | 'satellite'.
       LINZ names silently fall back to 'satellite' when no key is set. */
    ctrl.setBasemap = function(name){
      var next = normalizeBasemap(name);
      if(next === ctrl.basemap) return;
      ctrl.basemap = next;
      ctrl._satSeen = false; ctrl._satErr = 0;   // re-detect against the new source
      try {
        if(map.getLayer('basemap')) map.removeLayer('basemap');
        if(ctrl.online){
          map.addLayer({ id:'basemap', type:'raster', source:basemapSource(), paint:{ 'raster-fade-duration':200 } }, ctrl.baseBefore || undefined);
        }
      } catch(e){}
      armDetect();
      applyAttrib();
    };
    ctrl.setBaseColor = function(c){ try { map.setPaintProperty('base','background-color', c); } catch(e){} };
    ctrl.resize = function(){ try { map.resize(); } catch(e){} };
    ctrl.setBasemapState = function(st){ setBasemapState(st); };   // force credit/offline-chip state (also driven automatically)

    /* ---- offline-safe cartographic grid, tiled over the terrain-toned 'base'.
       A screen-space background (like 'base'), so it stays put and reads as a
       deliberate offline chart rather than a blank canvas. The satellite raster
       is inserted above it, so the grid only shows when imagery is absent. ---- */
    function addGrid(){
      try {
        if(typeof document === 'undefined' || map.getLayer('grid')) return;
        var n = 64, c = document.createElement('canvas'); c.width = c.height = n;
        var g = c.getContext('2d');
        g.strokeStyle = 'rgba(90,102,72,0.22)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, n - 1, n - 1);
        g.strokeStyle = 'rgba(90,102,72,0.11)'; g.beginPath();
        g.moveTo(n / 2 + 0.5, 0); g.lineTo(n / 2 + 0.5, n);
        g.moveTo(0, n / 2 + 0.5); g.lineTo(n, n / 2 + 0.5); g.stroke();
        if(!map.hasImage('sarop-grid')) map.addImage('sarop-grid', g.getImageData(0, 0, n, n));
        map.addLayer({ id:'grid', type:'background', paint:{ 'background-pattern':'sarop-grid' } });
      } catch(e){}
    }

    /* ---- state-aware credit + offline chip. Replaces MapLibre's attribution
       control so the line only lists providers actually rendering: Esri (+ the
       Terrarium DEM when terrain is on) online, nothing offline, where a mono
       chip declares the offline basemap instead. ---- */
    function applyAttrib(){
      if(!ctrl._att) return;
      var st = ctrl.basemapOnline;
      if(st === true){
        ctrl._att.chip.style.display = 'none';
        // Credit reflects the provider actually rendering: LINZ (CC BY 4.0)
        // when a LINZ basemap is active, the Esri line on the fallback.
        var cred = (ctrl.basemap === 'satellite')
          ? 'Imagery © Esri, Maxar'
          : LINZ_ATTRIB;
        ctrl._att.cred.textContent = cred + (terrain ? ' · Elevation: Terrarium (AWS)' : '');
        ctrl._att.cred.style.display = '';
      } else if(st === false){
        ctrl._att.chip.style.display = 'inline-flex';
        ctrl._att.cred.textContent = '';
        ctrl._att.cred.style.display = 'none';
      } else { // pending: show neither until connectivity resolves
        ctrl._att.chip.style.display = 'none';
        ctrl._att.cred.textContent = '';
        ctrl._att.cred.style.display = 'none';
      }
    }
    function setBasemapState(st){ ctrl.basemapOnline = st; applyAttrib(); }
    function netOffline(){ try { return typeof navigator !== 'undefined' && navigator.onLine === false; } catch(e){ return false; } }
    function armDetect(){
      if(!ctrl.online || netOffline()){ setBasemapState(false); return; }
      if(ctrl._satSeen){ setBasemapState(true); return; }
      setBasemapState(true);                 // optimistic; flips to offline on repeated tile failure
      setTimeout(function(){ if(ctrl.online && !ctrl._satSeen && ctrl._satErr >= 2 && !netOffline()) setBasemapState(false); }, 3000);
    }
    function AttribCtrl(){}
    AttribCtrl.prototype.onAdd = function(){
      var c = document.createElement('div');
      c.className = 'maplibregl-ctrl sarop-attrib';
      c.setAttribute('style', 'display:flex; align-items:center; gap:6px; background:none; box-shadow:none; margin:0 6px 4px 0; pointer-events:none');
      var chip = document.createElement('span');
      chip.className = 'sarop-offchip';
      chip.textContent = 'Offline basemap · operational overlays live';
      chip.setAttribute('style', 'display:none; align-items:center; font-family:var(--mono,monospace); font-size:10px; letter-spacing:.02em; color:var(--cream,#FCF2E8); background:rgba(30,51,23,.92); padding:3px 9px; border-radius:999px');
      var cred = document.createElement('span');
      cred.className = 'sarop-cred';
      cred.setAttribute('style', 'font-family:var(--mono,monospace); font-size:10px; color:var(--ink-3,#7C8270); background:rgba(251,250,246,.82); padding:2px 7px; border-radius:4px');
      c.appendChild(chip); c.appendChild(cred);
      ctrl._att = { chip: chip, cred: cred };
      applyAttrib();
      this._c = c; return c;
    };
    AttribCtrl.prototype.onRemove = function(){ if(this._c && this._c.parentNode) this._c.parentNode.removeChild(this._c); };

    function ready(){
      if(ctrl._inited) return; ctrl._inited = true;
      addGrid();                                          // cartographic grid sits just above 'base'
      if(opts.controls){
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: terrain, showCompass: opts.rotate !== false }), opts.controlPos || 'top-left');
        map.addControl(new maplibregl.ScaleControl({ unit:'metric' }), 'bottom-right');
        map.addControl(new AttribCtrl(), 'bottom-right');
      }
      if(opts.onReady) opts.onReady(map, ctrl);           // consumer adds overlays over 'base' / 'grid'
      var layers = map.getStyle().layers || [];           // insert 'sat' beneath overlays but above base + grid
      for(var i=0;i<layers.length;i++){ var id=layers[i].id; if(id!=='base' && id!=='grid'){ ctrl.baseBefore = id; break; } }
      // detect real connectivity: a loaded basemap tile confirms online; repeated errors or navigator.onLine=false fall back
      map.on('data', function(e){
        if(e && e.sourceId===basemapSource() && e.tile && e.tile.state==='loaded'){ ctrl._satSeen=true; if(ctrl.online && !netOffline()) setBasemapState(true); }
      });
      map.on('error', function(e){
        if(!ctrl.online || ctrl._satSeen) return;
        // only the active basemap source decides the state; a DEM failure just drops 3D, not the picture
        var sid = e && e.sourceId;
        if(sid===basemapSource() || sid==null){ ctrl._satErr++; if(netOffline() || ctrl._satErr>=2) setBasemapState(false); }
      });
      try {
        window.addEventListener('offline', function(){ setBasemapState(false); });
        window.addEventListener('online',  function(){ ctrl._satErr=0; armDetect(); });
      } catch(e){}
      ctrl.setOnline(ctrl.online);
      if(terrain){ try { map.setSky({'sky-color':'#9fc0d6','sky-horizon-blend':0.6,'horizon-color':'#dfe6d8','horizon-fog-blend':0.6,'fog-color':'#e4e9dd','fog-ground-blend':0.4}); } catch(e){} }
      if(opts.onDone) opts.onDone(map, ctrl);
    }
    // Do not rely on 'load' alone (it waits on the first tile render, which can
    // be delayed, or offline never fires). Poll isStyleLoaded() as a fallback.
    map.on('load', ready);
    (function poll(n){ if(ctrl._inited) return; if(map.isStyleLoaded()){ ready(); return; } if(n<80) setTimeout(function(){ poll(n+1); }, 80); })(0);

    instances.ctrls.push(ctrl);   // debug/test registry (see `instances` below)
    return ctrl;
  }

  /* ============================================================
     Markup — TacEdge drawing/editing tooling behind the adapter.

     attachMarkup(ctrl, opts) wires vendor/tacedge-markup.js (the drawing
     tool classes extracted from the TacEdge Coordination platform) onto a
     SaropMap-created map. Modules speak SAROP tool names; the mapping to
     engine tools lives here:

       select → select        area   → polygon (kind:area)
       sector → polygon (kind:sector)   path → linestring (kind:path)
       point  → marker (kind:point)     text → text        erase → eraser

     opts:
       kindStyles : { kind: {strokeColor,strokeWidth,fillOpacity} } per-kind
                    drawing styles (applied when that tool is selected)
       onChange   : function(event, row) — 'create' | 'update' | 'delete'
       onToolChange : function(kind) — fired when the engine auto-returns
                    to 'select' (e.g. after a one-shot point placement)

     Returns a handle: setTool, getTool, getFeatures, setFeatures, clear,
     toGeoJSON, restyle, removeFeature, isEditing, saveEdits, cancelEdits,
     setVisible, on, dispose. Returns null (with a console warning) when
     vendor/tacedge-markup.js is not loaded — modules keep working without
     drawing support.
     ============================================================ */
  /* Debug/test registry: created ctrls and markup handles, in creation order.
     Console-inspection aid only — modules must not reach in here. */
  var instances = { ctrls: [], markups: [] };

  var MARKUP_TOOL_FOR_KIND = {
    select:'select', area:'polygon', sector:'polygon', path:'linestring',
    point:'marker', text:'text', erase:'eraser', circle:'circle'
  };

  function attachMarkup(ctrl, opts){
    opts = opts || {};
    if(typeof window.TacEdgeMarkup === 'undefined'){
      try { console.warn('[SaropMap] attachMarkup: vendor/tacedge-markup.js is not loaded'); } catch(e){}
      return null;
    }
    var kindStyles = opts.kindStyles || {};
    var currentKind = 'select';
    var handle;

    var m = window.TacEdgeMarkup.createMarkup({
      map: ctrl.map,
      MarkerClass: maplibregl.Marker,
      layerId: 'markup',
      style: opts.style,
      onChange: function(ev, row){
        if(ev === 'tool'){
          // engine auto-returned to select (one-shot tools like point)
          if(row === 'select' && currentKind !== 'select'){
            currentKind = 'select';
            if(opts.onToolChange) opts.onToolChange('select');
          }
          return;
        }
        if(ev === 'create' || ev === 'update' || ev === 'delete'){
          if(opts.onChange) opts.onChange(ev, row);
        }
      }
    });

    handle = {
      setTool: function(kind){
        currentKind = MARKUP_TOOL_FOR_KIND[kind] ? kind : 'select';
        var st = kindStyles[currentKind];
        if(st) m.setStyle(st);
        var dp = currentKind === 'select' ? {} : { kind: currentKind };
        // markerColor styles point markers (point features carry their style
        // in properties.style, which default properties may override)
        if(st && st.markerColor) dp.style = { iconColor: st.markerColor };
        m.setDefaultProperties(dp);
        m.setTool(MARKUP_TOOL_FOR_KIND[currentKind]);
      },
      getTool: function(){ return currentKind; },
      isEditing: function(){ return m.isEditing(); },
      saveEdits: function(){ m.saveEdits(); },
      cancelEdits: function(){ m.cancelEdits(); },
      getFeatures: function(){ return m.getFeatures(); },
      setFeatures: function(list){ m.setFeatures(list); },
      removeFeature: function(id){ m.removeFeature(id); },
      restyle: function(fn){ m.restyle(fn); },
      toGeoJSON: function(){ return m.toGeoJSON(); },
      clear: function(){ m.clear(); },
      setVisible: function(v){ m.setVisible(v); },
      setStyle: function(st){ m.setStyle(st); },
      setCircleRadius: function(meters){ m.setCircleRadius(meters); },
      on: function(cb){ return m.on(cb); },
      dispose: function(){ m.dispose(); }
    };
    instances.markups.push(handle);
    return handle;
  }

  return { geo:geo, sector:sector, create:create, attachMarkup:attachMarkup,
           fmtNZTM:fmtNZTM, lngLatToNZTM:lngLatToNZTM, ESRI:ESRI, DEM:DEM,
           LINZ_ATTRIB:LINZ_ATTRIB, hasLinzKey:hasLinzKey, instances:instances };
})();
