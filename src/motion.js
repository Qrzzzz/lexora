// Port of the supplied prototype's captureWordMotion/playWordMotion.
// Keep the original cut geometry, momentum and timing on desktop AND touch.
// State changes synchronously; new input cancels disposable feedback immediately.
export function createMotion(stage, enabled) {
  let animations = [],
    layer,
    cleanup;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function clear() {
    clearTimeout(cleanup);
    animations.forEach((a) => a.cancel());
    animations = [];
    layer?.remove();
    layer = null;
  }
  function animate(el, frames, options = {}) {
    if (!el || !enabled() || reduced.matches || !el.animate) return;
    const a = el.animate(frames, {
      duration: 280,
      easing: "cubic-bezier(.2,.8,.2,1)",
      fill: "both",
      ...options,
    });
    animations.push(a);
    return a;
  }
  function capture() {
    clear();
    if (!enabled() || reduced.matches || stage.hidden) return null;
    const rect = stage.getBoundingClientRect(),
      word = stage.querySelector(".word,.spelling-answer,.summary h2");
    if (!rect.width || !rect.height) return null;
    const clone = stage.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("motion-clone");
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    clone.inert = true;
    Object.assign(clone.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      minHeight: "0",
      maxHeight: "none",
      flex: "none",
    });
    return { clone, rect, word: word?.getBoundingClientRect() || rect };
  }
  function play(capture, kind = "next", origin) {
    if (!capture || !enabled() || reduced.matches) return;
    const { clone, rect, word } = capture;
    layer = document.createElement("div");
    layer.className = "motion-layer";
    layer.ariaHidden = "true";
    layer.inert = true;
    document.body.append(layer);
    if (kind === "master") {
      const split = word.top - rect.top + word.height * 0.55,
        slant = rect.width * 0.08;
      const lower = clone.cloneNode(true);
      clone.style.clipPath = `polygon(0 0,100% 0,100% ${split - slant}px,0 ${split + slant}px)`;
      lower.style.clipPath = `polygon(0 ${split + slant}px,100% ${split - slant}px,100% 100%,0 100%)`;
      layer.append(clone, lower);
      animate(
        clone,
        [
          { transform: "translate(0,0) rotate(0)", opacity: 1, offset: 0 },
          {
            transform: "translate(-3px,-2px) rotate(-.3deg)",
            opacity: 1,
            offset: 0.14,
          },
          {
            transform: "translate(-180px,-110px) rotate(-9deg)",
            opacity: 0,
            filter: "blur(2px)",
            offset: 1,
          },
        ],
        { duration: 430, easing: "cubic-bezier(.32,0,.18,1)" },
      );
      animate(
        lower,
        [
          { transform: "translate(0,0) rotate(0)", opacity: 1, offset: 0 },
          {
            transform: "translate(4px,3px) rotate(.4deg)",
            opacity: 1,
            offset: 0.14,
          },
          {
            transform: "translate(200px,120px) rotate(8deg)",
            opacity: 0,
            filter: "blur(3px)",
            offset: 1,
          },
        ],
        { duration: 470, easing: "cubic-bezier(.32,0,.18,1)" },
      );
      const slash = document.createElement("i");
      slash.className = "motion-cut";
      Object.assign(slash.style, {
        left: `${word.left - 65}px`,
        top: `${word.top + word.height * 0.55}px`,
        width: `${word.width + 130}px`,
      });
      layer.append(slash);
      animate(
        slash,
        [
          { transform: "rotate(-9deg) scaleX(0)", opacity: 0, offset: 0 },
          { transform: "rotate(-9deg) scaleX(1.03)", opacity: 1, offset: 0.22 },
          { transform: "rotate(-9deg) scaleX(1.12)", opacity: 0, offset: 1 },
        ],
        { duration: 230, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
      // Original narrow fragments, retained verbatim in trajectory and timing.
      for (let i = 0; i < 16; i++) {
        const fragment = document.createElement("i");
        fragment.className = "motion-particle motion-fragment";
        const along = (i / 15 - 0.5) * word.width * 0.88,
          originX = word.left + word.width * 0.5 + along,
          originY = word.top + word.height * 0.55 - along * 0.16;
        Object.assign(fragment.style, {
          left: `${originX}px`,
          top: `${originY}px`,
          width: `${i % 3 === 0 ? 3 : 2}px`,
          height: `${i % 3 === 0 ? 16 : 7}px`,
        });
        layer.append(fragment);
        const direction = i % 2 === 0 ? -1 : 1,
          dx = direction * (35 + (i % 5) * 24),
          dy = direction * (28 + (i % 4) * 22),
          rotation = direction * (35 + i * 19);
        animate(
          fragment,
          [
            {
              transform: "translate(0,0) rotate(-9deg) scaleY(.3)",
              opacity: 0,
              offset: 0,
            },
            {
              transform: `translate(${dx * 0.1}px,${dy * 0.1}px) rotate(-9deg)`,
              opacity: 0.8,
              offset: 0.15,
            },
            {
              transform: `translate(${dx}px,${dy}px) rotate(${rotation}deg) scale(.3)`,
              opacity: 0,
              offset: 1,
            },
          ],
          {
            duration: 320 + (i % 4) * 35,
            delay: 40,
            easing: "cubic-bezier(.2,.7,.3,1)",
          },
        );
      }
      // A small additional square burst follows the same cut, without replacing its feel.
      for (let i = 0; i < 10; i++) {
        const particle = document.createElement("i"),
          size = 2 + (i % 3);
        particle.className = "motion-particle";
        const along = (i / 9 - 0.5) * Math.min(word.width, 380),
          x = word.left + word.width / 2 + along,
          y = word.top + word.height * 0.55 - along * 0.16;
        Object.assign(particle.style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${size}px`,
          height: `${size}px`,
        });
        layer.append(particle);
        const angle = i * 2.39996,
          distance = 22 + (i % 5) * 12,
          dx = Math.cos(angle) * distance,
          dy = Math.sin(angle) * distance;
        animate(
          particle,
          [
            { transform: "translate(0,0) scale(.5)", opacity: 0, offset: 0 },
            {
              transform: `translate(${dx * 0.2}px,${dy * 0.2}px) rotate(15deg)`,
              opacity: 0.5,
              offset: 0.18,
            },
            {
              transform: `translate(${dx}px,${dy + 12}px) rotate(${i % 2 ? 70 : -65}deg) scale(.2)`,
              opacity: 0,
              offset: 1,
            },
          ],
          { duration: 340 + (i % 4) * 35, delay: 30 },
        );
      }
      animate(
        layer,
        [
          { transform: "translate(0,0)" },
          { transform: "translate(-4px,2px)" },
          { transform: "translate(3px,-1px)" },
          { transform: "translate(-1px,0)" },
          { transform: "translate(0,0)" },
        ],
        { duration: 140, delay: 45, easing: "ease-out" },
      );
      animate(
        stage,
        [
          {
            transform: "translateY(18px) scale(.975)",
            opacity: 0,
            filter: "blur(3px)",
          },
          {
            transform: "translateY(0) scale(1)",
            opacity: 1,
            filter: "blur(0)",
          },
        ],
        { duration: 300, delay: 145 },
      );
    } else {
      layer.append(clone);
      const direction = kind === "undo" ? -1 : 1,
        distance = Math.min(innerWidth * 0.7, 900);
      animate(
        clone,
        [
          { transform: "translateX(0)", opacity: 1 },
          { transform: `translateX(${-direction * distance}px)`, opacity: 0 },
        ],
        { duration: 170, easing: "cubic-bezier(.3,.6,.45,1)" },
      );
      let frames = [
        {
          transform: `translateX(${direction * Math.min(distance * 0.35, 280)}px)`,
          opacity: 0,
        },
        { transform: "translateX(0)", opacity: 1 },
      ];
      if (kind === "history" && origin) {
        const center = origin.left + origin.width / 2,
          target = rect.left + rect.width / 2;
        frames = [
          {
            opacity: 0,
            transform: `translate(${Math.max(-90, Math.min(90, (center - target) * 0.15))}px,9px) scale(.985)`,
            filter: "blur(2px)",
          },
          {
            opacity: 1,
            transform: "translate(0,0) scale(1)",
            filter: "blur(0)",
          },
        ];
      }
      animate(stage, frames, {
        duration: kind === "history" ? 300 : 230,
        delay: 85,
        easing: "cubic-bezier(.16,1,.3,1)",
      });
    }
    cleanup = setTimeout(clear, 650);
  }
  function enter(element) {
    clear();
    animate(
      element,
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 330 },
    );
    cleanup = setTimeout(clear, 400);
  }
  function reveal(element) {
    animate(
      element,
      [
        { opacity: 0, transform: "translateY(5px)", filter: "blur(1px)" },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
      ],
      { duration: 240 },
    );
    cleanup = setTimeout(clear, 320);
  }
  function history(list, previous) {
    for (const entry of list.children) {
      const old = previous.get(entry.dataset.eventId),
        rect = entry.getBoundingClientRect();
      const opacity = Number(entry.style.getPropertyValue("--history-opacity")),
        blur = entry.style.getPropertyValue("--history-blur");
      if (
        old &&
        old.opacity === opacity &&
        Math.abs(old.rect.top - rect.top) < 1 &&
        Math.abs(old.rect.left - rect.left) < 1
      )
        continue;
      animate(
        entry,
        [
          {
            transform: old
              ? `translate(${old.rect.left - rect.left}px,${old.rect.top - rect.top}px)`
              : "translateY(12px)",
            opacity: old?.opacity || 0,
            filter: old?.filter || "blur(1px)",
          },
          { transform: "translate(0,0)", opacity, filter: `blur(${blur})` },
        ],
        { duration: 430 },
      );
    }
    cleanup = setTimeout(clear, 650);
  }
  reduced.addEventListener("change", clear);
  return { clear, capture, play, enter, reveal, history };
}
