// Shared interaction layer. Every effect is progressive: the pages are complete
// without this file, and motion is skipped under prefers-reduced-motion or when
// the visitor turns effects off from the command palette (Ctrl/Cmd+K).
(function () {
  "use strict";
  var root = document.documentElement;
  var reduceMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function motionOK() { return !reduceMQ.matches && !root.classList.contains("fx-off"); }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---------- toast ---------- */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  /* ---------- pointer-driven globals: grid spotlight + reticle ---------- */
  var reticle = null;
  if (fine) {
    reticle = document.createElement("div");
    reticle.className = "reticle";
    reticle.setAttribute("aria-hidden", "true");
    document.body.appendChild(reticle);
  }
  var px = innerWidth / 2, py = innerHeight * .3, rx = px, ry = py, pending = false, retRaf = 0;
  function onMove(e) {
    px = e.clientX; py = e.clientY;
    if (!pending) { pending = true; requestAnimationFrame(applyMove); }
    if (reticle && motionOK()) {
      reticle.classList.add("on");
      reticle.classList.toggle("hot", !!(e.target.closest && e.target.closest("a, button, .card, input, [role=option]")));
      if (!retRaf) retRaf = requestAnimationFrame(trail);
    }
  }
  function applyMove() { pending = false; root.style.setProperty("--cx", px + "px"); root.style.setProperty("--cy", py + "px"); }
  function trail() {
    rx += (px - rx) * .22; ry += (py - ry) * .22;
    reticle.style.transform = "translate(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px)";
    retRaf = (Math.abs(px - rx) + Math.abs(py - ry) > .2) ? requestAnimationFrame(trail) : 0;
  }
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", function () { if (reticle) reticle.classList.remove("on"); });

  /* ---------- scroll progress + timeline + parallax ---------- */
  var header = $(".site-header");
  var timeline = $(".timeline");
  var jobs = timeline ? $$(".job", timeline) : [];
  var cover = null, sTick = false;
  function onScroll() {
    sTick = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    if (header) header.style.setProperty("--progress", h > 0 ? Math.min(1, scrollY / h).toFixed(4) : 0);
    if (timeline) {
      if (!motionOK()) { timeline.style.setProperty("--tl", 1); jobs.forEach(function (j) { j.classList.add("lit"); }); }
      else {
        var r = timeline.getBoundingClientRect(), line = innerHeight * .6;
        var p = Math.max(0, Math.min(1, (line - r.top) / r.height));
        timeline.style.setProperty("--tl", p.toFixed(4));
        jobs.forEach(function (j) { j.classList.toggle("lit", j.getBoundingClientRect().top + 36 < line); });
      }
    }
    if (cover && motionOK()) cover.style.setProperty("--par", (scrollY * .35).toFixed(1) + "px");
  }
  window.addEventListener("scroll", function () { if (!sTick) { sTick = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- reveal on scroll ---------- */
  var revealSel = [
    ".section-head", ".group-title", ".job", ".card", ".skill", ".edu > div", ".facts > div",
    ".about-photo", ".about-body > p", ".prose > *", ".meta", ".gallery a", ".pager a",
    ".contact .btn", "main > .wrap > h2", ".video"
  ].join(",");
  function setupReveals() {
    if (!motionOK() || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; el.classList.add("in"); io.unobserve(el);
        setTimeout(function () { el.style.removeProperty("--d"); }, 1500);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$(revealSel).forEach(function (el) {
      if (el.closest(".hero, .project-hero")) return;
      var sibs = Array.prototype.indexOf.call(el.parentNode.children, el);
      el.style.setProperty("--d", Math.min(sibs, 6) * 70 + "ms");
      el.classList.add("reveal");
      io.observe(el);
    });
    // Intro stagger for hero copy.
    $$(".hero .wrap > *, .project-hero .wrap > *").forEach(function (el, i) {
      el.style.setProperty("--d", (120 + i * 90) + "ms");
      el.classList.add("reveal");
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add("in"); }); });
    });
  }

  /* ---------- decode/scramble headline ---------- */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=<>/\\|";
  function scramble(el, dur) {
    if (!el || el.children.length || !motionOK()) return;
    var final = el.textContent;
    el.setAttribute("aria-label", final);
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / dur), out = "";
      for (var i = 0; i < final.length; i++) {
        var c = final[i];
        var reveal = (i / final.length) * .7 + .3;
        out += (c === " " || t >= reveal) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (t < 1) requestAnimationFrame(step); else { el.textContent = final; el.removeAttribute("aria-label"); }
    })(start);
  }

  /* ---------- card tilt + spotlight, magnetic buttons ---------- */
  function setupPointerFX() {
    if (!fine) return;
    $$(".card").forEach(function (card) {
      var raf = 0, lx = 0, ly = 0;
      card.addEventListener("pointermove", function (e) {
        if (e.pointerType !== "mouse") return;
        lx = e.clientX; ly = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          var r = card.getBoundingClientRect();
          var x = (lx - r.left) / r.width, y = (ly - r.top) / r.height;
          card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
          card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
          if (motionOK()) {
            card.classList.add("tilting");
            card.style.setProperty("--ry", ((x - .5) * 10).toFixed(2) + "deg");
            card.style.setProperty("--rx", ((.5 - y) * 8).toFixed(2) + "deg");
          }
        });
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("tilting");
        card.style.setProperty("--rx", "0deg"); card.style.setProperty("--ry", "0deg");
      });
    });
    $$(".btn").forEach(function (b) {
      b.addEventListener("pointermove", function (e) {
        if (!motionOK()) return;
        var r = b.getBoundingClientRect();
        b.style.setProperty("--tx", ((e.clientX - r.left - r.width / 2) * .18).toFixed(1) + "px");
        b.style.setProperty("--ty", ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + "px");
      });
      b.addEventListener("pointerleave", function () { b.style.removeProperty("--tx"); b.style.removeProperty("--ty"); });
    });
  }

  /* ---------- project hero: cover backdrop + flow-field particles ---------- */
  function setupProjectHero() {
    var ph = $(".project-hero");
    if (!ph) return;
    var g = $(".gallery img");
    if (g) {
      var src = g.getAttribute("src").replace(/[^/]+\.webp$/, "cover.webp");
      cover = document.createElement("div");
      cover.className = "hero-cover";
      cover.setAttribute("aria-hidden", "true");
      ph.prepend(cover);
      var im = new Image();
      im.onload = function () { cover.style.backgroundImage = "url('" + src + "')"; cover.classList.add("ready"); };
      im.src = src;
    }
    if (!motionOK()) return;
    flowField(ph);
  }

  function flowField(host) {
    var c = document.createElement("canvas");
    c.className = "flow-canvas";
    c.setAttribute("aria-hidden", "true");
    host.prepend(c);
    var ctx = c.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0, parts = [], running = false, visible = true, raf = 0, t = 0;
    var mouse = { x: -999, y: -999 };
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(700, W * H / 1400));
      parts = [];
      for (var i = 0; i < n; i++) parts.push(spawn({}));
    }
    function spawn(p) { p.x = Math.random() * W; p.y = Math.random() * H; p.life = 60 + Math.random() * 200; p.hue = Math.random(); return p; }
    function field(x, y) {
      return Math.sin(x * .0045 + t * .0004) * 2.1 + Math.cos(y * .006 - t * .0003) * 1.7 + Math.sin((x + y) * .002) * 1.3;
    }
    host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    host.addEventListener("pointerleave", function () { mouse.x = mouse.y = -999; });
    function frame() {
      raf = requestAnimationFrame(frame);
      t += 16;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], a = field(p.x, p.y);
        var vx = Math.cos(a) * 1.1, vy = Math.sin(a) * 1.1;
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 16000) { var f = (1 - d2 / 16000) * 4; var d = Math.sqrt(d2) || 1; vx += dx / d * f; vy += dy / d * f; }
        ctx.fillStyle = p.hue > .85 ? "rgba(122,92,255,.55)" : p.hue > .7 ? "rgba(0,255,198,.5)" : "rgba(0,200,255,.45)";
        ctx.fillRect(p.x, p.y, 1.4, 1.4);
        p.x += vx; p.y += vy;
        if (--p.life < 0 || p.x < -5 || p.x > W + 5 || p.y < -5 || p.y > H + 5) spawn(p);
      }
    }
    function update() {
      var want = visible && !document.hidden && motionOK();
      if (want && !running) { running = true; frame(); }
      else if (!want && running) { running = false; cancelAnimationFrame(raf); if (!motionOK()) ctx.clearRect(0, 0, W, H); }
    }
    resize();
    new ResizeObserver(function () { resize(); }).observe(host);
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; update(); }).observe(host);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("sim:fx", update);
    update();
  }

  /* ---------- debug view + motion toggle ---------- */
  function toggleDebug() {
    var on = root.classList.toggle("debug");
    window.dispatchEvent(new CustomEvent("sim:debug", { detail: on }));
    toast(on ? "Debug view on: wireframes and layout boxes" : "Debug view off");
  }
  function toggleFX() {
    var off = root.classList.toggle("fx-off");
    store("ck-fx", off ? "off" : null);
    window.dispatchEvent(new CustomEvent("sim:fx", { detail: !off }));
    if (reticle) reticle.classList.remove("on");
    onScroll();
    toast(off ? "Motion effects off (remembered on this device)" : "Motion effects on");
  }
  var KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"], kpos = 0;
  document.addEventListener("keydown", function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    kpos = (k === KONAMI[kpos]) ? kpos + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kpos === KONAMI.length) { kpos = 0; toggleDebug(); }
  });

  /* ---------- command palette ---------- */
  var PAGES = [
    ["Home", "index.html", "page"], ["Experience & skills", "experience.html", "page"], ["About", "AboutMe.html", "page"],
    ["Projects", "index.html#projects", "page"], ["Download CV (PDF)", "assets/files/Connor-King-CV.pdf", "file"],
    ["Soul Splicers", "SoulSplicers.html", "project"],
    ["Open World Sandbox in C++ & DirectX 11", "DXOpenWorld.html", "project"],
    ["Collision & Response System in DirectX 11", "DXCollisions.html", "project"],
    ["Self-Driving Car with Machine Learning", "SelfDrivingCar.html", "project"],
    ["3D Environments From Real-World Data", "GPSGame.html", "project"],
    ["Modular First Person Controller", "ModularFPController.html", "project"],
    ["To Me To You", "ToMeToYou.html", "project"], ["Kachiku 64", "Kachiku64.html", "project"],
    ["Sibling Sucker Punch", "SiblingSuckerPunch.html", "jam"], ["Swing City", "SwingCity.html", "jam"],
    ["Super Trash", "SuperTrash.html", "jam"], ["Faster than Darkness", "FasterThanDarkness.html", "jam"],
    ["Dragon Mockery (In Beta)", "DragonMockery.html", "jam"],
    ["LinkedIn", "https://www.linkedin.com/in/connor-k/", "link"], ["GitHub", "https://github.com/Connor-King/", "link"],
    ["soulsplicers.com", "https://soulsplicers.com", "link"]
  ];
  var EMAIL = "connor.king3131@gmail.com";
  var ACTIONS = [
    ["Copy email address", function () {
      (navigator.clipboard ? navigator.clipboard.writeText(EMAIL) : Promise.reject()).then(function () { say("Copied " + EMAIL); }, function () { location.href = "mailto:" + EMAIL; });
    }],
    ["Toggle debug view", function () { close(); toggleDebug(); }],
    ["Toggle motion effects", function () { close(); toggleFX(); }],
    ["Back to top", function () { close(); scrollTo({ top: 0, behavior: motionOK() ? "smooth" : "auto" }); }]
  ];
  if ($(".hero")) ACTIONS.splice(1, 0, ["Fire a sim pulse", function () { close(); window.dispatchEvent(new Event("sim:pulse")); }]);

  var pal, input, list, out, items = [], sel = 0;
  function buildPalette() {
    pal = document.createElement("dialog");
    pal.className = "palette";
    pal.setAttribute("aria-label", "Command palette");
    pal.innerHTML =
      '<div class="pal-head"><span aria-hidden="true">&gt;_</span><input type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Jump to a page, project or action&hellip;" spellcheck="false" autocomplete="off"></div>' +
      '<ul class="pal-list" id="pal-list" role="listbox"></ul><div class="pal-out" role="status"></div>' +
      '<div class="pal-foot"><span><kbd>&uarr;</kbd> <kbd>&darr;</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span><span>&uarr;&uarr;&darr;&darr;&larr;&rarr;&larr;&rarr;BA</span></div>';
    document.body.appendChild(pal);
    input = $("input", pal); list = $(".pal-list", pal); out = $(".pal-out", pal);
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); }
      else if (e.key === "Enter") { e.preventDefault(); run(items[sel]); }
    });
    pal.addEventListener("click", function (e) {
      if (e.target === pal) return close();
      var li = e.target.closest("[role=option]");
      if (li) run(items[+li.dataset.i]);
    });
  }
  function score(q, s) {
    s = s.toLowerCase(); if (!q) return 1;
    if (s.indexOf(q) >= 0) return 100 - s.indexOf(q);
    var i = 0; for (var j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) i++;
    return i === q.length ? 1 : 0;
  }
  function render() {
    var q = input.value.trim().toLowerCase();
    var all = PAGES.map(function (p) { return { label: p[0], href: p[1], kind: p[2] }; })
      .concat(ACTIONS.map(function (a) { return { label: a[0], fn: a[1], kind: "action" }; }));
    items = all.map(function (it) { it.s = score(q, it.label + " " + it.kind); return it; })
      .filter(function (it) { return it.s > 0; })
      .sort(function (a, b) { return q ? b.s - a.s : 0; });
    list.innerHTML = "";
    items.forEach(function (it, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "option"); li.id = "pal-o" + i; li.dataset.i = i;
      var b = document.createElement("button"); b.type = "button"; b.tabIndex = -1;
      b.textContent = it.label;
      var sm = document.createElement("small"); sm.textContent = it.kind; b.appendChild(sm);
      li.appendChild(b); list.appendChild(li);
    });
    if (!items.length) { var li = document.createElement("li"); li.className = "muted"; li.style.padding = "10px 12px"; li.textContent = "No matches"; list.appendChild(li); }
    select(0);
  }
  function select(i) {
    if (!items.length) { input.removeAttribute("aria-activedescendant"); return; }
    sel = (i + items.length) % items.length;
    $$("[role=option]", list).forEach(function (li, k) {
      li.firstChild.setAttribute("aria-selected", k === sel ? "true" : "false");
      li.setAttribute("aria-selected", k === sel ? "true" : "false");
    });
    input.setAttribute("aria-activedescendant", "pal-o" + sel);
    var cur = $("#pal-o" + sel); if (cur) cur.scrollIntoView({ block: "nearest" });
  }
  function run(it) {
    if (!it) return;
    if (it.fn) return it.fn();
    close();
    if (/^https?:/.test(it.href)) window.open(it.href, "_blank", "noopener");
    else location.href = it.href;
  }
  function say(msg) { out.textContent = msg; }
  function open() {
    if (!pal) buildPalette();
    if (typeof pal.showModal !== "function") return;
    if (pal.open) return;
    input.value = ""; out.textContent = ""; render();
    pal.showModal(); input.focus();
  }
  function close() { if (pal && pal.open) pal.close(); }
  document.addEventListener("keydown", function (e) {
    var typing = /input|textarea|select/i.test((e.target.tagName || "")) || e.target.isContentEditable;
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); pal && pal.open ? close() : open(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); open(); }
  });
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var nav = $(".site-header .nav");
  if (nav && typeof HTMLDialogElement === "function") {
    var kb = document.createElement("button");
    kb.type = "button"; kb.className = "kbd-btn";
    kb.setAttribute("aria-label", "Open command palette (" + (mac ? "Cmd" : "Ctrl") + "+K)");
    kb.innerHTML = '<span aria-hidden="true">&gt;_</span>';
    kb.addEventListener("click", open);
    nav.appendChild(kb);
    var foot = $(".site-footer .wrap");
    if (foot && fine) {
      var hint = document.createElement("span");
      hint.className = "footer-hint"; hint.setAttribute("aria-hidden", "true");
      hint.innerHTML = "<kbd>" + (mac ? "&#8984;" : "Ctrl") + "</kbd> <kbd>K</kbd> command palette";
      foot.appendChild(hint);
    }
  }

  /* ---------- go ---------- */
  setupReveals();
  setupPointerFX();
  setupProjectHero();
  scramble($(".hero h1"), 1100);
  scramble($(".project-hero h1"), 800);
  onScroll();
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onScroll);
})();
