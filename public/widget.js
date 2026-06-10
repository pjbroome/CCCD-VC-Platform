/*!
 * CCCD Virtual Consultation widget
 * Drop-in replacement for the Smile Virtual button.
 * Install: <script src="https://YOUR-PORTAL/widget.js" async
 *            data-label="Virtual Consultation" data-color="#c4a052" data-position="bottom-right"></script>
 * Auto-detects the portal URL from its own <script src>. No dependencies.
 */
(function () {
  "use strict";
  if (window.__cccdVCWidgetLoaded) return;
  window.__cccdVCWidgetLoaded = true;

  // --- resolve config + portal base url -----------------------------------
  var me =
    document.currentScript ||
    (function () {
      var s = document.getElementsByTagName("script");
      for (var i = s.length - 1; i >= 0; i--) if ((s[i].src || "").indexOf("widget.js") !== -1) return s[i];
      return null;
    })();
  var d = (me && me.dataset) || {};
  var base = (d.portal || (me && new URL(me.src).origin) || "").replace(/\/$/, "");
  var EMBED = base + "/embed";
  var LABEL = d.label || "Virtual Consultation";
  var COLOR = d.color || "#c4a052";
  var POS = d.position || "bottom-right"; // bottom-right | bottom-left

  // --- styles --------------------------------------------------------------
  var css =
    ".cccdvc-btn{position:fixed;z-index:2147483600;bottom:20px;" +
    (POS === "bottom-left" ? "left:20px;" : "right:20px;") +
    "display:inline-flex;align-items:center;gap:9px;padding:13px 20px;border:0;border-radius:999px;" +
    "background:" + COLOR + ";color:#fff;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;" +
    "box-shadow:0 8px 24px rgba(0,0,0,.22);cursor:pointer;transition:transform .15s ease,filter .15s ease;}" +
    ".cccdvc-btn:hover{transform:translateY(-1px);filter:brightness(1.06);}" +
    ".cccdvc-btn svg{width:20px;height:20px;flex:0 0 auto;}" +
    ".cccdvc-ov{position:fixed;inset:0;z-index:2147483601;background:rgba(15,14,25,.6);backdrop-filter:blur(2px);" +
    "display:none;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .2s ease;}" +
    ".cccdvc-ov.open{display:flex;opacity:1;}" +
    ".cccdvc-modal{position:relative;width:480px;max-width:100%;height:min(88vh,860px);background:#fff;border-radius:20px;" +
    "overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.4);transform:translateY(8px);transition:transform .2s ease;}" +
    ".cccdvc-ov.open .cccdvc-modal{transform:none;}" +
    ".cccdvc-frame{width:100%;height:100%;border:0;display:block;background:#fff;}" +
    ".cccdvc-x{position:absolute;top:10px;right:10px;z-index:2;width:34px;height:34px;border:0;border-radius:999px;" +
    "background:rgba(255,255,255,.9);color:#333;font-size:20px;line-height:34px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);}" +
    ".cccdvc-x:hover{background:#fff;}" +
    "@media (max-width:640px){.cccdvc-ov{padding:0;}.cccdvc-modal{width:100%;height:100%;max-width:100%;border-radius:0;}" +
    ".cccdvc-btn{padding:12px 16px;font-size:14px;}}";
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  // --- button --------------------------------------------------------------
  var btn = document.createElement("button");
  btn.className = "cccdvc-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", LABEL);
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 5.5c-2-1.6-5.5-1.8-5.5 1.7 0 2.2 1.2 4 2.2 6.4.6 1.4.8 3.4 2 3.4s1.4-1.3 1.3-2.6c0-.7.5-.7.5 0 0 1.3.1 2.6 1.3 2.6s1.4-2 2-3.4c1-2.4 2.2-4.2 2.2-6.4 0-3.5-3.5-3.3-5.5-1.7Z"/>' +
    "</svg><span></span>";
  btn.querySelector("span").textContent = LABEL; // avoid HTML injection via data-label

  // --- overlay + modal (iframe lazy-loaded on first open) ------------------
  var ov = document.createElement("div");
  ov.className = "cccdvc-ov";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", LABEL);
  ov.innerHTML =
    '<div class="cccdvc-modal"><button class="cccdvc-x" type="button" aria-label="Close">×</button>' +
    '<iframe class="cccdvc-frame" title="' + LABEL + '" allow="clipboard-write" referrerpolicy="strict-origin"></iframe></div>';

  var frame = ov.querySelector(".cccdvc-frame");
  var loaded = false;
  function open() {
    if (!loaded) { frame.src = EMBED; loaded = true; }
    ov.classList.add("open");
    document.documentElement.style.overflow = "hidden";
  }
  function close() {
    ov.classList.remove("open");
    document.documentElement.style.overflow = "";
  }
  btn.addEventListener("click", open);
  ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
  ov.querySelector(".cccdvc-x").addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(ov);
    // auto-open if the host page set ?vc=open or #virtual-consult
    if (/[?&]vc=open\b/.test(location.search) || location.hash === "#virtual-consult") open();
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  // let an existing site button trigger it: <a href="#virtual-consult"> or [data-cccd-vc]
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest('a[href="#virtual-consult"],[data-cccd-vc]');
    if (t) { e.preventDefault(); open(); }
  });
  window.CCCDVirtualConsult = { open: open, close: close };
})();
