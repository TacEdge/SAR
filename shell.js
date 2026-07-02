/* ============================================================
   SAROP Workspace prototype shell
   Loads each unchanged screen into an iframe, pages Prev / Next,
   applies the global domain to the active screen through the
   screen's OWN controls, and connects each module's primary
   hand-off button to the module it leads to. No screen is modified.
   ============================================================ */
(function(){
  'use strict';

  // Flow order. Files are loaded byte-for-byte unchanged.
  var SCREENS = [
    {file:'M1 Stand-up Screen.html',              code:'M1', name:'Stand-up & Incident Control', note:'Cold stand-up (F1)'},
    {file:'M2 The COP Screen.html',               code:'M2', name:'The COP',                     note:'Running picture (F3)'},
    {file:'M3 Tasking Screen.html',               code:'M3', name:'Tasking',                     note:'Task a team (F2)'},
    {file:'M4 Field Capture Screen.html',         code:'M4', name:'Field Capture',               note:'Offline field (F4)'},
    {file:'M5 Log and Records Screen.html',       code:'M5', name:'Log & Records',               note:'The trusted record'},
    {file:'M6 Forms Engine Screen.html',          code:'M6', name:'Forms Engine',                note:'Scored urgency'},
    {file:'M7 Notifications and Callout Screen.html', code:'M7', name:'Notifications & Callout', note:'Activation'},
    {file:'M8 Resources and Staging Screen.html', code:'M8', name:'Resources & Staging',         note:'Accountability'},
    {file:'M9 Close-out Screen.html',             code:'M9', name:'Close-out & Outward Record',  note:'Close-out (F5)'}
  ];

  // Connect each module's primary hand-off button to the module it leads to.
  // Every screen keeps its own in-screen behaviour; we only add a navigation
  // after a short delay so its own success state shows first. Attached into the
  // same-origin iframe, so no screen file is changed. Deep behaviours
  // (persistence, sync, report emit) stay as they are.
  var CONNECTORS = {
    'M1 Stand-up Screen.html':                 [{sel:'#goBtn',    to:'M2 The COP Screen.html',               delay:1100}],
    'M3 Tasking Screen.html':                  [{sel:'#pushBtn',  to:'M4 Field Capture Screen.html',         delay:1100}],
    'M7 Notifications and Callout Screen.html': [{sel:'#sendBtn', to:'M8 Resources and Staging Screen.html', delay:1300}],
    'M8 Resources and Staging Screen.html':    [{sel:'#reconBtn', to:'M9 Close-out Screen.html',             delay:1100}]
  };

  var frame   = document.getElementById('screenFrame');
  var landing = document.getElementById('landing');
  var navList = document.getElementById('navList');
  var stepLbl = document.getElementById('stepLabel');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');

  var current    = -1;
  var domain     = 'land';
  var driveToken = 0; // bumped on each navigation to cancel stale drive loops

  // ---- build the left nav ----
  var navItems = SCREENS.map(function(s, i){
    var b = document.createElement('button');
    b.className = 'navitem';
    b.type = 'button';
    b.innerHTML = '<span class="code">' + s.code + '</span>' +
                  '<span class="txt"><span class="name">' + s.name + '</span>' +
                  '<span class="note">' + s.note + '</span></span>';
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
    landing.classList.add('hidden');
    frame.src = encodeURI(SCREENS[i].file);
    navItems.forEach(function(b, j){ b.classList.toggle('active', j === i); });
    document.title = 'SAROP Workspace — ' + SCREENS[i].code + ' ' + SCREENS[i].name;
    stepLbl.textContent = (i + 1) + ' / ' + SCREENS.length;
    prevBtn.disabled = (i === 0);
    nextBtn.disabled = (i === SCREENS.length - 1);
    var tok = ++driveToken;
    driveDomain(SCREENS[i].file, tok);
    connectScreen(SCREENS[i].file, tok);
  }

  // also re-apply on load where it does fire (webfonts present), as a backstop
  frame.addEventListener('load', function(){ if(current >= 0) applyDomain(); });

  // ---- top-bar controls ----
  prevBtn.addEventListener('click', function(){ go(current - 1); });
  nextBtn.addEventListener('click', function(){ go(current + 1); });

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
