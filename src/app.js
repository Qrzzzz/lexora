import { parseDeck, MAX_DECK_BYTES, canSpell, matchesAnswer } from "./deck.js";
import { demoDeck } from "./demo.js";
import {
  createWorkspace,
  validateWorkspace,
  activeDeck,
  activeProgress,
  currentCard,
  rateCard,
  startRound,
  toggleMastered,
  planImport,
  importDeck,
  localDay,
} from "./model.js";
import { loadWorkspace, persistWorkspace } from "./storage.js";
import { createMotion } from "./motion.js";
const $ = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (text, action, className = "text-button") => {
  const node = element("button", className, text);
  node.type = "button";
  node.onclick = action;
  return node;
};
let workspace,
  tab = null,
  reviewId = null,
  revealed = true,
  checked = false,
  pendingDeck = null,
  pendingBackup = null,
  libraryLimit = 100;
let undoStack = [],
  undoBytes = 0,
  saveQueue = Promise.resolve(),
  toastTimer,
  blockAutosave = false,
  storageOK = true,
  saving = 0,
  latestSave = 0;
const motion = createMotion(
  $("study-stage"),
  () => !!workspace?.preferences.motion,
);
function notify(text) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2700);
}
function storageWarning(message) {
  storageOK = false;
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
  $("backup-shortcut").textContent = "请导出备份 ↗";
}
function save({ explicit = false } = {}) {
  if (blockAutosave && !explicit) return Promise.resolve(false);
  const snapshot = structuredClone(workspace),
    ticket = ++saving;
  latestSave = ticket;
  $("backup-shortcut").textContent = "保存中";
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => persistWorkspace(snapshot))
    .then(() => {
      if (ticket !== latestSave) return true;
      storageOK = true;
      blockAutosave = false;
      $("storage-warning").hidden = true;
      $("backup-shortcut").textContent = "已保存";
      return true;
    })
    .catch(() => {
      storageWarning(
        "暂时无法保存到浏览器。当前仍可学习，请在「备份」中导出完整手帖。",
      );
      return false;
    });
  return saveQueue;
}
function remember() {
  const p = activeProgress(workspace);
  if (!p) return;
  const serialized = JSON.stringify({
    deckId: workspace.activeDeckId,
    progress: p,
  });
  undoStack.push(serialized);
  undoBytes += serialized.length;
  while (undoStack.length > 30 || (undoBytes > 4e6 && undoStack.length > 1))
    undoBytes -= undoStack.shift().length;
}
function resetUndo() {
  undoStack = [];
  undoBytes = 0;
}
function perform(kind, action, origin) {
  const capture = motion.capture();
  action();
  renderStudy();
  motion.play(capture, kind, origin);
}
function applyPreferences() {
  const p = workspace.preferences;
  document.body.dataset.theme = p.theme;
  document.body.classList.toggle("no-texture", !p.texture);
  document.documentElement.classList.toggle("no-motion", !p.motion);
  document.querySelector("meta[name=theme-color]").content = getComputedStyle(
    document.body,
  )
    .getPropertyValue("--paper")
    .trim();
  $("mode").value = p.mode;
  $("order").value = p.order;
  $("texture").setAttribute("aria-checked", p.texture);
  $("motion").setAttribute("aria-checked", p.motion);
  document
    .querySelectorAll("#theme-options button")
    .forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.theme === p.theme),
    );
}
function renderHistory() {
  const deck = activeDeck(workspace),
    p = activeProgress(workspace),
    list = $("history-list");
  const previous = new Map(
    [...list.children].map((b) => [
      b.dataset.eventId,
      {
        rect: b.getBoundingClientRect(),
        opacity: Number(b.style.getPropertyValue("--history-opacity")),
        filter: getComputedStyle(b).filter,
      },
    ]),
  );
  list.replaceChildren();
  const cards = new Map(deck?.cards.map((c) => [c.id, c]) || []),
    events = (p?.recent || []).filter((e) => cards.has(e.cardId)).slice(-4);
  const mobile = matchMedia("(max-width:760px)").matches;
  if (mobile) events.reverse();
  $("history-empty").hidden = !!events.length;
  for (let i = 0; i < events.length; i++) {
    const event = events[i],
      card = cards.get(event.cardId),
      age = mobile ? i : events.length - 1 - i;
    const b = button(
      "",
      () => openHistory(card.id, b.getBoundingClientRect()),
      "history-entry",
    );
    b.classList.toggle("is-mastered", p.mastered.includes(card.id));
    b.dataset.cardId = card.id;
    b.dataset.eventId = event.eventId;
    b.setAttribute("aria-label", `回看 ${card.prompt}`);
    b.setAttribute("aria-pressed", reviewId === card.id);
    b.style.setProperty("--history-opacity", String([1, 0.68, 0.4, 0.21][age]));
    b.style.setProperty("--history-blur", `${[0, 0.15, 0.45, 0.75][age]}px`);
    b.append(
      element("span", "history-term", card.prompt),
      element(
        "span",
        "history-status",
        event.kind === "master" ? "已斩" : "再遇",
      ),
    );
    list.append(b);
  }
  motion.history(list, previous);
}
function renderStudy() {
  motion.clear();
  applyPreferences();
  const deck = activeDeck(workspace),
    p = activeProgress(workspace),
    stage = $("study-stage");
  stage.replaceChildren();
  $("study-controls").hidden = false;
  $("undo").disabled = !undoStack.length;
  $("current-deck").textContent = deck?.title || "选择一本词册";
  const today = workspace.progress.reduce(
    (sum, p) => sum + (p.daily[localDay()] || 0),
    0,
  );
  $("daily-count").textContent = `今日 ${today}`;
  renderHistory();
  if (!deck) {
    $("position").textContent = "";
    $("study-controls").hidden = true;
    const wrapper = element("div", "empty-stage");
    wrapper.append(
      element("h1", "", "一册，新的开始。"),
      element("p", "", "导入想记住的词汇，或一条条知识。"),
      button("添一本词册", () => openWorkspace("decks"), "solid-button"),
    );
    stage.append(wrapper);
    return;
  }
  const card = reviewId
    ? deck.cards.find((c) => c.id === reviewId)
    : currentCard(workspace);
  $("position").textContent = reviewId
    ? "回望"
    : `${String(Math.min(p.round.cursor + 1, p.round.queue.length)).padStart(2, "0")} / ${String(p.round.queue.length).padStart(2, "0")}`;
  $("reading-caption").textContent = reviewId
    ? "回望不会改变当前学习位置。"
    : `第 ${p.round.number} 轮 · 将熟悉的斩去，让陌生的再见。`;
  if (!card) {
    reviewId = null;
    $("study-controls").hidden = true;
    const all = p.mastered.length === deck.cards.length,
      summary = element("div", "summary");
    summary.append(
      element("h2", "", all ? "全部掌握" : "本轮完成"),
      button(
        all ? "词册" : "下一轮",
        () => (all ? openWorkspace("library") : nextRound()),
        "solid-button",
      ),
    );
    stage.append(summary);
    return;
  }
  if (reviewId)
    stage.append(
      element(
        "span",
        "review-badge",
        p.mastered.includes(card.id) ? "已斩" : "回顾",
      ),
    );
  const spell =
    !reviewId && workspace.preferences.mode === "spelling" && canSpell(card);
  const prompt =
    spell && card.type === "vocabulary" ? card.answer : card.prompt;
  const heading = element(
    "h1",
    `word${prompt.length > 17 ? " is-long" : ""}`,
    prompt,
  );
  heading.lang =
    (spell && card.type === "vocabulary"
      ? card.answerLanguage || deck.answerLanguage
      : card.language || deck.language) || "";
  stage.append(heading);
  if (!spell && card.pronunciations?.length)
    stage.append(
      element(
        "div",
        "pronunciation",
        card.pronunciations
          .map((p) => [p.label, p.value].filter(Boolean).join(" "))
          .join("   "),
      ),
    );
  if (spell) {
    const form = element("form", "spelling-form"),
      input = element("input");
    input.id = "spelling-input";
    input.name = "answer";
    input.setAttribute("aria-label", "输入答案");
    input.placeholder =
      card.type === "vocabulary" ? "在此写下英文…" : "在此写下答案…";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    form.append(input);
    form.onsubmit = (e) => {
      e.preventDefault();
      checkSpelling();
    };
    stage.append(form);
    // Focus only after explicit desktop mode change; opening the site on a phone never summons its keyboard.
  } else if (revealed || reviewId) appendAnswer(stage, card);
  else {
    const placeholder = element("div", "closed-answer");
    placeholder.append(
      element("i"),
      element(
        "span",
        "",
        card.type === "vocabulary" ? "回想它的含义" : "先试着回想",
      ),
      element("i"),
    );
    stage.append(placeholder);
  }
  if (reviewId) {
    $("study-controls").hidden = true;
    const controls = element("div", "review-actions");
    controls.append(
      button("返回", closeHistory),
      button(p.mastered.includes(card.id) ? "恢复" : "斩", () =>
        toggleFromReview(card.id),
      ),
    );
    stage.append(controls);
  } else {
    $("reveal-label").textContent = spell
      ? "检查"
      : revealed
        ? "隐藏"
        : card.type === "vocabulary"
          ? "释义"
          : "答案";
    $("master").setAttribute(
      "aria-label",
      card.type === "vocabulary" ? "斩掉这个词" : "标记已经掌握",
    );
  }
  checked = false;
}
function appendAnswer(parent, card) {
  const answer = element(
    "div",
    `answer${card.answer.length > 45 ? " is-long" : ""}`,
    card.answer,
  );
  answer.lang =
    card.answerLanguage || activeDeck(workspace)?.answerLanguage || "";
  parent.append(answer);
  for (const example of (card.examples || []).slice(0, 2)) {
    const e = element("p", "card-example", example.text);
    if (example.translation)
      e.append(element("small", "", example.translation));
    parent.append(e);
  }
  if (card.note) parent.append(element("p", "card-note", card.note));
}
function rate(kind) {
  if (tab || reviewId || !currentCard(workspace)) return;
  perform(kind === "master" ? "master" : "next", () => {
    remember();
    rateCard(workspace, kind);
    revealed = workspace.preferences.showAnswer;
    checked = false;
    save();
  });
  $("study-stage").focus({ preventScroll: true });
}
function undo() {
  if (!undoStack.length) {
    notify("还没有可以撤回的操作");
    return;
  }
  perform("undo", () => {
    const raw = undoStack.pop(),
      snapshot = JSON.parse(raw);
    undoBytes -= raw.length;
    const at = workspace.progress.findIndex(
      (p) => p.deckId === snapshot.deckId,
    );
    workspace.progress[at] = snapshot.progress;
    workspace.activeDeckId = snapshot.deckId;
    reviewId = null;
    revealed = workspace.preferences.showAnswer;
    checked = false;
    save();
  });
  notify("已撤回");
  $("study-stage").focus({ preventScroll: true });
}
function reveal() {
  if (tab || reviewId) return;
  const card = currentCard(workspace);
  if (!card) return;
  if (workspace.preferences.mode === "spelling" && canSpell(card)) {
    checkSpelling();
    return;
  }
  revealed = !revealed;
  workspace.preferences.showAnswer = revealed;
  save();
  renderStudy();
  motion.reveal($("study-stage").querySelector(".answer,.closed-answer"));
}
function checkSpelling() {
  if (checked) {
    rate("again");
    return;
  }
  const input = $("spelling-input"),
    card = currentCard(workspace);
  if (!input || !card) return;
  if (!input.value.trim()) {
    input.focus();
    notify("先写下你的答案");
    return;
  }
  checked = true;
  input.readOnly = true;
  const result = element(
    "p",
    "spelling-result",
    matchesAnswer(card, input.value) ? "正确" : "再记一次",
  );
  result.setAttribute("role", "status");
  const answer = element(
    "div",
    "spelling-answer",
    card.type === "vocabulary" ? card.prompt : card.answer,
  );
  input.parentElement.append(result, answer);
  $("reveal-label").textContent = "继续";
  input.blur();
  $("reveal").focus({ preventScroll: true });
  motion.reveal(result);
}
function nextRound() {
  perform("next", () => {
    remember();
    startRound(workspace);
    reviewId = null;
    revealed = workspace.preferences.showAnswer;
    save();
  });
}
function openHistory(id, origin) {
  perform(
    "history",
    () => {
      reviewId = id;
      revealed = true;
    },
    origin,
  );
  $("study-stage").focus({ preventScroll: true });
}
function closeHistory() {
  perform("undo", () => {
    reviewId = null;
    revealed = workspace.preferences.showAnswer;
  });
  $("study-stage").focus({ preventScroll: true });
}
function toggleFromReview(id) {
  perform("undo", () => {
    remember();
    toggleMastered(workspace, id);
    save();
  });
  notify(
    activeProgress(workspace).mastered.includes(id)
      ? "已斩去，可随时撤回"
      : "已恢复，将在下一轮相遇",
  );
}

function openWorkspace(name) {
  motion.clear();
  tab = name;
  reviewId = null;
  // Keep the study layout in the document: workspace unfolds into its place, without an overlay or focus trap.
  $("study").hidden = true;
  $("workspace").hidden = false;
  for (const panel of document.querySelectorAll(".panel"))
    panel.hidden = panel.id !== `panel-${name}`;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"),
    );
  $("settings-trigger").setAttribute("aria-expanded", name === "settings");
  $("deck-trigger").setAttribute(
    "aria-expanded",
    ["decks", "library"].includes(name),
  );
  const names = {
    decks: ["", "词册"],
    library: ["", "条目"],
    settings: ["", "设置"],
    backup: ["", "备份"],
    help: ["", "帮助"],
  };
  $("workspace-eyebrow").textContent = names[name][0];
  $("workspace-heading").textContent = names[name][1];
  if (name === "decks") renderDecks();
  if (name === "library") {
    libraryLimit = 100;
    renderLibrary();
  }
  applyPreferences();
  motion.enter($("workspace"));
  $("workspace-heading").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function closeWorkspace() {
  motion.clear();
  tab = null;
  $("workspace").hidden = true;
  $("study").hidden = false;
  $("settings-trigger").setAttribute("aria-expanded", "false");
  $("deck-trigger").setAttribute("aria-expanded", "false");
  renderStudy();
  motion.enter(
    $("reading-column") || document.querySelector(".reading-column"),
  );
  $("study-stage").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function renderDecks() {
  $("deck-list").replaceChildren();
  for (const deck of workspace.decks) {
    const p = workspace.progress.find((p) => p.deckId === deck.id),
      row = element(
        "div",
        `deck-row${deck.id === workspace.activeDeckId ? " is-current" : ""}`,
      ),
      info = element("div");
    info.append(
      element("h3", "", deck.title),
      element(
        "p",
        "",
        `${deck.cards.length} 条 · 已斩 ${p.mastered.length} 条 · 修订 ${deck.revision}`,
      ),
    );
    row.append(
      info,
      button(
        deck.id === workspace.activeDeckId ? "继续翻读 →" : "翻开 →",
        () => {
          workspace.activeDeckId = deck.id;
          reviewId = null;
          revealed = workspace.preferences.showAnswer;
          resetUndo();
          save();
          closeWorkspace();
        },
      ),
    );
    $("deck-list").append(row);
  }
}
function renderLibrary() {
  const deck = activeDeck(workspace),
    p = activeProgress(workspace),
    list = $("library-list");
  list.replaceChildren();
  if (!deck) {
    $("library-count").textContent = "先导入一本词册。";
    $("library-more").hidden = true;
    return;
  }
  const query = $("library-search").value.trim().toLocaleLowerCase(),
    filter = $("library-filter").value,
    mastered = new Set(p.mastered);
  const cards = deck.cards.filter(
    (c) =>
      (c.prompt + "\n" + c.answer).toLocaleLowerCase().includes(query) &&
      (filter === "all" || (filter === "mastered") === mastered.has(c.id)),
  );
  $("library-count").textContent =
    `${cards.length} 条 · 当前词册已斩 ${p.mastered.length} 条`;
  for (const card of cards.slice(0, libraryLimit)) {
    const row = element(
      "div",
      `library-row${mastered.has(card.id) ? " is-mastered" : ""}`,
    );
    const action = button(mastered.has(card.id) ? "恢复" : "斩去", () => {
      remember();
      toggleMastered(workspace, card.id);
      save();
      renderStudy();
      renderLibrary();
      // Restore keyboard focus after list rendering without interpolating imported IDs into selectors.
      [...list.querySelectorAll("button")]
        .find((b) => b.dataset.cardId === card.id)
        ?.focus({ preventScroll: true });
    });
    action.dataset.cardId = card.id;
    action.setAttribute(
      "aria-label",
      `${mastered.has(card.id) ? "恢复" : "斩去"} ${card.prompt}`,
    );
    row.append(
      element("strong", "", card.prompt),
      element("p", "", card.answer),
      action,
    );
    list.append(row);
  }
  $("library-more").hidden = cards.length <= libraryLimit;
}
async function readDeck(file) {
  if (!file) return;
  pendingDeck = null;
  $("import-preview").hidden = true;
  $("import-error").hidden = true;
  try {
    if (file.size > MAX_DECK_BYTES)
      throw Error("词册文件超过 10 MiB，请拆分后导入");
    const deck = parseDeck(await file.text(), file.name),
      plan = planImport(workspace, deck);
    if (plan.kind === "new" && workspace.decks.length >= 100)
      throw Error("当前手帖最多保存 100 本词册");
    pendingDeck = deck;
    $("import-title").textContent =
      `${plan.kind === "new" ? "添入" : "更新"}「${deck.title}」`;
    $("import-description").textContent =
      `${deck.cards.length} 条 · 修订 ${deck.revision}` +
      (plan.kind === "update"
        ? ` · 新增 ${plan.added}，内容变化 ${plan.changed}，移除 ${plan.removed}。相同 ID 的进度保留，内容变化的条目重新学习。`
        : " · 文件只在本地读取。");
    $("import-sample").textContent = deck.cards
      .slice(0, 3)
      .map((c) => `${c.prompt} — ${c.answer.slice(0, 120)}`)
      .join("\n");
    $("import-preview").hidden = false;
    motion.enter($("import-preview"));
    $("confirm-import").focus({ preventScroll: true });
  } catch (error) {
    $("import-error").textContent = error.message;
    $("import-error").hidden = false;
  }
}
function download(value, name) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    ),
    link = element("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function readBackup(file) {
  if (!file) return;
  pendingBackup = null;
  $("backup-preview").hidden = true;
  $("backup-error").hidden = true;
  try {
    if (file.size > 50 * 1024 * 1024) throw Error("备份文件超过 50 MiB");
    const value = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
    pendingBackup = validateWorkspace(value);
    $("backup-description").textContent =
      `${pendingBackup.decks.length} 本词册，${pendingBackup.decks.reduce((n, d) => n + d.cards.length, 0)} 条内容，${pendingBackup.progress.reduce((n, p) => n + p.totalReviews, 0)} 次学习。`;
    $("backup-preview").hidden = false;
    motion.enter($("backup-preview"));
    $("confirm-backup").focus({ preventScroll: true });
  } catch (error) {
    $("backup-error").textContent =
      error instanceof SyntaxError ? "备份 JSON 语法不正确" : error.message;
    $("backup-error").hidden = false;
  }
}

function bind() {
  $("again").onclick = () => rate("again");
  $("master").onclick = () => rate("master");
  $("reveal").onclick = reveal;
  $("undo").onclick = undo;
  $("settings-trigger").onclick = () =>
    tab === "settings" ? closeWorkspace() : openWorkspace("settings");
  $("deck-trigger").onclick = () =>
    tab === "decks" ? closeWorkspace() : openWorkspace("decks");
  $("current-deck").onclick = () => openWorkspace("decks");
  $("close-workspace").onclick = closeWorkspace;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => (b.onclick = () => openWorkspace(b.dataset.tab)));
  $("backup-shortcut").onclick = () => openWorkspace("backup");
  $("mode").onchange = (e) => {
    workspace.preferences.mode = e.target.value;
    revealed = workspace.preferences.showAnswer;
    checked = false;
    save();
  };
  $("order").onchange = (e) => {
    workspace.preferences.order = e.target.value;
    save();
    notify("将在下一轮生效");
  };
  document.querySelectorAll("#theme-options button").forEach(
    (b) =>
      (b.onclick = () => {
        workspace.preferences.theme = b.dataset.theme;
        applyPreferences();
        save();
      }),
  );
  for (const key of ["texture", "motion"])
    $(key).onclick = () => {
      workspace.preferences[key] = !workspace.preferences[key];
      motion.clear();
      applyPreferences();
      save();
    };
  $("restart-round").onclick = () => {
    remember();
    startRound(workspace);
    revealed = workspace.preferences.showAnswer;
    save();
    closeWorkspace();
    notify("已重新开始");
  };
  $("choose-deck").onclick = () => $("deck-file").click();
  $("deck-file").onchange = async (e) => {
    await readDeck(e.target.files[0]);
    e.target.value = "";
  };
  $("confirm-import").onclick = () => {
    if (!pendingDeck) return;
    try {
      importDeck(workspace, pendingDeck);
      pendingDeck = null;
      resetUndo();
      reviewId = null;
      revealed = workspace.preferences.showAnswer;
      $("import-preview").hidden = true;
      save({ explicit: true });
      renderDecks();
      notify("已导入");
    } catch (e) {
      $("import-error").textContent = e.message;
      $("import-error").hidden = false;
    }
  };
  $("cancel-import").onclick = () => {
    pendingDeck = null;
    $("import-preview").hidden = true;
    $("choose-deck").focus();
  };
  const zone = $("drop-zone");
  let dragDepth = 0;
  zone.ondragenter = (e) => {
    e.preventDefault();
    dragDepth++;
    zone.classList.add("is-dragging");
  };
  zone.ondragover = (e) => e.preventDefault();
  zone.ondragleave = () => {
    if (--dragDepth <= 0) {
      dragDepth = 0;
      zone.classList.remove("is-dragging");
    }
  };
  zone.ondrop = (e) => {
    e.preventDefault();
    dragDepth = 0;
    zone.classList.remove("is-dragging");
    if (e.dataTransfer.files.length !== 1) {
      $("import-error").textContent = "请一次导入一个词册文件";
      $("import-error").hidden = false;
      return;
    }
    readDeck(e.dataTransfer.files[0]);
  };
  $("library-search").oninput = () => {
    libraryLimit = 100;
    renderLibrary();
  };
  $("library-filter").onchange = () => {
    libraryLimit = 100;
    renderLibrary();
  };
  $("library-more").onclick = () => {
    libraryLimit += 100;
    renderLibrary();
  };
  $("export-backup").onclick = () =>
    download(
      { ...workspace, exportedAt: new Date().toISOString() },
      `lexora-backup-${localDay()}.json`,
    );
  $("export-deck").onclick = () => {
    const deck = activeDeck(workspace);
    if (!deck) {
      notify("还没有词册可以导出");
      return;
    }
    download(
      deck,
      `lexora-${deck.id.replace(/[^a-zA-Z0-9._-]/g, "-")}-r${deck.revision}.json`,
    );
  };
  $("choose-backup").onclick = () => $("backup-file").click();
  $("backup-file").onchange = async (e) => {
    await readBackup(e.target.files[0]);
    e.target.value = "";
  };
  $("confirm-backup").onclick = () => {
    if (!pendingBackup) return;
    workspace = pendingBackup;
    pendingBackup = null;
    resetUndo();
    reviewId = null;
    revealed = workspace.preferences.showAnswer;
    $("backup-preview").hidden = true;
    save({ explicit: true });
    closeWorkspace();
    notify("已恢复");
  };
  $("cancel-backup").onclick = () => {
    pendingBackup = null;
    $("backup-preview").hidden = true;
    $("choose-backup").focus();
  };
  document.addEventListener("keydown", (e) => {
    if (
      e.isComposing ||
      e.repeat ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey
    )
      return;
    if (e.target.closest("input,textarea,select,[contenteditable=true]")) {
      if (e.key === "Escape") {
        e.target.blur();
        $("reveal").focus({ preventScroll: true });
      }
      return;
    }
    const key = e.key.toLowerCase();
    if (key === "escape") {
      e.preventDefault();
      if (tab) closeWorkspace();
      else if (reviewId) closeHistory();
      return;
    }
    if (e.target.closest("button,a") && ["enter", " "].includes(key)) return;
    if (tab) return;
    if (key === "s") {
      e.preventDefault();
      openWorkspace("settings");
      return;
    }
    if (key === "b") {
      e.preventDefault();
      openWorkspace("decks");
      return;
    }
    if (key === "u") {
      e.preventDefault();
      undo();
      return;
    }
    if (reviewId) return;
    if (key === "enter" || key === " ") {
      e.preventDefault();
      if (currentCard(workspace)) reveal();
      else if (activeDeck(workspace)) nextRound();
    } else if (key === "j" || key === "arrowleft") {
      e.preventDefault();
      rate("again");
    } else if (key === "x" || key === "arrowright") {
      e.preventDefault();
      rate("master");
    }
  });
  // Desktop shortcuts never intercept typing; touch paths do not rely on shortcuts.
  matchMedia("(max-width:760px)").addEventListener("change", () => {
    if (!tab) renderHistory();
  });
}

async function boot() {
  try {
    const saved = await loadWorkspace();
    workspace = saved ? validateWorkspace(saved) : createWorkspace(demoDeck);
  } catch (error) {
    workspace = createWorkspace(demoDeck);
    blockAutosave = true;
    storageWarning(
      "本地手帖未能读取，已进入临时示例。原数据不会被自动覆盖；可导入备份恢复，或导入新词册后明确开始。",
    );
  }
  revealed = workspace.preferences.showAnswer;
  bind();
  renderStudy();
  if (!blockAutosave) save();
}
boot();
