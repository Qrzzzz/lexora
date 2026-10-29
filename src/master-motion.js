function cleanClone(stage, rect) {
  const clone = stage.cloneNode(true);
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
  clone
    .querySelectorAll(".is-feedback,.is-pressed")
    .forEach((e) => e.classList.remove("is-feedback", "is-pressed"));
  clone.inert = true;
  Object.assign(clone.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    padding: "0",
    opacity: "0",
    visibility: "visible",
    minHeight: "0",
  });
  return clone;
}
export function memoryTransition(stage, capture, reverse, animate) {
  const host = document.createElement("div");
  host.className = `word-motion-layer ${reverse ? "memory-rejoin" : "memory-release"}`;
  host.inert = true;
  host.setAttribute("aria-hidden", "true");
  document.body.append(host);
  const pending = [];
  const run = (el, frames, options) => {
    const a = animate(el, frames, options);
    if (a) pending.push(a.finished.catch(() => {}));
    return a;
  };
  const rect = reverse ? stage.getBoundingClientRect() : capture.rect;
  const word = reverse
    ? stage.querySelector(".word")?.getBoundingClientRect()
    : capture.word;
  if (!word) {
    host.remove();
    return null;
  }
  const upper = reverse ? cleanClone(stage, rect) : capture.clone;
  upper.style.opacity = "0";
  const lower = upper.cloneNode(true);
  const split = word.top - rect.top + word.height * 0.55,
    slant = rect.width * 0.08;
  upper.style.clipPath = `polygon(0 0,100% 0,100% ${split - slant}px,0 ${split + slant}px)`;
  lower.style.clipPath = `polygon(0 ${split + slant}px,100% ${split - slant}px,100% 100%,0 100%)`;
  host.append(upper, lower);
  const up = [
    {
      transform: "translate(0,0) rotate(0) scale(1)",
      filter: "blur(0px)",
      opacity: 1,
      offset: 0,
    },
    {
      transform: "translate(-3px,-2px) rotate(-.3deg)",
      opacity: 1,
      filter: "blur(0px)",
      offset: 0.28,
    },
    {
      transform: "translate(-180px,-110px) rotate(-9deg) scale(1.045)",
      filter: "blur(3px)",
      opacity: 0,
      offset: 1,
    },
  ];
  const down = [
    {
      transform: "translate(0,0) rotate(0) scale(1)",
      filter: "blur(0px)",
      opacity: 1,
      offset: 0,
    },
    {
      transform: "translate(4px,3px) rotate(.4deg)",
      filter: "blur(0px)",
      opacity: 1,
      offset: 0.28,
    },
    {
      transform: "translate(200px,120px) rotate(8deg) scale(1.045)",
      filter: "blur(3px)",
      opacity: 0,
      offset: 1,
    },
  ];
  if (reverse) {
    stage.style.visibility = "hidden";
    const outgoing = capture.clone;
    outgoing.style.opacity = "0";
    host.append(outgoing);
    run(
      outgoing,
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-14px)" },
      ],
      { duration: 140 },
    );
    const invert = (frames) =>
      [...frames].reverse().map((f) => ({ ...f, offset: 1 - f.offset }));
    run(upper, invert(up), {
      duration: 500,
      delay: 100,
      easing: "cubic-bezier(.16,1,.3,1)",
    });
    run(lower, invert(down), {
      duration: 500,
      delay: 100,
      easing: "cubic-bezier(.16,1,.3,1)",
    });
    for (let i = 0; i < 16; i++) {
      const chip = document.createElement("i"),
        along = (i / 15 - 0.5) * word.width * 0.88,
        side = i % 2 ? -1 : 1;
      chip.className = "word-fragment";
      chip.style.cssText = `opacity:0;left:${word.left + word.width * 0.5 + along}px;top:${word.top + word.height * 0.55 - along * 0.16}px;width:3px;height:3px`;
      host.append(chip);
      run(
        chip,
        [
          {
            opacity: 0,
            transform: `translate(${side * (40 + (i % 5) * 20)}px,${side * (30 + (i % 4) * 18)}px) scale(.2)`,
          },
          { opacity: 0.65, offset: 0.65 },
          { opacity: 0, transform: "translate(0,0) scale(.5)" },
        ],
        { duration: 360, delay: 110, easing: "cubic-bezier(.16,1,.3,1)" },
      );
    }
  } else {
    run(upper, up, { duration: 480, easing: "cubic-bezier(.32,0,.18,1)" });
    run(lower, down, { duration: 520, easing: "cubic-bezier(.32,0,.18,1)" });
    const slash = document.createElement("i");
    slash.className = "word-slash";
    slash.style.cssText = `opacity:0;left:${word.left - 65}px;top:${word.top + word.height * 0.55}px;width:${word.width + 130}px`;
    host.append(slash);
    run(
      slash,
      [
        {
          transform: "rotate(-9deg)",
          clipPath: "inset(0 0 0 100%)",
          opacity: 0,
          offset: 0,
        },
        {
          transform: "rotate(-9deg)",
          clipPath: "inset(0 0 0 97%)",
          opacity: 1,
          offset: 0.05,
        },
        {
          transform: "rotate(-9deg)",
          clipPath: "inset(0 0 0 0%)",
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: "rotate(-9deg)",
          clipPath: "inset(0 0 0 0%)",
          opacity: 0.8,
          offset: 0.72,
        },
        {
          transform: "rotate(-9deg)",
          clipPath: "inset(0 0 0 0%)",
          opacity: 0,
          offset: 1,
        },
      ],
      { duration: 340, easing: "linear" },
    );
    for (let i = 0; i < 16; i++) {
      const chip = document.createElement("i"),
        along = (i / 15 - 0.5) * word.width * 0.88,
        side = i % 2 ? -1 : 1;
      chip.className = "word-fragment";
      chip.style.cssText = `opacity:0;left:${word.left + word.width * 0.5 + along}px;top:${word.top + word.height * 0.55 - along * 0.16}px;width:2px;height:${i % 3 ? 7 : 14}px`;
      host.append(chip);
      run(
        chip,
        [
          { opacity: 0, transform: "scale(.4)", filter: "blur(0px)" },
          {
            opacity: 0.7,
            transform: "scale(1.2)",
            filter: "blur(0px)",
            offset: 0.2,
          },
          {
            opacity: 0,
            transform: `translate(${side * (40 + (i % 5) * 20)}px,${side * (30 + (i % 4) * 18)}px) rotate(${side * (40 + i * 17)}deg) scale(1.1)`,
            filter: "blur(1.5px)",
          },
        ],
        {
          duration: 390 + (i % 4) * 30,
          delay: 70,
          easing: "cubic-bezier(.2,.7,.3,1)",
        },
      );
    }
    run(
      stage,
      [
        { opacity: 0, transform: "translateY(20px) scale(.975)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 300, delay: 210, easing: "cubic-bezier(.16,1,.3,1)" },
    );
  }
  return { host, finished: Promise.all(pending) };
}
