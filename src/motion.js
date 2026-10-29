import { createOriginalWordMotion } from "./original-word-motion.js";

// New interface motion is kept separate from the immutable original word engine.
export function createMotion(stage, enabled, current) {
  const original = createOriginalWordMotion({
    $: (id) =>
      ["word-stage", "summary-view"].includes(id)
        ? stage
        : document.getElementById(id),
    current,
  });
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Set();
  let layer;
  const allowed = () => enabled() && !reduced.matches;
  function clear() {
    original.stop();
    for (const a of animations) a.cancel();
    animations.clear();
    layer?.remove();
    layer = null;
  }
  function animate(el, frames, options = {}) {
    if (!el || !allowed()) return;
    const a = el.animate(frames, {
      duration: 260,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "both",
      ...options,
    });
    animations.add(a);
    const done = () => {
      animations.delete(a);
      a.cancel();
    };
    a.finished.then(done, done);
    return a;
  }
  function capture(kind) {
    clear();
    if (!allowed()) return null;
    if (kind === "master" || kind === "next")
      return {
        original: original.capture(kind === "master" ? "kill" : "again"),
      };
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const clone = stage.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    clone.inert = true;
    Object.assign(clone.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      minHeight: "0",
      padding: "0",
      margin: "0",
    });
    return { clone, rect };
  }
  function play(capture, kind) {
    if (!capture || !allowed()) return;
    if (Object.hasOwn(capture, "original")) {
      original.play(capture.original);
      return;
    }
    layer = document.createElement("div");
    layer.className = "motion-layer";
    layer.inert = true;
    layer.ariaHidden = "true";
    layer.append(capture.clone);
    document.body.append(layer);
    const direction = kind === "undo" ? -1 : 1;
    animate(
      capture.clone,
      [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0, transform: `translateX(${-direction * 45}px)` },
      ],
      { duration: 180 },
    );
    const entering = animate(
      stage,
      [
        { opacity: 0, transform: `translateX(${direction * 38}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 270, delay: 40 },
    );
    const activeLayer = layer;
    entering?.finished.then(
      () => activeLayer.remove(),
      () => activeLayer.remove(),
    );
  }
  function enter(el, { axis = "y", direction = 1, distance = 14 } = {}) {
    animate(
      el,
      [
        {
          opacity: 0,
          transform:
            axis === "none"
              ? "none"
              : `translate${axis.toUpperCase()}(${distance * direction}px)`,
        },
        { opacity: 1, transform: "none" },
      ],
      { duration: 240 },
    );
  }
  function reveal(el) {
    animate(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  }
  function history(list, previous) {
    for (const entry of list.children) {
      const old = previous.get(entry.dataset.eventId),
        rect = entry.getBoundingClientRect();
      const opacity = Number(entry.style.getPropertyValue("--history-opacity"));
      if (
        old &&
        old.opacity === opacity &&
        Math.abs(old.rect.left - rect.left) < 1 &&
        Math.abs(old.rect.top - rect.top) < 1
      )
        continue;
      animate(
        entry,
        [
          {
            transform: old
              ? `translate(${old.rect.left - rect.left}px,${old.rect.top - rect.top}px)`
              : "translateY(10px)",
            opacity: old?.opacity || 0,
          },
          { transform: "none", opacity },
        ],
        { duration: 300 },
      );
    }
  }
  reduced.addEventListener("change", clear);
  return { clear, capture, play, enter, reveal, history };
}
