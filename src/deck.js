// The transport format is deliberately independent of the study engine.
export const DECK_FORMAT = "lexora.deck";
export const MAX_DECK_BYTES = 10 * 1024 * 1024;
export const MAX_CARDS = 50000;
const idPattern =
  /^(?!constructor$|prototype$)[A-Za-z0-9][A-Za-z0-9:._/-]{0,159}$/;
const localePattern = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;
const own = (o, k) => Object.hasOwn(o, k);
const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const fail = (path, message) => {
  throw new Error(`${path}：${message}`);
};
function keys(value, allowed, path) {
  if (!object(value)) fail(path, "应为对象");
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      fail(`${path}.${key}`, "未知字段；自定义数据请放入 extensions");
}
function text(value, path, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(path, `应为${required ? "非空" : ""}文本，最长 ${max} 字符`);
}
export function validId(value) {
  return typeof value === "string" && idPattern.test(value);
}
function id(value, path) {
  if (!validId(value))
    fail(path, "需要稳定 ID（字母或数字开头，可含 : . _ / -，最长 160 字符）");
}
function locale(value, path) {
  if (typeof value !== "string" || !localePattern.test(value))
    fail(path, "应为语言标签，如 en 或 zh-Hans");
}
function list(value, path, max, each) {
  if (!Array.isArray(value) || value.length > max)
    fail(path, `应为数组，最多 ${max} 项`);
  value.forEach((v, i) => each(v, `${path}[${i + 1}]`));
}
function strings(value, path, count, length) {
  list(value, path, count, (v, p) => text(v, p, length, true));
}
function extension(value, path) {
  if (!object(value)) fail(path, "应为对象");
  for (const key of Object.keys(value))
    if (!/^[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)+$/.test(key))
      fail(path, "扩展键需使用命名空间，如 org.example");
}
function optional(o, key, path, validate) {
  if (own(o, key)) validate(o[key], `${path}.${key}`);
}

export function validateDeck(input) {
  const root = "词册";
  keys(
    input,
    [
      "format",
      "schemaVersion",
      "id",
      "revision",
      "title",
      "description",
      "language",
      "answerLanguage",
      "sources",
      "cards",
      "extensions",
    ],
    root,
  );
  if (input.format !== DECK_FORMAT || input.schemaVersion !== 1)
    fail(root, "仅支持 lexora.deck / schemaVersion 1");
  id(input.id, "词册.id");
  if (!Number.isSafeInteger(input.revision) || input.revision < 1)
    fail("词册.revision", "应为大于零的整数");
  text(input.title, "词册.title", 120, true);
  optional(input, "description", root, (v, p) => text(v, p, 2000));
  for (const key of ["language", "answerLanguage"])
    optional(input, key, root, locale);
  optional(input, "extensions", root, extension);
  const sourceIds = new Set();
  optional(input, "sources", root, (sources, p) =>
    list(sources, p, 100, (s, sp) => {
      keys(s, ["id", "title", "url", "license"], sp);
      id(s.id, `${sp}.id`);
      text(s.title, `${sp}.title`, 300, true);
      if (sourceIds.has(s.id)) fail(sp, "来源 ID 重复");
      sourceIds.add(s.id);
      optional(s, "license", sp, (v, q) => text(v, q, 200));
      optional(s, "url", sp, (v, q) => {
        text(v, q, 2000);
        if (!/^https?:\/\/[^\s]+$/.test(v)) fail(q, "仅支持 http/https 地址");
      });
    }),
  );
  if (
    !Array.isArray(input.cards) ||
    input.cards.length < 1 ||
    input.cards.length > MAX_CARDS
  )
    fail("词册.cards", `需要 1 至 ${MAX_CARDS} 条卡片`);
  const ids = new Set();
  input.cards.forEach((card, index) => {
    const p = `第 ${index + 1} 条卡片`;
    keys(
      card,
      [
        "id",
        "type",
        "prompt",
        "answer",
        "acceptedAnswers",
        "language",
        "answerLanguage",
        "pronunciations",
        "examples",
        "tags",
        "note",
        "sourceRefs",
        "extensions",
      ],
      p,
    );
    id(card.id, `${p}.id`);
    if (ids.has(card.id)) fail(`${p}.id`, `重复 ID「${card.id}」`);
    ids.add(card.id);
    if (!["vocabulary", "knowledge"].includes(card.type))
      fail(`${p}.type`, "仅支持 vocabulary 或 knowledge");
    text(card.prompt, `${p}.prompt`, 2000, true);
    text(card.answer, `${p}.answer`, 12000, true);
    for (const key of ["language", "answerLanguage"])
      optional(card, key, p, locale);
    optional(card, "acceptedAnswers", p, (v, q) => {
      strings(v, q, 20, 2000);
      if (!v.length) fail(q, "省略该字段，或至少提供一个答案");
    });
    optional(card, "tags", p, (v, q) => strings(v, q, 20, 64));
    optional(card, "note", p, (v, q) => text(v, q, 8000));
    optional(card, "sourceRefs", p, (v, q) => strings(v, q, 100, 160));
    for (const ref of card.sourceRefs || [])
      if (!sourceIds.has(ref))
        fail(`${p}.sourceRefs`, `未定义的来源「${ref}」`);
    optional(card, "pronunciations", p, (v, q) =>
      list(v, q, 10, (entry, ep) => {
        keys(entry, ["label", "value"], ep);
        text(entry.value, `${ep}.value`, 200, true);
        optional(entry, "label", ep, (s, sp) => text(s, sp, 80));
      }),
    );
    optional(card, "examples", p, (v, q) =>
      list(v, q, 20, (entry, ep) => {
        keys(entry, ["text", "translation"], ep);
        text(entry.text, `${ep}.text`, 4000, true);
        optional(entry, "translation", ep, (s, sp) => text(s, sp, 4000));
      }),
    );
    optional(card, "extensions", p, extension);
  });
  return structuredClone(input);
}

// Compatibility adapter for the repository's original test.jsonl, not a second canonical format.
export function parseLegacyJSONL(raw) {
  const rows = raw
    .split(/\r?\n/)
    .map((line, i) => {
      if (!line.trim()) return null;
      try {
        return JSON.parse(line);
      } catch {
        fail(`JSONL 第 ${i + 1} 行`, "JSON 语法不正确");
      }
    })
    .filter(Boolean);
  const meta = rows.shift();
  if (
    !object(meta) ||
    meta.type !== "metadata" ||
    meta.schema !== "lexora.wordbook.v1"
  )
    fail("JSONL", "首行需要 lexora.wordbook.v1 元数据");
  if (!rows.length) fail("JSONL", "没有条目");
  // Explicit extension data preserves fields not used by this reader, including multi-sense structure.
  const deck = {
    format: DECK_FORMAT,
    schemaVersion: 1,
    id: `legacy:${
      String(meta.title || "untitled")
        .normalize("NFKC")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .slice(0, 100) || "untitled"
    }`,
    revision: 1,
    title: meta.title || "旧版词册",
    description: meta.description || "",
    language: meta.language || "en",
    answerLanguage: meta.translation_language || "zh-Hans",
    sources: (meta.sources || []).map((s) => ({
      id: s.id,
      title: s.name,
      ...(s.url ? { url: s.url } : {}),
      ...(s.license ? { license: s.license } : {}),
    })),
    extensions: { "lexora.legacy": meta },
    cards: rows.map((entry, i) => {
      if (
        !object(entry) ||
        entry.type !== "entry" ||
        typeof entry.term !== "string" ||
        !Array.isArray(entry.senses)
      )
        fail(`JSONL 条目 ${i + 1}`, "需要 entry、term 和 senses");
      const answer = entry.senses
        .flatMap((s) => {
          const definitions =
            s.definitions?.[meta.translation_language || "zh-Hans"] ||
            Object.values(s.definitions || {})[0] ||
            [];
          if (
            !Array.isArray(definitions) ||
            definitions.some((x) => typeof x !== "string")
          )
            fail(`JSONL 条目 ${i + 1}`, "definitions 应为文本数组");
          return definitions.length
            ? [(s.pos ? `${s.pos} · ` : "") + definitions.join("；")]
            : [];
        })
        .join("\n");
      return {
        id: entry.id,
        type: "vocabulary",
        prompt: entry.term,
        answer,
        ...(entry.pronunciations
          ? {
              pronunciations: entry.pronunciations.map((p) => ({
                label: [p.region, p.pos].filter(Boolean).join(" · "),
                value: p.value,
              })),
            }
          : {}),
        ...(entry.tags ? { tags: entry.tags } : {}),
        ...(entry.notes ? { note: entry.notes } : {}),
        ...(entry.source_refs ? { sourceRefs: entry.source_refs } : {}),
        examples: entry.senses
          .flatMap((s) => s.examples || [])
          .map((e) => ({
            text: e.text,
            ...(e.translation ? { translation: e.translation } : {}),
          }))
          .slice(0, 20),
        extensions: { "lexora.legacy": entry },
      };
    }),
  };
  return validateDeck(deck);
}

export function parseDeck(raw, filename = "") {
  const text = raw.replace(/^\uFEFF/, "");
  if (new TextEncoder().encode(text).byteLength > MAX_DECK_BYTES)
    throw Error("词册文件超过 10 MiB，请拆分成较小的词册");
  if (/\.jsonl$/i.test(filename)) return parseLegacyJSONL(text);
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error(
      "JSON 语法不正确，请检查引号、逗号和括号；JSONL 文件请使用 .jsonl 后缀",
    );
  }
  return validateDeck(value);
}
export function normalizeAnswer(value) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .replace(/[‐‑–—]/g, "-");
}
export function canSpell(card) {
  return card.type === "vocabulary" || !!card.acceptedAnswers?.length;
}
export function matchesAnswer(card, value) {
  return (card.acceptedAnswers || [card.prompt]).some(
    (answer) => normalizeAnswer(answer) === normalizeAnswer(value),
  );
}
