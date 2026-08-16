/* Project Nobel — shared page behaviour.
   Vanilla port of interior.dev components and docs shell.
   Design tokens and materials from interior globals.css / DESIGN.md.
   Interaction timings match shipped interior components:
     enter easing  cubic-bezier(.23, 1, .32, 1)
     exit easing   cubic-bezier(.4, 0, 1, 1)
     tooltip       200ms open · 120ms close · 400ms warm window
     copy success  2000ms · check draw 260ms
   Everything collapses to 0ms under prefers-reduced-motion. */

(function () {
  "use strict";

  var reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ================= theme ================= */

  var KEY = "interior-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === "light") document.documentElement.classList.remove("dark");
  else if (saved === "dark") document.documentElement.classList.add("dark");

  function isDark() {
    return document.documentElement.classList.contains("dark");
  }

  function setTheme(dark) {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem(KEY, dark ? "dark" : "light"); } catch (e) {}
    paintThemeButtons(dark);
  }

  function paintThemeButtons(dark) {
    var light = $("[data-theme-light]");
    var darkBtn = $("[data-theme-dark]");
    if (light) light.setAttribute("aria-pressed", String(!dark));
    if (darkBtn) darkBtn.setAttribute("aria-pressed", String(dark));
  }

  /* ================= scroll: progress, spy, hide-on-scroll ================= */

  function scrollRoot() {
    return $("#doc-scroll") || document.documentElement;
  }

  function initScroll() {
    var bar = $(".progress");
    var header = $(".doc-header");
    var scroller = scrollRoot();
    var links = $$(".toc a[href^='#']");
    var targets = links.map(function (a) {
      var t = document.getElementById(a.getAttribute("href").slice(1));
      return t ? { link: a, el: t } : null;
    }).filter(Boolean);

    var lastY = scroller.scrollTop || window.scrollY;
    var ticking = false;

    function scrollY() {
      return scroller === document.documentElement ? window.scrollY : scroller.scrollTop;
    }

    function scrollHeight() {
      return scroller === document.documentElement
        ? document.documentElement.scrollHeight
        : scroller.scrollHeight;
    }

    function clientHeight() {
      return scroller === document.documentElement
        ? window.innerHeight
        : scroller.clientHeight;
    }

    function update() {
      ticking = false;
      var y = scrollY();

      if (bar) {
        var travel = scrollHeight() - clientHeight();
        var pct = travel > 0 ? (y / travel) * 100 : 0;
        bar.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + "%";
      }

      if (header && !document.body.hasAttribute("data-layer-open")) {
        var down = y > lastY;
        if (y > 220 && down) header.setAttribute("data-hidden", "");
        else header.removeAttribute("data-hidden");
      }
      lastY = y;

      if (!targets.length) return;
      var spyLine = scroller === document.documentElement ? 130 : scroller.getBoundingClientRect().top + 130;
      var active = targets[0];
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].el.getBoundingClientRect().top <= spyLine) active = targets[i];
      }
      if (y + clientHeight() >= scrollHeight() - 4) {
        active = targets[targets.length - 1];
      }
      for (var j = 0; j < targets.length; j++) {
        targets[j].link.classList.toggle("active", targets[j] === active);
      }
    }

    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ================= scroll lock (shared by drawer + palette) ================= */

  var lockCount = 0;
  var prevOverflow = "";
  var prevPadding = "";

  function lockScroll() {
    if (lockCount++ > 0) return;
    var doc = document.documentElement;
    var gutter = window.innerWidth - doc.clientWidth;
    prevOverflow = doc.style.overflow;
    prevPadding = doc.style.paddingRight;
    doc.style.overflow = "hidden";
    if (gutter > 0) doc.style.paddingRight = gutter + "px";
    document.body.setAttribute("data-layer-open", "");
  }

  function unlockScroll() {
    if (--lockCount > 0) return;
    lockCount = 0;
    var doc = document.documentElement;
    doc.style.overflow = prevOverflow;
    doc.style.paddingRight = prevPadding;
    document.body.removeAttribute("data-layer-open");
  }

  /* Focus trap — tab wraps inside the container, restores focus on release. */
  function trapFocus(container, returnTo) {
    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function onKey(e) {
      if (e.key !== "Tab") return;
      var f = $$(SEL, container).filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener("keydown", onKey);
    return function release() {
      container.removeEventListener("keydown", onKey);
      if (returnTo && returnTo.focus) { try { returnTo.focus(); } catch (e) {} }
    };
  }

  /* ================= mobile drawer (interior mobile-nav) ================= */

  function initDrawer() {
    var burger = $(".mobile-nav-btn");
    var sidebar = $(".site-sidebar");
    if (!burger) return;

    var scrim = el("div", "scrim");
    scrim.setAttribute("aria-hidden", "true");
    var panel = el("aside", "drawer");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Navigation");
    panel.setAttribute("tabindex", "-1");

    var head = el("div", "drawer-head");
    head.appendChild(el("div", "drawer-title", "Project Nobel"));
    var close = el("button", "drawer-close mat-cap press");
    close.type = "button";
    close.setAttribute("aria-label", "Close navigation");
    close.textContent = "✕";
    head.appendChild(close);
    panel.appendChild(head);

    var list = el("nav", "drawer-links");
    if (sidebar) {
      $$(".sidebar-nav a", sidebar).forEach(function (a) {
        list.appendChild(a.cloneNode(true));
      });
    }
    panel.appendChild(list);

    /* page sections, so the hidden TOC is reachable on mobile too */
    var toc = $$(".toc a[href^='#']");
    if (toc.length) {
      panel.appendChild(el("div", "drawer-label", "On this page"));
      var sub = el("nav", "drawer-links sub");
      toc.forEach(function (a) { sub.appendChild(a.cloneNode(true)); });
      panel.appendChild(sub);
    }

    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    var open = false, release = null;

    function setOpen(v) {
      if (v === open) return;
      open = v;
      burger.setAttribute("aria-expanded", String(v));
      if (v) {
        var returnTo = document.activeElement;
        scrim.setAttribute("data-on", "");
        panel.setAttribute("data-on", "");
        lockScroll();
        release = trapFocus(panel, returnTo);
        var firstLink = $("a", panel);
        (firstLink || panel).focus();
      } else {
        scrim.removeAttribute("data-on");
        panel.removeAttribute("data-on");
        unlockScroll();
        if (release) { release(); release = null; }
      }
    }

    burger.addEventListener("click", function () { setOpen(!open); });
    close.addEventListener("click", function () { setOpen(false); });
    scrim.addEventListener("click", function () { setOpen(false); });
    panel.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
    });
    $$("a", panel).forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    window.addEventListener("resize", function () {
      if (open && window.innerWidth >= 1024) setOpen(false);
    });
  }

  /* ================= command palette ================= */
  /* Fuzzy ranking ported from interior.dev: sequential char match,
     streak bonus 4/char, +12 start-of-label, +8 boundary, -3 for keyword hits. */

  var BOUNDARY = /[\s\-_/.:]/;

  function scoreOne(text, q, penalty) {
    text = text.toLowerCase();
    var ti = 0, streak = 0, score = 0, hits = [];
    for (var i = 0; i < q.length; i++) {
      var c = q[i];
      var found = -1;
      for (var j = ti; j < text.length; j++) {
        if (text[j] === c) { found = j; break; }
      }
      if (found < 0) return null;
      streak = found === ti && i > 0 ? streak + 1 : 0;
      score += 2 + streak * 4;
      if (found === 0) score += 12;
      else if (BOUNDARY.test(text[found - 1])) score += 8;
      hits.push(found);
      ti = found + 1;
    }
    return { score: score - penalty, hits: hits };
  }

  function rank(items, q) {
    var raw = q.toLowerCase().trim();
    var tight = raw.replace(/\s+/g, "");
    if (!tight) return items.map(function (it, i) { return { it: it, hits: [], order: i }; });

    var out = [];
    items.forEach(function (it, i) {
      /* Titles get fuzzy subsequence matching — forgiving of typos and
         partial words ("diariz" → "diarization"). */
      var t = scoreOne(it.t, tight, 0);
      if (t) { out.push({ it: it, hits: t.hits, score: t.score + 40, order: i }); return; }

      /* Body text gets substring matching only. Subsequence over a long
         paragraph matches nearly everything and made results meaningless. */
      var hay = (it.p + " " + it.t + " " + it.k).toLowerCase();
      var at = hay.indexOf(raw);
      if (at < 0) return;

      /* A section that says the word repeatedly, early, is more about it
         than one that mentions it once in passing. */
      var n = 0, from = at;
      while (from >= 0 && n < 4) { n++; from = hay.indexOf(raw, from + raw.length); }
      var boundary = at === 0 || /[\s\-_/&.,(]/.test(hay[at - 1]);
      var early = 1 - Math.min(1, at / Math.max(120, hay.length));
      out.push({
        it: it, hits: [],
        score: (boundary ? 14 : 6) + n * 3 + early * 6 - 3,
        order: i
      });
    });
    out.sort(function (x, y) { return (y.score - x.score) || (x.order - y.order); });
    return out;
  }

  function highlight(text, hits) {
    if (!hits || !hits.length) return document.createTextNode(text);
    var frag = document.createDocumentFragment();
    var set = {}, k;
    for (k = 0; k < hits.length; k++) set[hits[k]] = true;
    var buf = "", mark = false;
    for (var i = 0; i <= text.length; i++) {
      var isHit = !!set[i] && i < text.length;
      if (i === text.length || isHit !== mark) {
        if (buf) {
          if (mark) { var m = el("mark", null, buf); frag.appendChild(m); }
          else frag.appendChild(document.createTextNode(buf));
        }
        buf = ""; mark = isHit;
      }
      if (i < text.length) buf += text[i];
    }
    return frag;
  }

  function initPalette() {
    var items = window.NOBEL_INDEX || [];
    if (!items.length) return;

    var here = location.pathname.split("/").pop() || "index.html";

    var trigger = $(".search-trigger");

    var scrim = el("div", "scrim scrim-palette");
    scrim.setAttribute("aria-hidden", "true");
    var wrap = el("div", "palette");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", "Search documentation");

    var box = el("div", "palette-box mat-float");
    var inputRow = el("div", "palette-input");
    inputRow.appendChild(el("span", "palette-ico", "⌕"));
    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search all five documents…";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", "palette-list");
    input.setAttribute("aria-autocomplete", "list");
    input.autocomplete = "off";
    inputRow.appendChild(input);
    inputRow.appendChild(el("kbd", null, "Esc"));
    box.appendChild(inputRow);

    var listEl = el("div", "palette-list");
    listEl.id = "palette-list";
    listEl.setAttribute("role", "listbox");
    box.appendChild(listEl);

    var status = el("div", "sr-only");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    box.appendChild(status);

    var foot = el("div", "palette-foot");
    foot.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
                     '<span><kbd>↵</kbd> open</span>' +
                     '<span><kbd>Esc</kbd> close</span>';
    box.appendChild(foot);

    wrap.appendChild(box);
    document.body.appendChild(scrim);
    document.body.appendChild(wrap);

    var results = [], active = 0, open = false, release = null, statusTimer = null;

    function render() {
      results = rank(items, input.value);
      active = 0;
      listEl.innerHTML = "";

      if (!results.length) {
        var empty = el("div", "palette-empty");
        empty.appendChild(el("div", "pe-t", "No matches"));
        empty.appendChild(el("div", "pe-d", "Try a shorter query, or a term like “rubric”, “diarization”, “battery”."));
        listEl.appendChild(empty);
      } else {
        var lastPage = null;
        results.forEach(function (r, i) {
          if (r.it.p !== lastPage) {
            lastPage = r.it.p;
            listEl.appendChild(el("div", "palette-group", r.it.p));
          }
          var row = el("a", "palette-row");
          row.id = "prow-" + i;
          row.setAttribute("role", "option");
          row.href = r.it.f + "#" + r.it.h;
          if (r.it.f === here) row.classList.add("is-here");

          var t = el("span", "pr-t");
          t.appendChild(highlight(r.it.t, r.hits));
          row.appendChild(t);

          var meta = el("span", "pr-m");
          meta.textContent = r.it.lv === 3 ? "subsection" : r.it.p;
          row.appendChild(meta);

          row.addEventListener("mouseenter", function () { setActive(i); });
          row.addEventListener("click", function () { setOpen(false); });
          listEl.appendChild(row);
        });
      }
      paintActive();

      clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        status.textContent = results.length + (results.length === 1 ? " result" : " results");
      }, 400);
    }

    function rows() { return $$(".palette-row", listEl); }

    function paintActive() {
      var rs = rows();
      rs.forEach(function (r, i) {
        r.classList.toggle("active", i === active);
        if (i === active) r.setAttribute("aria-selected", "true");
        else r.removeAttribute("aria-selected");
      });
      var cur = rs[active];
      if (cur) {
        input.setAttribute("aria-activedescendant", cur.id);
        var top = cur.offsetTop, bot = top + cur.offsetHeight;
        var vt = listEl.scrollTop, vb = vt + listEl.clientHeight;
        if (top < vt + 8) listEl.scrollTop = Math.max(0, top - 8);
        else if (bot > vb - 8) listEl.scrollTop = bot - listEl.clientHeight + 8;
      } else {
        input.removeAttribute("aria-activedescendant");
      }
    }

    function setActive(i) {
      var n = rows().length;
      if (!n) return;
      active = (i + n) % n;
      paintActive();
    }

    function run() {
      var cur = rows()[active];
      if (cur) { setOpen(false); location.href = cur.getAttribute("href"); }
    }

    function setOpen(v) {
      if (v === open) return;
      open = v;
      if (v) {
        var returnTo = document.activeElement;
        scrim.setAttribute("data-on", "");
        wrap.setAttribute("data-on", "");
        lockScroll();
        input.value = "";
        render();
        release = trapFocus(wrap, returnTo);
        input.focus();
      } else {
        scrim.removeAttribute("data-on");
        wrap.removeAttribute("data-on");
        unlockScroll();
        if (release) { release(); release = null; }
      }
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); setActive(0); }
      else if (e.key === "End") { e.preventDefault(); setActive(rows().length - 1); }
      else if (e.key === "Enter") { e.preventDefault(); run(); }
      else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    });
    if (trigger) trigger.addEventListener("click", function () { setOpen(true); });
    scrim.addEventListener("click", function () { setOpen(false); });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === "/" && !open && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "")) {
        e.preventDefault();
        setOpen(true);
      }
    });
  }

  /* ================= copy buttons on code blocks ================= */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    return Promise.resolve(fallback());

    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      var sel = document.getSelection();
      var prev = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      if (prev && sel) { sel.removeAllRanges(); sel.addRange(prev); }
    }
  }

  function initCopy() {
    $$("pre").forEach(function (pre) {
      if (pre.parentNode.classList.contains("pre-wrap")) return;
      var wrap = el("div", "pre-wrap");
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = el("button", "copy-btn");
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML = '<span class="cb-label">Copy</span>';
      wrap.appendChild(btn);

      var timer = null;
      btn.addEventListener("click", function () {
        copyText(pre.innerText).then(function () {
          btn.setAttribute("data-copied", "");
          $(".cb-label", btn).textContent = "Copied";
          btn.setAttribute("aria-label", "Copied to clipboard");
          clearTimeout(timer);
          timer = setTimeout(function () {
            btn.removeAttribute("data-copied");
            $(".cb-label", btn).textContent = "Copy";
            btn.setAttribute("aria-label", "Copy code");
          }, 2000);
        });
      });
    });
  }

  /* ================= tooltip group (glossary + estimate markers) ================= */
  /* 200ms open · 120ms close · 400ms warm window, per interior.dev. */

  /* [phrase, concept, definition] — concept dedupes synonyms so a page
     never explains the same idea twice under two spellings. */
  var GLOSSARY = [
    ["speaker diarization", "diarization", "Splitting a transcript by who was speaking. Without it we know what was said but not whether the associate or the customer said it — which most of the rubric depends on."],
    ["diarization", "diarization", "Splitting a transcript by who was speaking. Without it we know what was said but not whether the associate or the customer said it — which most of the rubric depends on."],
    ["word error rate", "wer", "Share of words a transcription gets wrong. Lower is better, and hard to keep low on code-mixed Hindi–English retail speech."],
    ["row-level security", "rls", "Postgres rules that scope every query to the rows a user is allowed to see — enforced by the database itself, not by application code."],
    ["foreground service", "fgservice", "An Android service that keeps running with a visible notification. Required for continuous recording, though aggressive OEM battery managers can still kill it."],
    ["edge function", "edgefn", "A small serverless function (here, on Supabase) that runs on upload and glues the pipeline stages together."],
    ["code-mixed", "codemix", "Switching between two languages inside one sentence — normal in Indian retail speech, and difficult for speech recognition."],
    ["rubric", "rubric", "The retailer's own checklist of behaviours that make a good interaction — greeting, needs discovery, and so on. They write it; we only supply a starting template."],
    ["Opus", "opus", "An audio codec tuned for speech at very low bitrates. It is what keeps a full 8-hour shift down to a few megabytes."],
    ["DPDP", "dpdp", "India's Digital Personal Data Protection Act. A recorded voice counts as personal data under it, which is why notice and consent matter here."],
    ["PII", "pii", "Personally identifiable information — names, phone numbers, card numbers, addresses. Stripped from transcripts before they are stored."]
  ];

  var EST_NOTE = "Placeholder figure — not yet measured or agreed with the customer. Treat as illustrative until verified.";

  function initTooltips() {
    var tip = el("div", "tip");
    tip.setAttribute("role", "tooltip");
    tip.id = "nobel-tip";
    document.body.appendChild(tip);

    var openTimer = null, closeTimer = null, warmUntil = 0, current = null, blocked = false;

    function place(target) {
      var r = target.getBoundingClientRect();
      tip.style.visibility = "hidden";
      tip.setAttribute("data-on", "");
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = r.left + r.width / 2 - tw / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
      var above = r.top > th + 16;
      var top = above ? r.top - th - 9 : r.bottom + 9;
      tip.style.left = Math.round(left) + "px";
      tip.style.top = Math.round(top) + "px";
      tip.setAttribute("data-side", above ? "top" : "bottom");
      tip.style.visibility = "";
    }

    function show(target, immediate) {
      if (blocked) return;
      clearTimeout(closeTimer);
      var warm = Date.now() < warmUntil;
      var delay = immediate || warm ? 0 : 200;
      clearTimeout(openTimer);
      openTimer = setTimeout(function () {
        current = target;
        tip.textContent = target.getAttribute("data-tip") || "";
        tip.setAttribute("data-warm", warm ? "1" : "0");
        place(target);
        target.setAttribute("aria-describedby", "nobel-tip");
      }, reduced ? 0 : delay);
    }

    function hide(immediate) {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        if (current) current.removeAttribute("aria-describedby");
        current = null;
        tip.removeAttribute("data-on");
        warmUntil = Date.now() + 400;
      }, reduced || immediate ? 0 : 120);
    }

    function bind(node) {
      node.addEventListener("pointerenter", function () { show(node, false); });
      node.addEventListener("pointerleave", function () { blocked = false; hide(false); });
      node.addEventListener("pointerdown", function () { blocked = true; hide(true); });
      node.addEventListener("pointercancel", function () { hide(true); });
      node.addEventListener("focus", function () {
        if (node.matches(":focus-visible")) show(node, true);
      });
      node.addEventListener("blur", function () { hide(true); });
      node.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { blocked = true; hide(true); }
      });
    }

    /* explicit markers already in the HTML */
    $$("[data-tip]").forEach(function (n) {
      if (!n.hasAttribute("tabindex")) n.setAttribute("tabindex", "0");
      bind(n);
    });

    /* estimate markers */
    $$(".est").forEach(function (n) {
      n.setAttribute("data-tip", EST_NOTE);
      n.setAttribute("tabindex", "0");
      n.setAttribute("role", "note");
      n.setAttribute("aria-label", "Unverified estimate");
      bind(n);
    });

    /* auto-wrap the first occurrence of each concept in body prose.
       Longest phrase first, so "speaker diarization" wins over "diarization". */
    var terms = GLOSSARY.slice().sort(function (a, b) { return b[0].length - a[0].length; });
    var used = {};
    var main = $("main");
    if (!main) return;

    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentElement;
        while (p && p !== main) {
          var tag = p.tagName;
          if (/^(A|CODE|PRE|H1|H2|H3|H4|KBD|MARK|BUTTON|SVG)$/.test(tag)) return NodeFilter.FILTER_REJECT;
          if (p.classList && (p.classList.contains("gl") || p.classList.contains("pill"))) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(function (tn) {
      for (var i = 0; i < terms.length; i++) {
        var phrase = terms[i][0], concept = terms[i][1], def = terms[i][2];
        if (used[concept]) continue;
        var re = new RegExp("\\b" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
        var m = re.exec(tn.nodeValue);
        if (!m) continue;
        used[concept] = true;
        var after = tn.splitText(m.index);
        after.nodeValue = after.nodeValue.slice(m[0].length);
        var span = el("span", "gl", m[0]);
        span.setAttribute("data-tip", def);
        span.setAttribute("tabindex", "0");
        tn.parentNode.insertBefore(span, after);
        bind(span);
        return;
      }
    });
  }

  /* ================= sortable tables ================= */

  function initSortable() {
    $$("table[data-sortable]").forEach(function (table) {
      var head = $("thead tr", table);
      var body = $("tbody", table);
      if (!head || !body) return;
      var ths = $$("th", head);

      ths.forEach(function (th, idx) {
        if (th.hasAttribute("data-nosort")) return;
        th.setAttribute("role", "button");
        th.setAttribute("tabindex", "0");
        th.classList.add("th-sort");
        th.setAttribute("aria-sort", "none");

        function sort() {
          var dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
          ths.forEach(function (o) { if (o !== th) o.setAttribute("aria-sort", "none"); });
          th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");

          var rows = $$("tr", body);
          rows.sort(function (a, b) {
            var x = (a.children[idx] || {}).innerText || "";
            var y = (b.children[idx] || {}).innerText || "";
            var nx = parseFloat(x.replace(/[^0-9.\-]/g, ""));
            var ny = parseFloat(y.replace(/[^0-9.\-]/g, ""));
            if (!isNaN(nx) && !isNaN(ny) && /\d/.test(x) && /\d/.test(y)) return (nx - ny) * dir;
            return x.trim().localeCompare(y.trim()) * dir;
          });
          rows.forEach(function (r) { body.appendChild(r); });
        }

        th.addEventListener("click", sort);
        th.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); }
        });
      });
    });
  }

  /* ================= text reveal (interior TextReveal) ================= */

  var TR_DURATION = 600;
  var TR_STAGGER = 0.055;
  var TR_MAX = 1.6;

  function startTextReveal(target) {
    if (target.classList.contains("text-reveal-started")) return;
    target.classList.add("text-reveal-started");

    var units = $$(".text-reveal-unit", target);
    var stepMs = target._trStepMs || 55;
    var ease = "cubic-bezier(0.23, 1, 0.32, 1)";

    units.forEach(function (u, i) {
      if (reduced) {
        u.style.opacity = "1";
        u.style.transform = "none";
        return;
      }
      try {
        u.animate(
          [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: TR_DURATION,
            delay: i * stepMs,
            easing: ease,
            fill: "forwards",
          }
        );
      } catch (e) {
        u.style.opacity = "1";
        u.style.transform = "none";
      }
    });
  }

  function buildTextReveal(target, opts) {
    opts = opts || {};
    var startOnView = opts.startOnView !== false;

    if (target.hasAttribute("data-text-reveal")) return;
    target.setAttribute("data-text-reveal", "");

    var full = target.textContent.replace(/\s+/g, " ").trim();
    var sr = el("span", "sr-only");
    sr.textContent = full;

    var live = el("span", "text-reveal-live");
    live.setAttribute("aria-hidden", "true");

    var idx = 0;

    function addWord(word, parent) {
      var u = el("span", "text-reveal-unit");
      u.textContent = word;
      u.style.opacity = "0";
      u.style.transform = "translateY(10px)";
      parent.appendChild(u);
    }

    function walk(node, parent) {
      if (node.nodeType === 3) {
        var bits = node.textContent.split(/\s+/).filter(Boolean);
        bits.forEach(function (w, i) {
          if (i > 0) parent.appendChild(document.createTextNode(" "));
          addWord(w, parent);
          idx++;
        });
      } else if (node.nodeName === "BR") {
        parent.appendChild(document.createElement("br"));
      } else if (node.nodeType === 1) {
        var wrap = document.createElement(node.nodeName);
        if (node.className) wrap.className = node.className;
        if (node.id) wrap.id = node.id;
        parent.appendChild(wrap);
        Array.prototype.forEach.call(node.childNodes, function (c) { walk(c, wrap); });
        if (!wrap.childNodes.length) wrap.remove();
      }
    }

    Array.prototype.forEach.call(target.childNodes, function (c) { walk(c, live); });

    target.textContent = "";
    target.appendChild(sr);
    target.appendChild(live);
    target.classList.add("text-reveal");

    var stepSec = idx > 1
      ? Math.min(TR_STAGGER, Math.max(0, TR_MAX - TR_DURATION / 1000) / (idx - 1))
      : 0;
    target._trStepMs = Math.round(stepSec * 1000);

    if (reduced) {
      startTextReveal(target);
      return;
    }

    if (!startOnView) {
      setTimeout(function () { startTextReveal(target); }, 120);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      startTextReveal(target);
      return;
    }

    var rootEl = scrollRoot();
    var obs = new IntersectionObserver(function (entries) {
      if (entries[0] && entries[0].isIntersecting) {
        startTextReveal(target);
        obs.disconnect();
      }
    }, {
      root: rootEl === document.documentElement ? null : rootEl,
      threshold: 0.15,
    });
    obs.observe(target);
  }

  function initTextReveal() {
    $$(".hero h1, .hero .lede").forEach(function (heading) {
      buildTextReveal(heading, { startOnView: false });
    });
    $$("main h2, .tile .t").forEach(function (heading) {
      buildTextReveal(heading, { startOnView: true });
    });
  }

  /* ================= show more (interior ShowMore) ================= */

  var smId = 0;

  function initShowMore() {
    $$(".note, .tile .d").forEach(function (host) {
      if (host.hasAttribute("data-show-more-ready")) return;
      host.setAttribute("data-show-more-ready", "");

      var lines = parseInt(host.getAttribute("data-show-more-lines") || "3", 10);
      var maxH = parseInt(host.getAttribute("data-show-more-max") || "320", 10);
      var inTile = host.closest(".tile");

      var shell = el("div", "show-more-shell");
      var region = el("div", "show-more-region");
      var regionId = "show-more-" + (++smId);
      region.id = regionId;

      var content = el("div", "show-more-content");
      if (host.classList.contains("note")) {
        var title = $(".t", host);
        Array.prototype.forEach.call(host.children, function (ch) {
          if (ch !== title) content.appendChild(ch);
        });
      } else {
        while (host.firstChild) content.appendChild(host.firstChild);
      }
      region.appendChild(content);

      var veil = el("div", "show-more-veil");
      veil.setAttribute("aria-hidden", "true");

      shell.appendChild(region);
      shell.appendChild(veil);

      var btn = el("button", "show-more-btn mat-cap press");
      btn.type = "button";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", regionId);
      btn.innerHTML =
        '<span class="show-more-labels">' +
        '<span class="show-more-more">Show more</span>' +
        '<span class="show-more-less">Show less</span>' +
        '</span>' +
        '<svg class="show-more-chevron" width="12" height="12" viewBox="0 0 256 256" aria-hidden="true">' +
        '<polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg>';

      host.classList.add("show-more");
      host.appendChild(shell);
      host.appendChild(btn);

      var expanded = false;
      var metrics = null;

      function read() {
        var styles = getComputedStyle(content);
        var line = parseFloat(styles.lineHeight);
        if (!line || !isFinite(line)) {
          line = parseFloat(styles.fontSize) * 1.5;
        }
        var full = content.scrollHeight;
        metrics = { line: line, full: full };
        paint();
      }

      function paint() {
        if (!metrics) return;
        var clamped = metrics.line * lines;
        var collapsed = Math.min(clamped, metrics.full);
        var fullCap = Math.min(metrics.full, maxH);
        var expandable = metrics.full - collapsed > 1;

        btn.classList.toggle("show-more-hidden", !expandable);
        if (!expandable) {
          region.style.height = "auto";
          region.style.maxHeight = "";
          region.style.overflowY = "";
          veil.setAttribute("data-off", "");
          return;
        }

        var open = expanded;
        var capped = metrics.full > maxH;
        var scrollable = open && capped;
        var h = open ? fullCap : collapsed;

        region.style.height = h + "px";
        region.style.maxHeight = open ? maxH + "px" : "";
        region.style.overflowY = scrollable ? "auto" : "hidden";
        if (scrollable) {
          region.setAttribute("role", "region");
          region.setAttribute("tabindex", "0");
        } else {
          region.removeAttribute("role");
          region.removeAttribute("tabindex");
        }

        var veiled = !open || scrollable;
        if (veiled) veil.removeAttribute("data-off");
        else veil.setAttribute("data-off", "");

        btn.setAttribute("aria-expanded", String(open));
        host.classList.toggle("show-more-open", open);
      }

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (expanded) region.scrollTop = 0;
        expanded = !expanded;
        paint();
      });

      if (inTile) {
        btn.addEventListener("mousedown", function (e) { e.stopPropagation(); });
      }

      read();
      if (typeof ResizeObserver !== "undefined") {
        var ro = new ResizeObserver(read);
        ro.observe(content);
      }
      window.addEventListener("resize", read, { passive: true });
    });
  }

  /* ================= press depth (interior PressDepth) ================= */

  var PD_DEPTH = 4;
  var PD_TILT = 7;

  function initPressDepth() {
    $$(".press-depth").forEach(function (btn) {
      var face = $(".press-depth-face", btn);
      if (!face) return;

      var pointerId = null;
      var tracking = false;
      var down = false;
      var origin = null;

      function contains(clientX, clientY) {
        var r = btn.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      }

      function setPressed(next, ox, oy) {
        down = next;
        if (next) {
          btn.setAttribute("data-pressed", "");
          if (!reduced && ox != null && oy != null) {
            face.style.setProperty("--pd-ty", PD_DEPTH + "px");
            face.style.setProperty("--pd-rx", (-oy * PD_TILT) + "deg");
            face.style.setProperty("--pd-ry", (ox * PD_TILT) + "deg");
          } else {
            face.style.setProperty("--pd-ty", PD_DEPTH + "px");
            face.style.setProperty("--pd-rx", "0deg");
            face.style.setProperty("--pd-ry", "0deg");
          }
        } else {
          btn.removeAttribute("data-pressed");
          face.style.setProperty("--pd-ty", "0");
          face.style.setProperty("--pd-rx", "0deg");
          face.style.setProperty("--pd-ry", "0deg");
        }
      }

      function stop() {
        pointerId = null;
        tracking = false;
        origin = null;
        setPressed(false);
      }

      btn.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        var r = btn.getBoundingClientRect();
        origin = {
          x: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
          y: Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1)),
        };
        pointerId = e.pointerId;
        tracking = true;
        setPressed(true, origin.x, origin.y);
      });

      function onMove(e) {
        if (!tracking || e.pointerId !== pointerId) return;
        setPressed(contains(e.clientX, e.clientY), origin && origin.x, origin && origin.y);
      }

      function onLift(e) {
        if (e.pointerId !== pointerId) return;
        stop();
      }

      btn.addEventListener("keydown", function (e) {
        if (e.repeat) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setPressed(true, 0, 0);
        }
        if (e.key === "Escape") stop();
      });

      btn.addEventListener("keyup", function (e) {
        if (e.key === " " || e.key === "Enter" || e.key === "Escape") stop();
      });

      btn.addEventListener("blur", stop);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onLift);
      window.addEventListener("pointercancel", onLift);
      window.addEventListener("blur", stop);
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
      });
    });
  }

  /* ================= boot ================= */

  function init() {
    if (reduced) document.documentElement.setAttribute("data-reduced", "");
    paintThemeButtons(isDark());
    var lightBtn = $("[data-theme-light]");
    var darkBtn = $("[data-theme-dark]");
    if (lightBtn) lightBtn.addEventListener("click", function () { setTheme(false); });
    if (darkBtn) darkBtn.addEventListener("click", function () { setTheme(true); });
    initScroll();
    initDrawer();
    initPalette();
    initCopy();
    initTooltips();
    initSortable();
    initTextReveal();
    initShowMore();
    initPressDepth();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
