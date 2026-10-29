import { createOriginalWordMotion } from "./original-word-motion.js";
import { memoryTransition } from "./master-motion.js";

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
  let particles;
  let layer;
  let epoch = 0;
  const allowed = () => enabled() && !reduced.matches;
  function clear() {
    epoch++;
    stage.style.visibility = "";
    original.stop();
    for (const a of animations) a.cancel();
    animations.clear();
    layer?.remove();
    layer = null;
    particles?.remove();
    particles = null;
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
      opacity: "0",
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
    if (kind === "update") {
      capture.clone?.remove();
      reveal(stage);
      return;
    }
    if (Object.hasOwn(capture, "original")) {
      if (kind === "master" && capture.original) {
        playMemory(capture.original, false);
        burst(capture.original.word);
      } else original.play(capture.original);
      return;
    }
    if (kind === "restore") {
      if (playMemory(capture, true)) return;
    }
    layer = document.createElement("div");
    layer.className = "motion-layer";
    layer.inert = true;
    layer.ariaHidden = "true";
    layer.append(capture.clone);
    document.body.append(layer);
    const direction = kind === "previous" || kind === "undo" ? -1 : 1;
    const outgoing = animate(
      capture.clone,
      [
        { opacity: 1, transform: "translateX(0)" },
        {
          opacity: 0,
          transform: `translateX(${-direction * Math.min(innerWidth * 0.3, 320)}px)`,
        },
      ],
      { duration: 180 },
    );
    outgoing?.finished.then(
      () => capture.clone.remove(),
      () => capture.clone.remove(),
    );
    const entering = animate(
      stage,
      [
        {
          opacity: 0,
          transform: `translateX(${direction * Math.min(innerWidth * 0.2, 220)}px)`,
        },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 300, delay: 100 },
    );
    const activeLayer = layer;
    entering?.finished.then(
      () => activeLayer.remove(),
      () => activeLayer.remove(),
    );
  }
  function playMemory(capture, reverse) {
    const token = epoch;
    const result = memoryTransition(stage, capture, reverse, animate);
    if (!result) return false;
    layer = result.host;
    result.finished.then(() => {
      result.host.remove();
      if (token === epoch) {
        stage.style.visibility = "";
        if (
          reverse &&
          [document.body, stage, document.getElementById("undo")].includes(
            document.activeElement,
          )
        )
          stage.focus({ preventScroll: true });
      }
    });
    return true;
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
  function burst(word) {
    // Small square ink chips follow the existing slash. The original split,
    // fragments, timing and incoming word animation remain untouched.
    const host = document.createElement("div");
    host.className = "square-particle-layer";
    host.inert = true;
    host.setAttribute("aria-hidden", "true");
    document.body.append(host);
    particles = host;
    const finished = [];
    for (let i = 0; i < 24; i++) {
      const chip = document.createElement("i");
      const along = (i / 23 - 0.5) * word.width * 0.9;
      const side = i % 2 ? 1 : -1;
      const dx = side * (30 + (i % 5) * 13);
      const dy = side * (22 + (i % 4) * 12);
      const size = [4, 6, 4, 7, 5][i % 5];
      chip.className = "square-particle";
      Object.assign(chip.style, {
        left: `${word.left + word.width * 0.5 + along}px`,
        top: `${word.top + word.height * 0.55 - along * 0.16}px`,
        width: `${size}px`,
        height: `${size}px`,
      });
      host.append(chip);
      const animation = animate(
        chip,
        [
          { transform: "translate(0,0) rotate(-9deg) scale(.25)", opacity: 0 },
          {
            transform: `translate(${dx * 0.2}px,${dy * 0.2}px) rotate(${side * 18}deg) scale(1)`,
            opacity: 0.94,
            offset: 0.2,
          },
          {
            transform: `translate(${dx * 0.68}px,${dy * 0.64 + 5}px) rotate(${side * (35 + i * 7)}deg) scale(.85)`,
            opacity: 0.8,
            offset: 0.55,
          },
          {
            transform: `translate(${dx}px,${dy + 14}px) rotate(${side * (55 + i * 11)}deg) scale(.2)`,
            opacity: 0,
          },
        ],
        {
          duration: 320 + (i % 4) * 30,
          delay: 20 + (1 - i / 23) * 70 + (i % 3) * 5,
          easing: "cubic-bezier(.18,.7,.28,1)",
        },
      );
      if (animation)
        finished.push(
          animation.finished.then(
            () => chip.remove(),
            () => chip.remove(),
          ),
        );
    }
    Promise.all(finished).then(() => host.remove());
  }
  function captureHistory(list) {
    return new Map(
      [...list.children].map((entry) => {
        const style = getComputedStyle(entry);
        return [
          entry.dataset.eventId,
          {
            rect: entry.getBoundingClientRect(),
            opacity: Number(style.opacity),
            wordShadow: getComputedStyle(entry.querySelector(".history-word"))
              .textShadow,
            summaryShadow: entry.querySelector(".history-summary-text")
              ? getComputedStyle(entry.querySelector(".history-summary-text"))
                  .textShadow
              : undefined,
          },
        ];
      }),
    );
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
              : `translateY(${rect.height + 20}px)`,
            opacity: old?.opacity ?? 0,
          },
          { transform: "none", opacity },
        ],
        { duration: 420, easing: "cubic-bezier(.16,1,.3,1)" },
      );
      for (const [selector, key] of [
        [".history-word", "wordShadow"],
        [".history-summary-text", "summaryShadow"],
      ]) {
        const text = entry.querySelector(selector);
        if (!text) continue;
        const target = getComputedStyle(text).textShadow;
        const previousShadow = old?.[key];
        if (!previousShadow || target === "none" || previousShadow === target)
          continue;
        const from =
          previousShadow === "none"
            ? `0px 0px 0px ${getComputedStyle(entry).getPropertyValue("--history-text-color").trim()}`
            : previousShadow;
        animate(text, [{ textShadow: from }, { textShadow: target }], {
          duration: 420,
          easing: "cubic-bezier(.16,1,.3,1)",
        });
      }
    }
  }
  reduced.addEventListener("change", clear);
  return { clear, capture, play, enter, reveal, history, captureHistory };
}
