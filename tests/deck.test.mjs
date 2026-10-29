import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  parseDeck,
  validateDeck,
  parseLegacyJSONL,
  matchesAnswer,
  canSpell,
} from "../src/deck.js";
import { demoDeck } from "../src/demo.js";
import {
  createWorkspace,
  validateWorkspace,
  currentCard,
  activeProgress,
  rateCard,
  startRound,
  toggleMastered,
  planImport,
  importDeck,
} from "../src/model.js";
const copy = () => structuredClone(demoDeck);

test("minimum vocabulary and knowledge decks are independent of reader state", () => {
  const deck = validateDeck({
    format: "lexora.deck",
    schemaVersion: 1,
    id: "test",
    revision: 1,
    title: "测试",
    cards: [{ id: "one", type: "knowledge", prompt: "问", answer: "答" }],
  });
  assert.equal(deck.cards[0].type, "knowledge");
  assert.equal(canSpell(deck.cards[0]), false);
});
test("BOM and Chinese text survive parsing; malformed JSON is actionable", () => {
  assert.deepEqual(parseDeck("\uFEFF" + JSON.stringify(demoDeck)), demoDeck);
  assert.throws(() => parseDeck("{"), /语法/);
});
test("duplicates identify the actual card, not a generic import failure", () => {
  const d = copy();
  d.cards[1].id = d.cards[0].id;
  assert.throws(() => validateDeck(d), /第 2 条卡片.id.*重复/);
});
test("empty answers, unknown fields and unsupported versions are rejected", () => {
  for (const mutate of [
    (d) => (d.cards[0].answer = " "),
    (d) => (d.cards[0].answers = []),
    (d) => (d.schemaVersion = 2),
    (d) => (d.revision = 0),
  ]) {
    const d = copy();
    mutate(d);
    assert.throws(() => validateDeck(d));
  }
});
test("unsafe or prototype-like IDs and executable URLs are rejected", () => {
  for (const value of [
    "__proto__",
    "constructor",
    "prototype",
    '"><img src=x>',
  ]) {
    const d = copy();
    d.cards[0].id = value;
    assert.throws(() => validateDeck(d));
  }
  const d = copy();
  d.sources = [{ id: "source", title: "test", url: "javascript:alert(1)" }];
  assert.throws(() => validateDeck(d), /http/);
});
test("source references must exist and extensions are namespaced", () => {
  const d = copy();
  d.cards[0].sourceRefs = ["missing"];
  assert.throws(() => validateDeck(d), /未定义/);
  delete d.cards[0].sourceRefs;
  d.extensions = { custom: true };
  assert.throws(() => validateDeck(d), /命名空间/);
  d.extensions = { "org.example": { arbitrary: "preserved" } };
  assert.equal(
    validateDeck(d).extensions["org.example"].arbitrary,
    "preserved",
  );
});
test("content is plain text, including markup-like text", () => {
  const d = copy();
  d.cards[0].prompt = "<img src=x onerror=alert(1)>";
  assert.equal(validateDeck(d).cards[0].prompt, d.cards[0].prompt);
});
test("spelling normalizes case, width and whitespace without dropping punctuation", () => {
  assert.equal(
    matchesAnswer({ prompt: "hello world" }, " ＨＥＬＬＯ   world "),
    true,
  );
  assert.equal(matchesAnswer({ prompt: "well-known" }, "well–known"), true);
  assert.equal(
    matchesAnswer(
      { prompt: "cannot", acceptedAnswers: ["cannot", "can’t"] },
      "can’t",
    ),
    true,
  );
  assert.equal(matchesAnswer({ prompt: "C++" }, "C"), false);
});
test("original repository JSONL imports all entries and retains rich source data", async () => {
  const raw = await readFile(new URL("../test.jsonl", import.meta.url), "utf8"),
    deck = parseLegacyJSONL(raw);
  assert.equal(deck.cards.length, raw.trim().split(/\r?\n/).length - 1);
  assert.ok(
    deck.cards.find((c) => c.prompt === "conduct").answer.includes("noun"),
  );
  assert.ok(deck.cards[0].extensions["lexora.legacy"].forms);
});
test("legacy JSONL syntax errors report line numbers", () => {
  assert.throws(
    () =>
      parseLegacyJSONL('{"type":"metadata","schema":"lexora.wordbook.v1"}\n{'),
    /第 2 行/,
  );
});
test("mastering advances queue and history exactly once; next round excludes mastered", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master", new Date("2026-10-29T12:00:00Z"));
  rateCard(w, "again");
  assert.equal(currentCard(w).id, "retrieval-practice");
  assert.equal(activeProgress(w).totalReviews, 2);
  assert.equal(activeProgress(w).recent.length, 2);
  startRound(w);
  assert.deepEqual(activeProgress(w).round.queue, [
    "retain",
    "retrieval-practice",
  ]);
});
test("rating a completed round is a no-op; recent record is bounded", () => {
  const w = createWorkspace(demoDeck);
  for (let i = 0; i < 6; i++) {
    while (currentCard(w)) rateCard(w, "again");
    startRound(w);
  }
  assert.equal(activeProgress(w).recent.length, 12);
  while (currentCard(w)) rateCard(w, "again");
  const n = activeProgress(w).totalReviews;
  assert.equal(rateCard(w, "again"), false);
  assert.equal(activeProgress(w).totalReviews, n);
});
test("restore from history changes mastery without teleporting the current position", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master");
  const id = currentCard(w).id;
  toggleMastered(w, "serendipity");
  assert.equal(currentCard(w).id, id);
  assert.equal(activeProgress(w).mastered.length, 0);
});
test("mastering a pending library card removes it without skipping the next card", () => {
  const w = createWorkspace(demoDeck);
  toggleMastered(w, "retain");
  assert.equal(currentCard(w).id, "serendipity");
  rateCard(w, "again");
  assert.equal(currentCard(w).id, "retrieval-practice");
});
test("deck updates preserve stable IDs and reintroduce revised learning content", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master");
  rateCard(w, "master");
  const d = copy();
  d.revision = 2;
  d.cards[0].answer = "新的释义";
  d.cards.reverse();
  assert.equal(planImport(w, d).changed, 1);
  importDeck(w, d);
  assert.deepEqual(activeProgress(w).mastered, ["retain"]);
  assert.ok(
    activeProgress(w)
      .round.queue.slice(activeProgress(w).round.cursor)
      .includes("serendipity"),
  );
  assert.doesNotThrow(() => validateWorkspace(w));
});
test("removed cards leave queues and history; metadata-only updates retain mastery", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master");
  const d = copy();
  d.revision = 2;
  d.title = "改名";
  d.cards = d.cards.slice(0, 2);
  importDeck(w, d);
  assert.deepEqual(activeProgress(w).mastered, ["serendipity"]);
  assert.equal(
    activeProgress(w).round.queue.includes("retrieval-practice"),
    false,
  );
  assert.doesNotThrow(() => validateWorkspace(w));
});
test("same revision with changed content and revision downgrades do not mutate state", () => {
  const w = createWorkspace(demoDeck),
    before = structuredClone(w),
    d = copy();
  d.title = "changed";
  assert.throws(() => importDeck(w, d), /提高 revision/);
  assert.deepEqual(w, before);
  w.decks[0].revision = 3;
  assert.throws(() => importDeck(w, copy()), /不能/);
});
test("independent deck IDs keep separate learning progress", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master");
  const d = copy();
  d.id = "another";
  importDeck(w, d);
  assert.equal(activeProgress(w).mastered.length, 0);
  w.activeDeckId = demoDeck.id;
  assert.equal(activeProgress(w).mastered.length, 1);
});
test("full backup round-trips decks, settings, queues and history", () => {
  const w = createWorkspace(demoDeck);
  rateCard(w, "master");
  w.preferences.appearance = "dark";
  w.preferences.colorTheme = "purple";
  const restored = validateWorkspace(
    JSON.parse(JSON.stringify({ ...w, exportedAt: new Date().toISOString() })),
  );
  assert.deepEqual(restored, w);
});
test("backup validation rejects duplicate decks and invalid queue references atomically", () => {
  for (const mutate of [
    (w) => w.decks.push(copy()),
    (w) => w.progress[0].round.queue.push("missing"),
    (w) => (w.progress[0].round.cursor = -1),
    (w) => (w.progress[0].mastered = ["missing"]),
    (w) => (w.preferences.motion = "yes"),
    (w) => (w.activeDeckId = "missing"),
  ]) {
    const w = createWorkspace(demoDeck);
    mutate(w);
    assert.throws(() => validateWorkspace(w));
  }
});
