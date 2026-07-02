/* ============================================================
   SAROP shared map component (reused by M2 The COP and M4 Field
   Capture). Wraps MapLibre GL with the incident's area-of-operation
   geodata, the satellite + terrain base, and an offline-safe base so
   the same component serves the desktop COP and the offline field cut.

   Base layers:
   - 'base'  : an always-present background fill (offline-safe). The map
               is never blank; vector overlays always render over it.
   - 'sat'   : Esri World Imagery raster, added only when online.
   - terrain : AWS Terrarium DEM, applied only when online AND opts.terrain.

   Consumers add their own overlays in opts.onReady(map, ctrl); the
   component keeps 'sat' beneath those overlays and toggles it with
   ctrl.setOnline(bool). No connectivity is assumed: setOnline(false)
   leaves the vector picture fully usable with no tile fetch.
   ============================================================ */
window.SaropMap = (function(){
  'use strict';

  var ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  var DEM  = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

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
        sources: {
          sat: { type:'raster', tiles:[ESRI], tileSize:256, maxzoom:18, attribution:'Imagery © Esri, Maxar, Earthstar Geographics' },
          dem: { type:'raster-dem', tiles:[DEM], tileSize:256, maxzoom:14, encoding:'terrarium', attribution:'Elevation: Terrarium (AWS Open Data)' }
        },
        layers: [ { id:'base', type:'background', paint:{ 'background-color': opts.baseColor || '#E7EAD9' } } ]
      }
    });

    if(opts.rotate === false){
      try { map.dragRotate.disable(); map.touchZoomRotate.disableRotation(); } catch(e){}
    } else {
      try { if(map.touchZoomRotate) map.touchZoomRotate.enableRotation(); } catch(e){}
    }
    map.on('error', function(){ /* swallow tile / DEM errors so offline never throws */ });

    var ctrl = { map: map, online: !!opts.online, terrain: terrain, baseBefore: null, _inited: false };

    // add / remove the satellite raster and terrain with connectivity
    ctrl.setOnline = function(on){
      ctrl.online = !!on;
      try {
        if(on){
          if(!map.getLayer('sat')){
            map.addLayer({ id:'sat', type:'raster', source:'sat', paint:{ 'raster-fade-duration':200 } }, ctrl.baseBefore || undefined);
          }
          if(terrain){ try { map.setTerrain({ source:'dem', exaggeration: opts.exaggeration || 1.3 }); } catch(e){} }
        } else {
          try { map.setTerrain(null); } catch(e){}
          if(map.getLayer('sat')) map.removeLayer('sat');
        }
      } catch(e){}
    };
    ctrl.setBaseColor = function(c){ try { map.setPaintProperty('base','background-color', c); } catch(e){} };
    ctrl.resize = function(){ try { map.resize(); } catch(e){} };

    function ready(){
      if(ctrl._inited) return; ctrl._inited = true;
      if(opts.controls){
        map.addControl(new maplibregl.NavigationControl({ visualizePitch: terrain, showCompass: opts.rotate !== false }), opts.controlPos || 'top-left');
        map.addControl(new maplibregl.ScaleControl({ unit:'metric' }), 'bottom-right');
        map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right');
      }
      if(opts.onReady) opts.onReady(map, ctrl);         // consumer adds overlays over 'base'
      var layers = map.getStyle().layers || [];          // insert 'sat' beneath those overlays
      for(var i=0;i<layers.length;i++){ if(layers[i].id!=='base'){ ctrl.baseBefore = layers[i].id; break; } }
      ctrl.setOnline(ctrl.online);
      if(terrain){ try { map.setSky({'sky-color':'#9fc0d6','sky-horizon-blend':0.6,'horizon-color':'#dfe6d8','horizon-fog-blend':0.6,'fog-color':'#e4e9dd','fog-ground-blend':0.4}); } catch(e){} }
      if(opts.onDone) opts.onDone(map, ctrl);
    }
    // Do not rely on 'load' alone (it waits on the first tile render, which can
    // be delayed, or offline never fires). Poll isStyleLoaded() as a fallback.
    map.on('load', ready);
    (function poll(n){ if(ctrl._inited) return; if(map.isStyleLoaded()){ ready(); return; } if(n<80) setTimeout(function(){ poll(n+1); }, 80); })(0);

    return ctrl;
  }

  return { geo:geo, sector:sector, create:create, fmtNZTM:fmtNZTM, lngLatToNZTM:lngLatToNZTM, ESRI:ESRI, DEM:DEM };
})();
