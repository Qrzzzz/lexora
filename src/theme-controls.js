import { themeChoices, palettes } from "./themes.js";
import { icon } from "./icons.js";
export function renderThemeChoices(root) {
  root.replaceChildren();
  for (const choice of themeChoices()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.theme = choice.id;
    button.setAttribute("aria-label", choice.label);
    button.title = choice.label;
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    if (choice.id !== "system")
      swatch.style.setProperty(
        "--swatch-fill",
        palettes[choice.id].tokens.paper,
      );
    swatch.append(icon("check"));
    const label = document.createElement("span");
    label.className = "theme-label";
    label.textContent = choice.label;
    button.append(swatch, label);
    root.append(button);
  }
}
