const sprite = new URL("../assets/icons/lucide.svg", import.meta.url);
const version = new URL(import.meta.url).searchParams.get("v");
if (version) sprite.searchParams.set("v", version);
const ns = "http://www.w3.org/2000/svg";
export function icon(name) {
  const svg = document.createElementNS(ns, "svg");
  svg.classList.add("icon");
  svg.dataset.lucide = name;
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(ns, "use");
  use.setAttribute("href", `${sprite.href}#${name}`);
  svg.append(use);
  return svg;
}
export function renderIcons(root) {
  const placeholders = [
    ...(root.matches("[data-icon]") ? [root] : []),
    ...root.querySelectorAll("[data-icon]"),
  ];
  for (const node of placeholders) node.replaceWith(icon(node.dataset.icon));
}
