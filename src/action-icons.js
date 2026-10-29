import { icon } from "./icons.js";
export function actionIcon(kind) {
  const name = { keep: "check", hint: "lightbulb", next: "arrow-right" }[kind];
  const svg = icon(name),
    ns = "http://www.w3.org/2000/svg";
  svg.classList.add("study-icon");
  svg.setAttribute("viewBox", "0 0 32 32");
  const outline = document.createElementNS(ns, "g");
  outline.classList.add("action-outline");
  const use = svg.firstChild;
  use.setAttribute("width", "24");
  use.setAttribute("height", "24");
  outline.append(use);
  const fill = document.createElementNS(ns, "path");
  fill.classList.add("action-fill");
  fill.setAttribute("stroke", "none");
  fill.setAttribute(
    "d",
    {
      keep: "M4.2 12.5 8.9 16.7 18.6 6.6 21 8.6 9.1 20.8 1.8 14.9Z",
      hint: "M9.1 15.4C8.7 13.1 7 12.2 7 9.3a5 5 0 0 1 10 0c0 2.9-1.7 3.8-2.1 6.1Z",
      next: "M4 10.1h10.2l-3.1-3.2 2.4-2.1 7.6 7.2-7.6 7.2-2.4-2.1 3.1-3.2H4Z",
    }[kind],
  );
  svg.append(fill, outline);
  return svg;
}
