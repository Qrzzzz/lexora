import {
  themePresets,
  themeModes,
  generatePalette,
  normalizeHex,
  resolveTheme,
} from "./themes.js";
import { icon } from "./icons.js";

export function renderThemeChoices(root) {
  root.replaceChildren();
  const modes = document.getElementById("theme-modes");
  modes.replaceChildren();
  for (const mode of themeModes) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.appearance = mode.id;
    button.textContent = mode.label;
    modes.append(button);
  }
  for (const [id, preset] of Object.entries(themePresets)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.colorTheme = id;
    button.setAttribute("aria-label", preset.label);
    button.title = preset.label;
    const light = generatePalette(preset.color, "light", preset.monochrome),
      dark = generatePalette(preset.color, "dark", preset.monochrome);
    const swatch = document.createElement("span");
    swatch.className = "theme-swatch";
    swatch.style.setProperty("--swatch-light", light.paper);
    swatch.style.setProperty("--swatch-dark", dark.paper);
    swatch.style.setProperty("--swatch-check", light.accent);
    swatch.append(icon("check"));
    const label = document.createElement("span");
    label.className = "theme-label";
    label.textContent = preset.label;
    button.append(swatch, label);
    root.append(button);
  }
}
export function applyTheme(preferences, systemDark, root = document.body) {
  const theme = resolveTheme(preferences, systemDark);
  root.dataset.theme = theme.id;
  root.dataset.appearance = theme.appearance;
  root.style.colorScheme = theme.appearance;
  document.documentElement.style.colorScheme = theme.appearance;
  for (const [key, value] of Object.entries(theme.tokens))
    root.style.setProperty(`--${key}`, value);
  document.querySelector('meta[name="theme-color"]').content =
    theme.tokens.paper;
  document
    .querySelectorAll("#theme-modes button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        button.dataset.appearance === preferences.appearance,
      ),
    );
  document
    .querySelectorAll("#theme-options button")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        button.dataset.colorTheme === preferences.colorTheme,
      ),
    );
  document
    .getElementById("custom-theme")
    .setAttribute("aria-pressed", preferences.colorTheme === "custom");
  const picker = document.getElementById("custom-color-picker"),
    hex = document.getElementById("custom-color-hex");
  picker.value = preferences.customColor;
  if (document.activeElement !== hex)
    hex.value = preferences.customColor.toUpperCase();
  return theme;
}
export function bindThemeControls(read, commit) {
  let previewing = false;
  const picker = document.getElementById("custom-color-picker"),
    hex = document.getElementById("custom-color-hex"),
    error = document.getElementById("custom-color-error");
  const clearError = () => {
    hex.removeAttribute("aria-invalid");
    error.hidden = true;
  };
  const change = (patch) => {
    clearError();
    commit(patch);
  };
  document
    .querySelectorAll("#theme-modes button")
    .forEach(
      (button) =>
        (button.onclick = () =>
          change({ appearance: button.dataset.appearance })),
    );
  document
    .querySelectorAll("#theme-options button")
    .forEach(
      (button) =>
        (button.onclick = () =>
          change({ colorTheme: button.dataset.colorTheme })),
    );
  document.getElementById("custom-theme").onclick = () =>
    change({ colorTheme: "custom" });
  picker.oninput = () => {
    previewing = true;
    clearError();
    commit({ colorTheme: "custom", customColor: picker.value }, false);
  };
  const finishPicker = () => {
    previewing = false;
    change({ colorTheme: "custom", customColor: picker.value });
  };
  picker.onchange = finishPicker;
  picker.onblur = () => {
    if (previewing) finishPicker();
  };
  const submit = () => {
    const color = normalizeHex(hex.value);
    if (!color) {
      hex.setAttribute("aria-invalid", "true");
      error.hidden = false;
      return;
    }
    change({ colorTheme: "custom", customColor: color });
    hex.value = color.toUpperCase();
  };
  hex.oninput = clearError;
  hex.onchange = submit;
  hex.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape") {
      hex.value = read().customColor.toUpperCase();
      clearError();
    }
  });
}
