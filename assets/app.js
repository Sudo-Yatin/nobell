/* Project Nobel — shared page behaviour.
   Theme toggle (persisted), TOC scrollspy, reading progress. No dependencies. */

(function () {
  "use strict";

  /* ---------- theme ---------- */
  var KEY = "nobel-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) document.documentElement.setAttribute("data-theme", saved);

  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", cur);
    try { localStorage.setItem(KEY, cur); } catch (e) {}
    paintThemeButtons(cur);
  }

  function paintThemeButtons(mode) {
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = mode === "light" ? "\u25D1" : "\u25D0";
      btns[i].setAttribute("aria-label", "Switch to " + (mode === "light" ? "dark" : "light") + " theme");
    }
  }

  /* ---------- scrollspy + progress ---------- */
  function init() {
    paintThemeButtons(document.documentElement.getAttribute("data-theme") || "dark");

    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener("click", toggleTheme);

    var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
    var targets = links
      .map(function (a) {
        var el = document.getElementById(a.getAttribute("href").slice(1));
        return el ? { link: a, el: el } : null;
      })
      .filter(Boolean);

    var bar = document.querySelector(".progress");
    var ticking = false;

    function update() {
      ticking = false;

      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var pct = h > 0 ? (window.scrollY / h) * 100 : 0;
        bar.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + "%";
      }

      if (!targets.length) return;
      var line = window.scrollY + 130;
      var active = targets[0];
      for (var j = 0; j < targets.length; j++) {
        if (targets[j].el.offsetTop <= line) active = targets[j];
      }
      // bottom of page always highlights the last entry
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 4) {
        active = targets[targets.length - 1];
      }
      for (var k = 0; k < targets.length; k++) {
        targets[k].link.classList.toggle("active", targets[k] === active);
      }
    }

    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
