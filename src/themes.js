// Single source of truth: add a palette here to expose it throughout the app.
export const palettes = {
  white: {
    label: "浅蓝白",
    scheme: "light",
    tokens: {
      paper: "#eef2f3",
      surface: "#f6f8fa",
      ink: "#172439",
      meaning: "#566580",
      muted: "#596984",
      line: "#d2d9e2",
      "line-strong": "#a3b1c5",
      wash: "#e4eaf0",
      accent: "#243ecd",
      "accent-soft": "rgba(36,62,205,.06)",
      "control-ink": "rgba(36,62,205,.18)",
      error: "#9b493c",
      "action-keep": "#67bd91",
      "action-hint": "#f5cd38",
      "action-next": "#719cf3",
      "qr-paper": "#ffffff",
      "qr-ink": "#172439",
    },
  },
  night: {
    label: "深蓝",
    scheme: "dark",
    tokens: {
      paper: "#151d37",
      surface: "#1d2844",
      ink: "#f0f4ff",
      meaning: "#a6b0cd",
      muted: "#a6b0cd",
      line: "#303b58",
      "line-strong": "#536487",
      wash: "#1d2844",
      accent: "#a7bcff",
      "accent-soft": "rgba(167,188,255,.12)",
      "control-ink": "rgba(167,188,255,.26)",
      error: "#e5a08c",
      "action-keep": "#75d5a3",
      "action-hint": "#ffd83e",
      "action-next": "#83abff",
      "qr-paper": "#ffffff",
      "qr-ink": "#172439",
    },
  },
};
export const themeChoices = () => [
  { id: "system", label: "随系统" },
  ...Object.entries(palettes).map(([id, p]) => ({ id, label: p.label })),
];
export const isThemeChoice = (id) =>
  id === "system" || Object.hasOwn(palettes, id);
export function resolveTheme(choice, dark) {
  return choice === "system" ? (dark ? "night" : "white") : choice;
}
export function themeStylesheet() {
  const variables = (p) =>
    `color-scheme:${p.scheme};${Object.entries(p.tokens)
      .map(([key, value]) => `--${key}:${value};`)
      .join("")}`;
  const previews = Object.entries(palettes)
    .map(([id, p]) => `--preview-${id}:${p.tokens.paper};`)
    .join("");
  return `/* Generated from src/themes.js. Run npm run themes after palette changes. */\n:root{${variables(palettes.white)}${previews}}\n${Object.entries(
    palettes,
  )
    .map(([id, p]) => `body[data-theme="${id}"]{${variables(p)}}`)
    .join(
      "\n",
    )}\n@media(prefers-color-scheme:dark){body[data-theme="system"]{${variables(palettes.night)}}}\n`;
}
