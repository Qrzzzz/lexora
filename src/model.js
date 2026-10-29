import { validateDeck, validId, cardTerm, cardSummary } from "./deck.js";
export const PREFS = {
  theme: "system",
  motion: true,
  haptics: true,
  showAnswer: true,
  mode: "recall",
  order: "source",
  historyDisplay: "summary",
};
export const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const themes = ["system", "paper", "white", "mist", "night"];
const record = (x) => x && typeof x === "object" && !Array.isArray(x);
const safeNumber = (x, min = 0) => Number.isSafeInteger(x) && x >= min;
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
export function createProgress(deck) {
  return {
    deckId: deck.id,
    mastered: [],
    stats: {},
    recent: [],
    totalReviews: 0,
    daily: {},
    round: {
      number: 1,
      queue: deck.cards.map((c) => c.id),
      cursor: 0,
      reviews: 0,
      kills: 0,
    },
  };
}
export function createWorkspace(deck) {
  const decks = deck ? [validateDeck(deck)] : [];
  return {
    format: "lexora.backup",
    schemaVersion: 1,
    decks,
    progress: decks.map(createProgress),
    activeDeckId: deck?.id || null,
    preferences: { ...PREFS },
  };
}
export const activeDeck = (w) => w.decks.find((d) => d.id === w.activeDeckId);
export const activeProgress = (w) =>
  w.progress.find((p) => p.deckId === w.activeDeckId);
export function currentCard(w) {
  const deck = activeDeck(w),
    p = activeProgress(w);
  return deck?.cards.find((c) => c.id === p?.round.queue[p.round.cursor]);
}
export function startRound(w) {
  const deck = activeDeck(w),
    p = activeProgress(w);
  if (!deck || !p) return;
  const mastered = new Set(p.mastered);
  const queue = deck.cards.filter((c) => !mastered.has(c.id)).map((c) => c.id);
  if (w.preferences.order === "shuffle")
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
  p.round = {
    number: p.round.number + 1,
    queue,
    cursor: 0,
    reviews: 0,
    kills: 0,
  };
}
export function rateCard(w, kind, date = new Date()) {
  assert(["again", "master"].includes(kind), "未知学习操作");
  const card = currentCard(w),
    p = activeProgress(w);
  if (!card || !p) return false;
  p.totalReviews++;
  const old = Object.hasOwn(p.stats, card.id) ? p.stats[card.id] : null;
  p.stats[card.id] = { seen: (old?.seen || 0) + 1, last: p.totalReviews };
  const day = localDay(date);
  p.daily[day] = (p.daily[day] || 0) + 1;
  for (const oldDay of Object.keys(p.daily).sort().slice(0, -400))
    delete p.daily[oldDay];
  if (kind === "master" && !p.mastered.includes(card.id)) {
    p.mastered.push(card.id);
    p.round.kills++;
  }
  p.recent.push({
    cardId: card.id,
    kind,
    at: date.toISOString(),
    eventId: `${date.getTime()}-${p.totalReviews}`,
  });
  p.recent = p.recent.slice(-12);
  p.round.cursor++;
  p.round.reviews++;
  return true;
}
export function toggleMastered(w, cardId) {
  const deck = activeDeck(w),
    p = activeProgress(w);
  if (!deck?.cards.some((c) => c.id === cardId)) return;
  const exists = p.mastered.includes(cardId);
  p.mastered = exists
    ? p.mastered.filter((id) => id !== cardId)
    : [...p.mastered, cardId];
  // Never alter already-read positions. Newly mastered pending cards leave the current queue.
  p.round.queue = p.round.queue.filter(
    (id, i) => i < p.round.cursor || id !== cardId || exists,
  );
}
function learningContent(card) {
  return JSON.stringify([
    card.type,
    cardTerm(card),
    cardSummary(card),
    card.acceptedAnswers || null,
    card.senses || null,
  ]);
}
export function planImport(w, deck) {
  const old = w.decks.find((d) => d.id === deck.id);
  if (!old)
    return { kind: "new", added: deck.cards.length, changed: 0, removed: 0 };
  if (deck.revision < old.revision)
    throw Error(
      `当前已有修订 ${old.revision}，不能用修订 ${deck.revision} 覆盖。请提高 revision，或使用新的词册 ID。`,
    );
  if (
    deck.revision === old.revision &&
    JSON.stringify(deck) !== JSON.stringify(old)
  )
    throw Error("同一个词册 ID 的内容已变化，请先提高 revision 再导入");
  const before = new Map(old.cards.map((c) => [c.id, c])),
    after = new Set(deck.cards.map((c) => c.id));
  return {
    kind: "update",
    added: deck.cards.filter((c) => !before.has(c.id)).length,
    changed: deck.cards.filter(
      (c) =>
        before.has(c.id) &&
        learningContent(c) !== learningContent(before.get(c.id)),
    ).length,
    removed: old.cards.filter((c) => !after.has(c.id)).length,
  };
}
export function importDeck(w, input) {
  const deck = validateDeck(input),
    plan = planImport(w, deck),
    old = w.decks.find((d) => d.id === deck.id);
  if (!old) {
    w.decks.push(deck);
    w.progress.push(createProgress(deck));
  } else {
    const before = new Map(old.cards.map((c) => [c.id, c])),
      p = w.progress.find((p) => p.deckId === deck.id),
      ids = new Set(deck.cards.map((c) => c.id));
    const changed = new Set(
      deck.cards
        .filter(
          (c) =>
            before.has(c.id) &&
            learningContent(c) !== learningContent(before.get(c.id)),
        )
        .map((c) => c.id),
    );
    p.mastered = p.mastered.filter((id) => ids.has(id) && !changed.has(id));
    p.recent = p.recent.filter((e) => ids.has(e.cardId));
    const mastered = new Set(p.mastered);
    const read = p.round.queue
      .slice(0, p.round.cursor)
      .filter((id) => ids.has(id) && !changed.has(id));
    const pending = p.round.queue
      .slice(p.round.cursor)
      .filter((id) => ids.has(id) && !mastered.has(id));
    const inQueue = new Set([...read, ...pending]);
    const added = deck.cards
      .filter(
        (c) =>
          !inQueue.has(c.id) &&
          !mastered.has(c.id) &&
          (!before.has(c.id) || changed.has(c.id)),
      )
      .map((c) => c.id);
    p.round.queue = [...read, ...pending, ...added];
    p.round.cursor = read.length;
    w.decks[w.decks.indexOf(old)] = deck;
  }
  w.activeDeckId = deck.id;
  return plan;
}

export function validateWorkspace(input) {
  assert(
    record(input) &&
      input.format === "lexora.backup" &&
      input.schemaVersion === 1,
    "不是有效的 Lexora v1 完整备份",
  );
  assert(
    Array.isArray(input.decks) && input.decks.length <= 100,
    "备份最多包含 100 本词册",
  );
  const decks = input.decks.map(validateDeck),
    ids = new Set(decks.map((d) => d.id));
  assert(ids.size === decks.length, "备份中词册 ID 重复");
  assert(
    input.activeDeckId === null || ids.has(input.activeDeckId),
    "当前词册不存在",
  );
  assert(!decks.length || input.activeDeckId !== null, "备份缺少当前词册");
  const prefs = input.preferences;
  assert(
    record(prefs) &&
      themes.includes(prefs.theme) &&
      typeof prefs.motion === "boolean" &&
      (prefs.haptics === undefined || typeof prefs.haptics === "boolean") &&
      (prefs.showAnswer === undefined ||
        typeof prefs.showAnswer === "boolean") &&
      ["recall", "spelling"].includes(prefs.mode) &&
      (prefs.historyDisplay === undefined ||
        ["word", "summary"].includes(prefs.historyDisplay)) &&
      ["source", "shuffle"].includes(prefs.order),
    "阅读偏好不正确",
  );
  assert(
    Array.isArray(input.progress) && input.progress.length === decks.length,
    "词册与学习进度不匹配",
  );
  const progressIds = new Set();
  const progress = input.progress.map((p) => {
    assert(
      record(p) && ids.has(p.deckId) && !progressIds.has(p.deckId),
      "学习进度中的词册 ID 无效或重复",
    );
    progressIds.add(p.deckId);
    const deck = decks.find((d) => d.id === p.deckId),
      cards = new Set(deck.cards.map((c) => c.id));
    const uniqueIds = (a, known = true) =>
      Array.isArray(a) &&
      a.every((x) => validId(x) && (!known || cards.has(x))) &&
      new Set(a).size === a.length;
    assert(uniqueIds(p.mastered), "已掌握列表无效");
    assert(
      record(p.stats) && Object.keys(p.stats).length <= 100000,
      "条目统计无效",
    );
    for (const [id, s] of Object.entries(p.stats))
      assert(
        validId(id) && record(s) && safeNumber(s.seen) && safeNumber(s.last),
        "条目统计无效",
      );
    assert(safeNumber(p.totalReviews), "学习次数无效");
    assert(
      record(p.daily) &&
        Object.keys(p.daily).length <= 400 &&
        Object.entries(p.daily).every(
          ([d, n]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && safeNumber(n),
        ),
      "每日记录无效",
    );
    const r = p.round;
    assert(
      record(r) &&
        safeNumber(r.number, 1) &&
        uniqueIds(r.queue) &&
        safeNumber(r.cursor) &&
        r.cursor <= r.queue.length &&
        safeNumber(r.reviews) &&
        safeNumber(r.kills),
      "学习队列无效",
    );
    const mastered = new Set(p.mastered);
    assert(
      r.queue.slice(r.cursor).every((id) => !mastered.has(id)),
      "待学队列包含已掌握条目",
    );
    assert(
      Array.isArray(p.recent) &&
        p.recent.length <= 12 &&
        p.recent.every(
          (e) =>
            record(e) &&
            cards.has(e.cardId) &&
            ["again", "master"].includes(e.kind) &&
            typeof e.at === "string" &&
            Number.isFinite(Date.parse(e.at)) &&
            typeof e.eventId === "string" &&
            e.eventId.length <= 100,
        ),
      "近期记录无效",
    );
    // Reconstruct only supported fields; never merge arbitrary backup properties into live objects.
    return structuredClone({
      deckId: p.deckId,
      mastered: p.mastered,
      stats: p.stats,
      recent: p.recent,
      totalReviews: p.totalReviews,
      daily: p.daily,
      round: {
        number: r.number,
        queue: r.queue,
        cursor: r.cursor,
        reviews: r.reviews,
        kills: r.kills,
      },
    });
  });
  return {
    format: "lexora.backup",
    schemaVersion: 1,
    decks,
    progress,
    activeDeckId: input.activeDeckId,
    preferences: {
      theme: ["paper", "mist"].includes(prefs.theme) ? "system" : prefs.theme,
      motion: prefs.motion,
      haptics: prefs.haptics !== false,
      showAnswer: prefs.showAnswer !== false,
      mode: prefs.mode,
      order: prefs.order,
      historyDisplay: prefs.historyDisplay ?? "summary",
    },
  };
}
