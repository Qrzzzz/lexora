import { icon, renderIcons } from "./icons.js";
// Text-weight and ink feedback borrow the document site's marker treatment.
export function installControlFeedback({ onInteraction, motionEnabled }) {
  const selector = "button,select,a[href]";
  const timers = new WeakMap();
  function prepare(root) {
    if (!(root instanceof Element)) return;
    if (
      root.closest(
        ".word-motion-layer,.motion-layer,.square-particle-layer,.site-loading",
      )
    )
      return;
    renderIcons(root);
    const targets = [
      ...(root.matches(selector) ? [root] : []),
      ...root.querySelectorAll(selector),
    ];
    for (const el of targets) {
      if (el.closest(".word-motion-layer,.motion-layer,.site-loading"))
        continue;
      if (el.tagName === "SELECT") {
        if (!el.parentElement.classList.contains("select-control")) {
          const wrap = document.createElement("span");
          wrap.className = "select-control";
          el.before(wrap);
          wrap.append(el, icon("chevron-down"));
        }
        continue;
      }
      el.classList.add("ui-control");
      if (
        el.matches("[role=switch]") ||
        el.querySelector(":scope > .control-label")
      )
        continue;
      const label = document.createElement("span");
      label.className = "control-label";
      const content = [...el.childNodes].filter(
        (node) =>
          !(node instanceof SVGElement && node.classList.contains("icon")),
      );
      if (
        !content.some(
          (node) =>
            node.textContent.trim() ||
            (node instanceof Element && node.children.length),
        )
      ) {
        el.classList.add("icon-only");
        continue;
      }
      label.append(...content);
      el.append(label);
    }
  }
  prepare(document.body);
  new MutationObserver((records) =>
    records.forEach((r) => {
      prepare(r.target);
      r.addedNodes.forEach(prepare);
    }),
  ).observe(document.body, { childList: true, subtree: true });
  const target = (e) =>
    e.target instanceof Element ? e.target.closest(selector) : null;
  function press(el) {
    if (!el || el.disabled) return;
    el.classList.add("is-pressed");
  }
  function release(el) {
    el?.classList.remove("is-pressed");
  }
  document.addEventListener("pointerdown", (e) => press(target(e)), {
    passive: true,
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    document.addEventListener(
      type,
      () => document.querySelectorAll(".is-pressed").forEach(release),
      { passive: true },
    );
  document.addEventListener("keydown", (e) => {
    if (["Enter", " "].includes(e.key) && !e.repeat) press(target(e));
  });
  document.addEventListener("keyup", (e) => release(target(e)));
  window.addEventListener("blur", () =>
    document.querySelectorAll(".is-pressed").forEach(release),
  );
  document.addEventListener("click", (e) => {
    const el = target(e);
    if (!el || el.disabled) return;
    release(el);
    clearTimeout(timers.get(el));
    el.classList.remove("is-feedback");
    if (motionEnabled()) {
      void el.offsetWidth;
      el.classList.add("is-feedback");
      timers.set(
        el,
        setTimeout(() => el.classList.remove("is-feedback"), 550),
      );
    }
    if (!el.closest("#again,#master,#undo,#reveal")) onInteraction(el);
  });
  document.addEventListener("change", (e) => {
    if (e.target instanceof HTMLSelectElement) onInteraction(e.target);
  });
  // The label area of an inline switch is a usable touch target too.
  document.querySelectorAll(".setting-row").forEach((row) =>
    row.addEventListener("click", (e) => {
      if (e.target.closest("button,a,input,select")) return;
      row.querySelector("[role=switch]")?.click();
    }),
  );
}
