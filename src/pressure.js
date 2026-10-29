// Native adaptation of React Bits Text Pressure's distance/weight response.
// https://github.com/DavidHDev/react-bits/tree/main/src/content/TextAnimations/TextPressure
// Source Han Serif provides wght only; keep widths fixed and add no font/runtime.
export function createTextPressure(stage, enabled) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let word,
    letters = [],
    raf = 0,
    active = false,
    x = 0,
    y = 0;
  function reset() {
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    for (const letter of letters) {
      letter.style.fontVariationSettings = '"wght" 900';
      letter.style.color = "";
    }
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
    for (const char of Array.from(text)) {
      range.setStart(textNode, offset);
      range.setEnd(textNode, offset + char.length);
      const width = range.getBoundingClientRect().width;
      const span = document.createElement("span");
      span.className = "pressure-letter";
      span.textContent = char;
      span.ariaHidden = "true";
      if (width > 0) span.style.width = `${width}px`;
      label.append(span);
      letters.push(span);
      offset += char.length;
    }
    word.replaceChildren(label);
  }
  function paint() {
    raf = 0;
    if (
      !active ||
      !word?.isConnected ||
      !enabled() ||
      !fine.matches ||
      reduced.matches
    ) {
      reset();
      return;
    }
    const rect = word.getBoundingClientRect(),
      radius = Math.max(rect.width * 0.55, 80);
    for (const letter of letters) {
      const b = letter.getBoundingClientRect();
      const p = Math.max(
        0,
        1 -
          Math.hypot(x - b.left - b.width / 2, y - b.top - b.height / 2) /
            radius,
      );
      letter.style.fontVariationSettings = `"wght" ${Math.round(620 + 280 * p)}`;
      letter.style.color = `color-mix(in srgb, var(--accent) ${Math.round(p * 34)}%, var(--ink))`;
    }
  }
  stage.addEventListener(
    "pointermove",
    (event) => {
      if (
        !word ||
        !word.contains(event.target) ||
        !fine.matches ||
        reduced.matches ||
        !enabled()
      ) {
        reset();
        return;
      }
      active = true;
      x = event.clientX;
      y = event.clientY;
      if (!raf) raf = requestAnimationFrame(paint);
    },
    { passive: true },
  );
  stage.addEventListener("pointerleave", reset);
  reduced.addEventListener("change", reset);
  fine.addEventListener("change", reset);
  return { attach, reset };
}
