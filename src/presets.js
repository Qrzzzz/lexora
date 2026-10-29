import { parseDeck, MAX_DECK_BYTES } from "./deck.js";

// First-party static files; no external dictionary API or runtime credentials.
export const presets = [
  {
    id: "cet4-core",
    deckId: "wordtyper-cet4-core",
    title: "四级核心词汇",
    count: 3815,
    url: new URL("../examples/first-dictionary.json", import.meta.url),
  },
];

export async function loadPreset(preset = presets[0]) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(preset.url, {
      cache: "no-cache",
      signal: controller.signal,
    });
    if (!response.ok)
      throw Error("样例词册暂时无法加载，请稍后重试，或导入本地文件");
    if (Number(response.headers.get("content-length")) > MAX_DECK_BYTES)
      throw Error("样例文件过大");
    const deck = parseDeck(await response.text());
    if (deck.cards.length !== preset.count || deck.id !== preset.deckId)
      throw Error("样例与目录不一致，请稍后重试");
    return deck;
  } finally {
    clearTimeout(timer);
  }
}
