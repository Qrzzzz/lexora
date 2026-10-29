// Native adaptation of React Bits Text Pressure's distance/weight response.
// https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/TextPressure
// Source Han Serif provides wght only; keep widths fixed and add no font/runtime.
export function createTextPressure(stage, enabled) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let word,
    letters = [],
    raf = 0,
    lastFrame = 0;
  function reset() {
    cancelAnimationFrame(raf);
    raf = 0;
    lastFrame = 0;
    for (const letter of letters) {
      letter.current = letter.target = 0;
      letter.element.style.fontVariationSettings = "";
      letter.element.style.color = "";
    }
  }
  function wake() {
    if (!raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(paint);
    }
  }
  function release() {
    for (const letter of letters) letter.target = 0;
    if (letters.some((letter) => letter.current > 0)) wake();
  }
  function attach(button, fontsResolved = false) {
    reset();
    word = button;
    letters = [];
    if (!word) return;
    if (
      !fontsResolved &&
      !document.fonts.check('900 32px "Source Han Serif"')
    ) {
      document.fonts.ready
        .then(() =>
          Promise.allSettled(stage.getAnimations().map((a) => a.finished)),
        )
        .then(() => {
          if (word === button && button.isConnected) attach(button, true);
        });
      return;
    }
    const text = word.textContent;
    word.setAttribute("aria-label", `查看「${text}」词条`);
    // Explicit feedback label keeps the control preparer from wrapping glyphs.
    const label = document.createElement("span");
    label.className = "control-label pressure-word";
    const range = document.createRange();
    word.replaceChildren(document.createTextNode(text));
    const textNode = word.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
    let offset = 0;
    const fontSize = parseFloat(getComputedStyle(word).fontSize);
    for (const char of Array.from(text)) {
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + char.length);
      const width = range.getBoundingClientRect().width;
      const span = document.createElement("span");
      span.className = "pressure-letter";
      span.textContent = char;
      span.ariaHidden = "true";
      if (width > 0 && fontSize > 0) span.style.width = `${width / fontSize}em`;
      label.append(span);
      letters.push({ element: span, current: 0, target: 0 });
      offset += char.length;
    }
    word.replaceChildren(label);
  }
  function paint(now) {
    raf = 0;
    if (!word?.isConnected || !enabled() || !fine.matches || reduced.matches) {
      reset();
      return;
    }
    const elapsed = lastFrame ? Math.min(now - lastFrame, 48) : 1000 / 60;
    lastFrame = now;
    let moving = false;
    for (const letter of letters) {
      if (letter.current === letter.target) continue;
      // First-order damping has no overshoot; release only the local footprint.
      const tau = letter.target > letter.current ? 55 : 110;
      letter.current +=
        (letter.target - letter.current) * (1 - Math.exp(-elapsed / tau));
      if (Math.abs(letter.target - letter.current) < 0.001)
        letter.current = letter.target;
      else moving = true;
      if (letter.current === 0) {
        letter.element.style.fontVariationSettings = "";
        letter.element.style.color = "";
      } else {
        letter.element.style.fontVariationSettings = `"wght" ${Math.round(900 - 540 * letter.current)}`;
        letter.element.style.color = `color-mix(in srgb, var(--accent) ${Math.round(letter.current * 42)}%, var(--ink))`;
      }
    }
    if (moving) raf = requestAnimationFrame(paint);
    else lastFrame = 0;
  }
  stage.addEventListener(
    "pointermove",
    (event) => {
      if (
        !word ||
        !word.contains(event.target) ||
        event.pointerType === "touch" ||
        !fine.matches ||
        reduced.matches ||
        !enabled()
      ) {
        release();
        return;
      }
      const rect = word.getBoundingClientRect(),
        fontSize = parseFloat(getComputedStyle(word).fontSize),
        radius = Math.max(1, Math.min(fontSize * 0.65, rect.width * 0.24));
      for (const letter of letters) {
        const b = letter.element.getBoundingClientRect(),
          distance = Math.hypot(
            (event.clientX - b.left - b.width / 2) / radius,
            (event.clientY - b.top - b.height / 2) /
              Math.max(fontSize * 0.8, b.height * 0.6),
          ),
          p = Math.max(0, 1 - distance);
        // Compact smoothstep: both pressure and its slope vanish at the edge.
        letter.target = p * p * (3 - 2 * p);
      }
      wake();
    },
    { passive: true },
  );
  stage.addEventListener("pointerleave", release);
  window.addEventListener("blur", release);
  window.addEventListener("resize", release);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) reset();
  });
  reduced.addEventListener("change", reset);
  fine.addEventListener("change", reset);
  return { attach, reset };
}
