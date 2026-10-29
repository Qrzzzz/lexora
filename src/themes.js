// Each preset is one seed, not a separately maintained light/dark palette.
// OKLab conversions: https://www.w3.org/TR/css-color-4/#color-conversion-code
export const themePresets = {
  blue: { label: "蓝色", color: "#243ecd" },
  red: { label: "绛红", color: "#b43b53" },
  green: { label: "松绿", color: "#387d62" },
  earth: { label: "大地", color: "#987345" },
  purple: { label: "雾紫", color: "#8061aa" },
  mono: { label: "黑白", color: "#000000", monochrome: true },
};
export const themeModes = [
  { id: "system", label: "随系统" },
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
];
export const THEME_DEFAULTS = {
  appearance: "system",
  colorTheme: "blue",
  customColor: "#243ecd",
};
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  const hex = input.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex))
    return (
      "#" +
      [...hex]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  return /^[\da-f]{6}$/i.test(hex) ? "#" + hex.toLowerCase() : null;
}
export const isColorTheme = (id) =>
  typeof id === "string" &&
  (id === "custom" || Object.hasOwn(themePresets, id));
export function normalizeThemePreferences(prefs) {
  if (
    ["appearance", "colorTheme", "customColor"].some((key) =>
      Object.hasOwn(prefs, key),
    )
  ) {
    const customColor = normalizeHex(prefs.customColor);
    if (
      !themeModes.some((m) => m.id === prefs.appearance) ||
      !isColorTheme(prefs.colorTheme) ||
      !customColor
    )
      return null;
    return {
      appearance: prefs.appearance,
      colorTheme: prefs.colorTheme,
      customColor,
    };
  }
  if (!["system", "white", "night", "paper", "mist"].includes(prefs.theme))
    return null;
  return {
    ...THEME_DEFAULTS,
    appearance:
      prefs.theme === "white"
        ? "light"
        : prefs.theme === "night"
          ? "dark"
          : "system",
  };
}
const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const rgb = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gamma = (v) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
const hexRGB = (values) =>
  "#" +
  values
    .map((v) =>
      Math.round(clamp(v) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
function toLCH(hex) {
  const [r, g, b] = rgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}
function linearRGB(L, C, h) {
  const a = C * Math.cos(h),
    b = C * Math.sin(h),
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function tone(L, C, h) {
  // Reduce chroma instead of clipping individual RGB channels (preserves hue).
  let values = linearRGB(L, C, h);
  if (values.some((v) => v < -0.000001 || v > 1.000001)) {
    let lo = 0,
      hi = C;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2,
        trial = linearRGB(L, mid, h);
      if (trial.every((v) => v >= 0 && v <= 1)) lo = mid;
      else hi = mid;
    }
    values = linearRGB(L, lo, h);
  }
  return hexRGB(values.map(gamma));
}
export function contrastRatio(first, second) {
  const luminance = (hex) =>
    rgb(hex)
      .map(linear)
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
const alpha = (hex, a) =>
  `rgba(${rgb(hex)
    .map((v) => Math.round(v * 255))
    .join(",")},${a})`;
export function generatePalette(
  seed,
  appearance = "light",
  monochrome = false,
) {
  const normalized = normalizeHex(seed);
  if (!normalized || !["light", "dark"].includes(appearance))
    throw Error("无效的主题色或深浅模式");
  const dark = appearance === "dark",
    source = toLCH(normalized),
    C = monochrome || source.C < 0.01 ? 0 : clamp(source.C, 0.06, 0.2),
    h = source.h;
  const color = (L, c) => tone(L, c, h);
  const paper = monochrome
      ? dark
        ? "#000000"
        : "#ffffff"
      : color(dark ? 0.23 : 0.965, C * (dark ? 0.28 : 0.08)),
    surface = color(dark ? 0.275 : 0.985, C * 0.06),
    wash = color(dark ? 0.3 : 0.94, C * 0.1),
    backgrounds = [paper, surface, wash];
  const readable = (L, c, ratio) => {
    for (let i = 0; i <= 100; i++) {
      const value = color(clamp(L + (dark ? i : -i) * 0.01), c);
      if (backgrounds.every((bg) => contrastRatio(value, bg) >= ratio))
        return value;
    }
    return dark ? "#ffffff" : "#000000";
  };
  const ink = monochrome
      ? dark
        ? "#ffffff"
        : "#000000"
      : readable(dark ? 0.94 : 0.25, C * 0.22, 7.5),
    meaning = readable(dark ? 0.77 : 0.46, C * 0.18, 5),
    muted = readable(dark ? 0.74 : 0.5, C * 0.16, 4.6),
    accent = monochrome
      ? ink
      : readable(
          dark ? 0.8 : clamp(0.5 + (source.L - 0.55) * 0.16, 0.46, 0.54),
          C * (dark ? 0.7 : 1),
          4.6,
        );
  return {
    paper,
    surface,
    ink,
    meaning,
    muted,
    line: color(dark ? 0.36 : 0.86, C * 0.12),
    "line-strong": color(dark ? 0.56 : 0.65, C * 0.16),
    wash,
    accent,
    "accent-soft": alpha(accent, dark ? 0.12 : 0.06),
    "control-ink": alpha(accent, dark ? 0.26 : 0.18),
    error: monochrome
      ? ink
      : tone(dark ? 0.78 : 0.48, 0.14, (25 * Math.PI) / 180),
    "action-keep": monochrome ? ink : dark ? "#75d5a3" : "#67bd91",
    "action-hint": monochrome ? ink : dark ? "#ffd83e" : "#f5cd38",
    "action-next": monochrome ? ink : dark ? "#83abff" : "#719cf3",
    "qr-paper": "#ffffff",
    "qr-ink": "#000000",
  };
}
export function resolveTheme(preferences = THEME_DEFAULTS, systemDark = false) {
  const appearance =
      preferences.appearance === "system"
        ? systemDark
          ? "dark"
          : "light"
        : preferences.appearance,
    preset = themePresets[preferences.colorTheme] || themePresets.blue,
    seed =
      preferences.colorTheme === "custom"
        ? preferences.customColor
        : preset.color;
  return {
    id: preferences.colorTheme,
    appearance,
    seed,
    tokens: generatePalette(seed, appearance, preset.monochrome === true),
  };
}
export function themeStylesheet() {
  const variables = (tokens, mode) =>
    `color-scheme:${mode};${Object.entries(tokens)
      .map(([key, value]) => `--${key}:${value};`)
      .join("")}`;
  const light = generatePalette(themePresets.blue.color, "light"),
    dark = generatePalette(themePresets.blue.color, "dark");
  return `/* Generated from src/themes.js. Run npm run themes after algorithm changes. */\n:root{${variables(light, "light")}}\n@media(prefers-color-scheme:dark){:root{${variables(dark, "dark")}}}\n`;
}
