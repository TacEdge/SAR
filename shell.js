/* ============================================================
   SAROP Workspace prototype shell
   Loads each unchanged screen into an iframe, pages Prev / Next,
   applies the global domain to the active screen through the
   screen's OWN controls, and connects each module's primary
   hand-off button to the module it leads to. No screen is modified.
   ============================================================ */
(function(){
  'use strict';

  // Module nav icons (inline stroke SVGs), keyed by the module's code in the
  // incident-workflow order: stand-up, callout, staging, tasking, COP, field,
  // log, forms, close-out.
  var IC = {
    M1:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    M2:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    M3:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    M4:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="m8 12 2.5 2.5L15.5 9.5"/></svg>',
    M5:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>',
    M6:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    M7:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
    M8:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h6M7 16h4"/></svg>',
    M9:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>'
  };

  // Incident-workflow order: stand up → call out → stage resources → task →
  // run the COP → capture in the field → preserve the record → complete
  // forms → close out. Files are loaded byte-for-byte unchanged.
  var SCREENS = [
    {file:'M1 Stand-up Screen.html',              code:'M1', name:'Stand-up & Incident Control'},
    {file:'M2 Notifications and Callout Screen.html', code:'M2', name:'Notifications & Callout'},
    {file:'M3 Resources and Staging Screen.html', code:'M3', name:'Resources & Staging'},
    {file:'M4 Tasking Screen.html',               code:'M4', name:'Tasking'},
    {file:'M5 The COP Screen.html',               code:'M5', name:'The COP'},
    {file:'M6 Field Capture Screen.html',         code:'M6', name:'Field Capture'},
    {file:'M7 Log and Records Screen.html',       code:'M7', name:'Log & Records'},
    {file:'M8 Forms Engine Screen.html',          code:'M8', name:'Forms'},
    {file:'M9 Close-out Screen.html',             code:'M9', name:'Close-out & Outward Record'}
  ];

  // Connect each module's primary hand-off button to the module it leads to.
  // Every screen keeps its own in-screen behaviour; we only add a navigation
  // after a short delay so its own success state shows first. Attached into the
  // same-origin iframe, so no screen file is changed. Deep behaviours
  // (persistence, sync, report emit) stay as they are.
  var CONNECTORS = {
    // stand up → call people out (the first action once IC is established)
    'M1 Stand-up Screen.html':                 [{sel:'#goBtn',    to:'M2 Notifications and Callout Screen.html', delay:1100}],
    'M2 Notifications and Callout Screen.html': [{sel:'#sendBtn', to:'M3 Resources and Staging Screen.html', delay:1300}],
    'M4 Tasking Screen.html':                  [{sel:'#pushBtn',  to:'M6 Field Capture Screen.html',         delay:1100}],
    // end-of-operation reconciliation hands off to close-out
    'M3 Resources and Staging Screen.html':    [{sel:'#reconBtn', to:'M9 Close-out Screen.html',             delay:1100}]
  };

  var frame   = document.getElementById('screenFrame');
  var landing = document.getElementById('landing');
  var navList = document.getElementById('navList');

  var current    = -1;
  var domain     = 'land';
  var driveToken = 0; // bumped on each navigation to cancel stale drive loops
  var domainSyncBlockUntil = 0; // pause screen->shell domain sync just after navigating

  // ---- build the left nav ----
  var navItems = SCREENS.map(function(s, i){
    var b = document.createElement('button');
    b.className = 'navitem';
    b.type = 'button';
    b.innerHTML = '<span class="ic">' + (IC[s.code] || '') + '</span>' +
                  '<span class="code">' + s.code + '</span>' +
                  '<span class="name">' + s.name + '</span>';
    b.addEventListener('click', function(){ go(i); });
    navList.appendChild(b);
    return b;
  });

  // ---- apply the chosen domain to the active screen ----
  // Two same-origin mechanisms, in order of reliability:
  //  1. Set data-domain on the screen's <html>. Every screen's CSS keys its
  //     accent and marine styling off html[data-domain]. documentElement
  //     exists the moment parsing starts, so this lands immediately and does
  //     not depend on the screen's own scripts (which the webfont <link> can
  //     stall). This is the acceptable path named in the brief.
  //  2. Best-effort: also click the screen's built-in Land / Marine button so
  //     its in-screen toggle highlight and summary reflect the choice, once
  //     that screen's script has attached its handler.
  // Returns true once the choice is fully settled (button in sync, or the
  // screen has no built-in toggle so the attribute is the whole story).
  function applyDomain(){
    try {
      var doc = frame.contentDocument;
      if(!doc || !doc.documentElement) return false;
      doc.documentElement.setAttribute('data-domain', domain);
      doc.documentElement.setAttribute('data-shell', '1');
      var btn = doc.querySelector('.seg button[data-dom="' + domain + '"]');
      if(btn){
        if(btn.getAttribute('aria-pressed') !== 'true') btn.click();
        return btn.getAttribute('aria-pressed') === 'true';
      }
      return true;
    } catch(e){ return true; } // cross-origin: keep remembered choice, nothing more to do
  }

  // Drive the domain into a freshly navigated screen. We poll (rather than
  // wait on the iframe 'load' event) because the screens pull webfonts and
  // 'load' can be delayed a long time. We gate on the document URL so we
  // never touch the previous screen before the new document commits, and we
  // keep retrying until the choice settles so the built-in toggle syncs once
  // that screen's script is live. Cancelled if the user navigates again.
  function driveDomain(targetFile, token){
    var tries = 0;
    (function attempt(){
      if(token !== driveToken) return; // superseded by a newer navigation
      var onTarget = false, settled = false;
      try {
        var doc = frame.contentDocument;
        onTarget = !!(doc && doc.documentElement &&
                      decodeURIComponent(doc.URL || '').indexOf(targetFile) !== -1);
      } catch(e){ return; } // cross-origin: nothing to drive
      if(onTarget) settled = applyDomain();
      if(!settled && ++tries < 40) setTimeout(attempt, 100);
    })();
  }

  function indexByFile(file){ for(var i=0;i<SCREENS.length;i++){ if(SCREENS[i].file===file) return i; } return -1; }

  // Wire this screen's primary hand-off button(s) to navigate onward. Polls the
  // same-origin document (the button exists in static HTML) and attaches once.
  function connectScreen(file, token){
    var conns = CONNECTORS[file]; if(!conns) return;
    var tries = 0;
    (function attempt(){
      if(token !== driveToken) return; // superseded by a newer navigation
      var doc; try { doc = frame.contentDocument; } catch(e){ return; }
      var onTarget = doc && doc.documentElement && decodeURIComponent(doc.URL || '').indexOf(file) !== -1;
      if(onTarget){
        conns.forEach(function(c){
          var el = doc.querySelector(c.sel);
          if(el && !el.__wired){
            el.__wired = true;
            el.addEventListener('click', function(){
              // a disabled button never dispatches click, so a click here is a
              // real action; the screen may disable it in its own handler.
              var from = current, dest = indexByFile(c.to);
              if(dest < 0) return;
              // let the screen's own effect play, then hand off if still here
              setTimeout(function(){ if(current === from) go(dest); }, c.delay || 1000);
            });
          }
        });
        return;
      }
      if(tries++ < 50) setTimeout(attempt, 80);
    })();
  }

  // ---- navigate to a screen by flow index ----
  function go(i){
    if(i < 0 || i >= SCREENS.length) return;
    current = i;
    document.body.classList.add('entered'); // workspace shell exists only after entry
    landing.classList.add('hidden');
    document.body.classList.remove('navopen'); // close the mobile drawer on navigate
    frame.src = encodeURI(SCREENS[i].file);
    navItems.forEach(function(b, j){ b.classList.toggle('active', j === i); });
    document.title = 'SAROP Workspace — ' + SCREENS[i].code + ' ' + SCREENS[i].name;
    var tok = ++driveToken;
    domainSyncBlockUntil = Date.now() + 1600; // let the drive settle before syncing back
    driveDomain(SCREENS[i].file, tok);
    connectScreen(SCREENS[i].file, tok);
  }

  // Keep the sidebar toggle in step with the active screen's own Land / Marine
  // control, and carry the choice across modules. We read the screen's
  // data-domain (same-origin, no listener added) and mirror it; a short block
  // window after each navigation stops us from reading the new screen's default
  // before the drive has applied the remembered choice.
  setInterval(function(){
    if(current < 0 || Date.now() < domainSyncBlockUntil) return;
    try {
      var doc = frame.contentDocument;
      var d = doc && doc.documentElement && doc.documentElement.getAttribute('data-domain');
      if((d === 'land' || d === 'marine') && d !== domain){
        domain = d;
        document.documentElement.setAttribute('data-domain', domain);
        document.querySelectorAll('.seg button').forEach(function(x){
          x.setAttribute('aria-pressed', x.getAttribute('data-dom') === domain ? 'true' : 'false');
        });
      }
    } catch(e){}
  }, 500);

  // also re-apply on load where it does fire (webfonts present), as a backstop
  frame.addEventListener('load', function(){ if(current >= 0) applyDomain(); });

  // ---- top-bar controls ----
  document.querySelectorAll('.seg button').forEach(function(b){
    b.addEventListener('click', function(){
      domain = b.getAttribute('data-dom');
      document.documentElement.setAttribute('data-domain', domain);
      document.querySelectorAll('.seg button').forEach(function(x){
        x.setAttribute('aria-pressed', x.getAttribute('data-dom') === domain ? 'true' : 'false');
      });
      // re-drive the active screen so its built-in toggle syncs too
      if(current >= 0) driveDomain(SCREENS[current].file, ++driveToken);
    });
  });

  document.getElementById('beginBtn').addEventListener('click', function(){ go(0); });
})();
