import {
  parseDeck,
  MAX_DECK_BYTES,
  canSpell,
  matchesAnswer,
  cardTerm,
  cardSummary,
  cardDefinition,
  pronunciationLabel,
} from "./deck.js";
import { demoDeck } from "./demo.js";
import { presets, loadPreset } from "./presets.js";
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
import { createFeedback } from "./feedback.js";
import { installControlFeedback } from "./controls.js";
import { loading } from "./loading/index.js";
import { icon } from "./icons.js";
import { createTextPressure } from "./pressure.js";
import { resolveTheme } from "./themes.js";
import {
  renderThemeChoices,
  applyTheme,
  bindThemeControls,
} from "./theme-controls.js";
import { actionIcon } from "./action-icons.js";
import { workspaceTabs } from "./config.js";
import { copyStudyPoster } from "./share.js";
const $ = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (text, action, className = "text-button", iconName) => {
  const node = element("button", className, text);
  if (iconName) node.prepend(icon(iconName));
  node.type = "button";
  node.onclick = action;
  return node;
};
let workspace,
  screen = "home",
  workspaceOrigin = "home",
  routeReady = false,
  tab = null,
  reviewId = null,
  revealed = false,
  checked = false,
  pendingDeck = null,
  pendingBackup = null,
  entryId = null,
  entryReturn = null,
  presetError = "",
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
  () => currentCard(workspace),
);
const feedback = createFeedback(() => workspace?.preferences || {});
const pressure = createTextPressure(
  $("study-stage"),
  () => !!workspace?.preferences.motion && screen === "study" && !tab,
);
const systemDark = matchMedia("(prefers-color-scheme: dark)");
function route(view, replace = false) {
  if (!routeReady) return;
  if (history.state?.view !== view)
    history[replace ? "replaceState" : "pushState"](
      { view, entryId: view === "entry" ? entryId : null },
      "",
      `#${view}`,
    );
}
function showHome(record = true) {
  motion.clear();
  pressure.reset();
  screen = "home";
  tab = null;
  reviewId = null;
  $("study").hidden = true;
  $("workspace").hidden = true;
  $("home").hidden = false;
  $("settings-trigger").setAttribute("aria-expanded", false);
  renderHome();
  if (record) route("home");
  $("home-title").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function showStudy(record = true) {
  if (!activeDeck(workspace)) {
    showHome(record);
    return;
  }
  motion.clear();
  screen = "study";
  tab = null;
  reviewId = null;
  $("home").hidden = true;
  $("workspace").hidden = true;
  $("study").hidden = false;
  $("settings-trigger").setAttribute("aria-expanded", false);
  renderStudy();
  if (record) route("study");
  $("study-stage").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function chooseDeck(id) {
  if (workspace.activeDeckId !== id) resetUndo();
  workspace.activeDeckId = id;
  revealed = false;
  save();
  showStudy();
}
async function beginPreset(preset) {
  $("home-error").hidden = true;
  loading.show({ canContinue: true });
  try {
    const deck = await Promise.race([
      loadPreset(preset),
      loading.continued.then(() => null),
    ]);
    if (!deck) return;
    resetUndo();
    importDeck(workspace, deck);
    chooseDeck(deck.id);
  } catch (error) {
    $("home-error").textContent = error.message;
    $("home-error").hidden = false;
  } finally {
    loading.finish();
  }
}
function renderHome() {
  const list = $("home-decks");
  list.replaceChildren();
  const add = (title, detail, action, label) => {
    const row = element("article", "home-deck");
    const text = element("div", "home-deck-copy");
    text.append(element("h2", "", title), element("p", "", detail));
    row.append(
      text,
      button(label, action, "text-button home-start", "arrow-right"),
    );
    list.append(row);
  };
  for (const deck of workspace.decks) {
    const p = workspace.progress.find((p) => p.deckId === deck.id);
    add(
      presets.find((preset) => preset.deckId === deck.id)?.title || deck.title,
      `${deck.cards.length.toLocaleString("zh-CN")} ${deck.cards.some((c) => c.type === "knowledge") ? "条" : "词"}${p.mastered.length ? ` · 已记住 ${p.mastered.length}` : ""}`,
      () => chooseDeck(deck.id),
      "继续",
    );
  }
  for (const preset of presets)
    if (!workspace.decks.some((d) => d.id === preset.deckId))
      add(
        preset.title,
        `${preset.count.toLocaleString("zh-CN")} 词`,
        () => beginPreset(preset),
        "开始",
      );
}
function notify(text, visible = false) {
  clearTimeout(toastTimer);
  $("toast").textContent = text;
  $("toast").dataset.visible = String(visible);
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2700);
}
function storageWarning(message) {
  storageOK = false;
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
  $("backup-shortcut").replaceChildren(
    icon("download"),
    document.createTextNode("请导出备份"),
  );
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
function remember(action = "edit") {
  const p = activeProgress(workspace);
  if (!p) return;
  const serialized = JSON.stringify({
    deckId: workspace.activeDeckId,
    progress: p,
    action,
    revealed,
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
  pressure.reset();
  const previous = motion.captureHistory($("history-list"));
  const capture = motion.capture(kind);
  action();
  renderStudy(previous);
  motion.play(capture, kind, origin);
}
function applyPreferences() {
  const p = workspace.preferences;
  applyTheme(p, systemDark.matches);
  document.documentElement.classList.toggle("no-motion", !p.motion);
  $("mode").value = p.mode;
  $("order").value = p.order;
  $("history-display").value = p.historyDisplay;
  $("restart-round").disabled = !activeDeck(workspace);
  $("motion").setAttribute("aria-checked", p.motion);
  $("sound").setAttribute("aria-checked", false);
  $("haptics").setAttribute("aria-checked", p.haptics);
  $("haptics-note").hidden = typeof navigator.vibrate === "function";
}
function renderHistory(previous = motion.captureHistory($("history-list"))) {
  const deck = activeDeck(workspace),
    p = activeProgress(workspace),
    list = $("history-list");
  list.replaceChildren();
  const cards = new Map(deck?.cards.map((c) => [c.id, c]) || []),
    events = (p?.recent || [])
      .filter((e) => cards.has(e.cardId))
      .slice(workspace.preferences.historyDisplay === "summary" ? -6 : -8);
  document.querySelector(".recollection").dataset.display =
    workspace.preferences.historyDisplay;
  $("history-empty").hidden = !!events.length;
  for (let i = 0; i < events.length; i++) {
    const event = events[i],
      card = cards.get(event.cardId),
      age = events.length - 1 - i;
    const b = button(
      "",
      () => openHistory(card.id, b.getBoundingClientRect()),
      "history-entry",
    );
    b.classList.toggle("is-mastered", p.mastered.includes(card.id));
    b.classList.toggle(
      "has-history-ink",
      /[a-z]/i.test(cardTerm(card)) && !/[\u3400-\u9fff]/.test(cardTerm(card)),
    );
    b.dataset.cardId = card.id;
    b.dataset.eventId = event.eventId;
    b.setAttribute("aria-label", `回看 ${cardTerm(card)}`);
    b.setAttribute("aria-pressed", reviewId === card.id);
    b.style.setProperty("--history-opacity", String(1 - age * 0.075));
    b.style.setProperty(
      "--history-blur",
      `${age * (workspace.preferences.historyDisplay === "summary" ? 0.56 : 0.48)}px`,
    );
    const term = element("span", "history-term");
    term.append(element("span", "history-word", cardTerm(card)));
    b.append(term);
    if (workspace.preferences.historyDisplay === "summary") {
      const summary = element("span", "history-summary");
      summary.append(
        element("span", "history-summary-text", cardSummary(card)),
      );
      b.append(summary);
    }
    list.append(b);
  }
  motion.history(list, previous);
}
function renderStudy(previous = motion.captureHistory($("history-list"))) {
  motion.clear();
  applyPreferences();
  const deck = activeDeck(workspace),
    p = activeProgress(workspace),
    stage = $("study-stage");
  stage.replaceChildren();
  $("study-controls").hidden = false;
  $("undo").disabled = !undoStack.length;
  const lastAction = undoStack.length
    ? JSON.parse(undoStack.at(-1)).action
    : null;
  const undoLabel =
    lastAction === "next" || lastAction === "round" ? "上一个" : "撤回";
  $("undo").replaceChildren(
    icon("undo-2"),
    element("span", "control-label", undoLabel),
  );
  $("undo").setAttribute("aria-label", undoLabel);
  $("current-deck").textContent = deck?.title || "选择一本词册";
  const today = workspace.progress.reduce(
    (sum, p) => sum + (p.daily[localDay()] || 0),
    0,
  );
  $("daily-count").textContent = `今日 ${today}`;
  renderHistory(previous);
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
    : `第 ${p.round.number} 轮 · 熟悉的收好，陌生的再见。`;
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
  if (reviewId && p.mastered.includes(card.id))
    stage.append(element("span", "review-badge", "已记住"));
  const spell =
    !reviewId && workspace.preferences.mode === "spelling" && canSpell(card);
  const prompt =
    spell && card.type === "vocabulary" ? cardSummary(card) : cardTerm(card);
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
  const termButton = button(prompt, () => openEntry(card.id), "term-button");
  termButton.setAttribute("aria-label", `查看「${cardTerm(card)}」词条`);
  heading.replaceChildren(termButton);
  pressure.attach(!spell && card.type === "vocabulary" ? termButton : null);
  if (!spell && card.pronunciations?.length)
    stage.append(
      element(
        "div",
        "pronunciation",
        card.pronunciations.map((p) => pronunciationLabel(p, card)).join("   "),
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
      button("返回", closeHistory, "text-button", "arrow-left"),
      button(
        p.mastered.includes(card.id) ? "重新学习" : "记住了",
        () => toggleFromReview(card.id),
        "text-button",
        p.mastered.includes(card.id) ? "undo-2" : "check",
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
    $("reveal").setAttribute(
      "aria-label",
      spell ? "检查拼写" : revealed ? "隐藏释义" : "提示释义",
    );
    $("reveal").setAttribute("aria-pressed", spell ? checked : revealed);
    $("master").setAttribute(
      "aria-label",
      card.type === "vocabulary" ? "记住了这个词" : "标记已经掌握",
    );
  }
  checked = false;
}
function appendAnswer(parent, card) {
  const summary = cardSummary(card);
  const answer = element(
    "div",
    `answer${summary.length > 45 ? " is-long" : ""}`,
    summary,
  );
  answer.lang =
    card.answerLanguage || activeDeck(workspace)?.answerLanguage || "";
  parent.append(answer);
}
function rate(kind) {
  if (screen !== "study" || tab || reviewId || !currentCard(workspace)) return;
  feedback.perform(kind === "master" ? "master" : "next");
  perform(kind === "master" ? "master" : "next", () => {
    remember(kind === "master" ? "master" : "next");
    rateCard(workspace, kind);
    revealed = false;
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
  feedback.perform("undo");
  const previousAction = JSON.parse(undoStack.at(-1)).action;
  const animation =
    previousAction === "master"
      ? "restore"
      : previousAction === "restore"
        ? "master"
        : previousAction === "next" || previousAction === "round"
          ? "previous"
          : "update";
  perform(animation, () => {
    const raw = undoStack.pop(),
      snapshot = JSON.parse(raw);
    undoBytes -= raw.length;
    const at = workspace.progress.findIndex(
      (p) => p.deckId === snapshot.deckId,
    );
    workspace.progress[at] = snapshot.progress;
    workspace.activeDeckId = snapshot.deckId;
    reviewId = null;
    revealed = snapshot.revealed ?? false;
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
    card.type === "vocabulary" ? cardTerm(card) : cardSummary(card),
  );
  input.parentElement.append(result, answer);
  $("reveal-label").textContent = "继续";
  $("reveal").setAttribute("aria-pressed", true);
  $("reveal").setAttribute("aria-label", "继续");
  input.blur();
  $("reveal").focus({ preventScroll: true });
  motion.reveal(result);
}
function nextRound() {
  perform("next", () => {
    remember("round");
    startRound(workspace);
    reviewId = null;
    revealed = false;
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
  perform("previous", () => {
    reviewId = null;
    revealed = false;
  });
  $("study-stage").focus({ preventScroll: true });
}
function toggleFromReview(id) {
  const restoring = activeProgress(workspace).mastered.includes(id);
  perform(restoring ? "restore" : "master", () => {
    remember(restoring ? "restore" : "master");
    toggleMastered(workspace, id);
    save();
  });
  notify(
    activeProgress(workspace).mastered.includes(id)
      ? "已记住，可随时撤回"
      : "已恢复，将在下一轮相遇",
  );
}

function openWorkspace(name, record = true) {
  if (tab === name) return;
  const previousTab = tab;
  if (!tab) workspaceOrigin = screen;
  motion.clear();
  pressure.reset();
  tab = name;
  reviewId = null;
  // Keep the study layout in the document: workspace unfolds into its place, without an overlay or focus trap.
  $("study").hidden = true;
  $("home").hidden = true;
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
    entry: ["", "词条"],
  };
  $("workspace-eyebrow").textContent = names[name][0];
  $("workspace-heading").textContent = names[name][1];
  $("close-workspace").replaceChildren(
    icon("arrow-left"),
    element("span", "control-label", name === "entry" ? "返回学习" : "返回"),
  );
  if (name === "decks") renderDecks();
  if (name === "entry") renderEntry();
  if (name === "library") {
    libraryLimit = 100;
    renderLibrary();
  }
  applyPreferences();
  if (record) route(name);
  const tabs = workspaceTabs.map((t) => t.id);
  if (previousTab && tabs.includes(name)) {
    const direction =
      previousTab === "entry"
        ? -1
        : Math.sign(tabs.indexOf(name) - tabs.indexOf(previousTab)) || 1;
    motion.enter($(`panel-${name}`), { axis: "x", direction, distance: 32 });
  } else if (name === "entry")
    motion.enter($("panel-entry"), { axis: "x", distance: 28 });
  else motion.enter($("workspace"));
  $("workspace-heading").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" });
}
function closeWorkspace() {
  const returnToStudy = tab === "entry" || workspaceOrigin === "study";
  entryReturn = null;
  if (returnToStudy) showStudy(false);
  else showHome(false);
  route(screen, true);
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
        `${deck.cards.length} 条 · 已记住 ${p.mastered.length} 条 · 修订 ${deck.revision}`,
      ),
    );
    row.append(
      info,
      button(
        deck.id === workspace.activeDeckId ? "继续" : "翻开",
        () => {
          workspace.activeDeckId = deck.id;
          reviewId = null;
          revealed = false;
          resetUndo();
          save();
          showStudy();
        },
        "text-button",
        "arrow-right",
      ),
    );
    $("deck-list").append(row);
  }
  renderPresets();
}
function renderPresets() {
  const list = $("preset-list");
  list.replaceChildren();
  for (const preset of presets) {
    if (workspace.decks.some((d) => d.id === preset.deckId)) continue;
    const row = element("div", "preset-row"),
      info = element("div");
    info.append(
      element("h3", "", preset.title),
      element("p", "", `${preset.count.toLocaleString("zh-CN")} 词 · 样例词册`),
    );
    const add = button("导入", async () => {
      add.disabled = true;
      add.textContent = "加载中";
      $("import-error").hidden = true;
      $("import-preview").hidden = true;
      try {
        showImportPreview(await loadPreset(preset));
        presetError = "";
      } catch (e) {
        $("import-error").textContent = e.message;
        $("import-error").hidden = false;
      } finally {
        add.disabled = false;
        add.textContent = "导入";
      }
    });
    const link = element("a", "text-button", "下载");
    link.prepend(icon("download"));
    link.href = preset.url;
    link.download = "lexora-cet4-core.json";
    const actions = element("div", "preset-actions");
    actions.append(add, link);
    row.append(info, actions);
    list.append(row);
  }
  $("preset-heading").hidden = !list.children.length;
  $("preset-error").textContent = presetError;
  $("preset-error").hidden = !presetError;
}
function openEntry(id) {
  entryId = id;
  entryReturn = { tab, reviewId };
  openWorkspace("entry");
}
function renderEntry() {
  const deck = activeDeck(workspace),
    card = deck?.cards.find((c) => c.id === entryId),
    panel = $("panel-entry");
  panel.replaceChildren();
  if (!card) {
    panel.append(element("p", "small-note", "词条不存在"));
    return;
  }
  const article = element("article", "dictionary-entry");
  article.append(element("h2", "entry-term", cardTerm(card)));
  if (card.pronunciations?.length)
    article.append(
      element(
        "p",
        "entry-pronunciations",
        card.pronunciations.map((p) => pronunciationLabel(p, card)).join("　"),
      ),
    );
  if (card.senses) {
    article.append(element("p", "entry-summary", cardSummary(card)));
    for (const sense of card.senses) {
      const group = element("section", "entry-sense"),
        definitions = element("ol");
      group.append(
        element(
          "h3",
          "",
          sense.partOfSpeech === "other" ? "未标词性" : sense.partOfSpeech,
        ),
      );
      for (const definition of sense.definitions)
        definitions.append(element("li", "", definition));
      group.append(definitions);
      article.append(group);
    }
  } else article.append(element("p", "entry-summary", cardDefinition(card)));
  if (card.note) article.append(element("p", "small-note", card.note));
  const references = (deck.sources || []).filter((s) =>
    card.sourceRefs?.includes(s.id),
  );
  if (references.length) {
    const footer = element("footer", "entry-sources");
    footer.append(element("span", "", "来源："));
    references.forEach((source, i) => {
      if (i) footer.append(document.createTextNode(" · "));
      if (source.url) {
        const link = element("a", "", source.title);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener";
        footer.append(link);
      } else footer.append(document.createTextNode(source.title));
    });
    article.append(footer);
  }
  panel.append(article);
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
      (cardTerm(c) + "\n" + cardSummary(c) + "\n" + cardDefinition(c))
        .toLocaleLowerCase()
        .includes(query) &&
      (filter === "all" || (filter === "mastered") === mastered.has(c.id)),
  );
  $("library-count").textContent =
    `${cards.length} 条 · 当前词册已记住 ${p.mastered.length} 条`;
  for (const card of cards.slice(0, libraryLimit)) {
    const row = element(
      "div",
      `library-row${mastered.has(card.id) ? " is-mastered" : ""}`,
    );
    const action = button(mastered.has(card.id) ? "重新学习" : "记住了", () => {
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
      `${mastered.has(card.id) ? "重新学习" : "记住了"} ${cardTerm(card)}`,
    );
    row.append(
      button(cardTerm(card), () => openEntry(card.id), "library-term"),
      element("p", "", cardSummary(card)),
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
    showImportPreview(parseDeck(await file.text(), file.name));
  } catch (error) {
    $("import-error").textContent = error.message;
    $("import-error").hidden = false;
  }
}
function showImportPreview(deck) {
  const plan = planImport(workspace, deck);
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
    .map((c) => `${cardTerm(c)} — ${cardSummary(c).slice(0, 120)}`)
    .join("\n");
  $("import-preview").hidden = false;
  motion.enter($("import-preview"));
  $("confirm-import").focus({ preventScroll: true });
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
  renderThemeChoices($("theme-options"));
  const tabs = document.querySelector(".workspace-tabs");
  tabs.replaceChildren();
  for (const item of workspaceTabs) {
    const tabButton = element("button", "", item.label);
    tabButton.dataset.tab = item.id;
    tabs.append(tabButton);
  }
  for (const [id, kind] of [
    ["master", "keep"],
    ["reveal", "hint"],
    ["again", "next"],
  ]) {
    const el = $(id);
    el.querySelectorAll(".icon,[data-icon]").forEach((node) => node.remove());
    el.prepend(actionIcon(kind));
  }
  $("share-trigger").onclick = async () => {
    const share = $("share-trigger");
    share.disabled = true;
    share.classList.add("is-sharing");
    share.setAttribute("aria-busy", "true");
    try {
      const result = await copyStudyPoster(
        workspace,
        resolveTheme(workspace.preferences, systemDark.matches).tokens,
      );
      notify(
        result.copied ? "海报已复制" : "此浏览器无法复制图片，海报已下载",
        true,
      );
      if (result.copied) {
        share.replaceChildren(icon("check"));
        share.classList.add("is-copied");
      }
    } catch {
      notify("未能生成海报，请重试", true);
    } finally {
      share.disabled = false;
      share.classList.remove("is-sharing");
      share.removeAttribute("aria-busy");
      setTimeout(() => {
        share.replaceChildren(icon("share-2"));
        share.classList.remove("is-copied");
      }, 1800);
    }
  };
  document.querySelector(".skip-link").onclick = (event) => {
    event.preventDefault();
    (tab
      ? $("workspace-heading")
      : screen === "home"
        ? $("home-title")
        : $("study-stage")
    ).focus({ preventScroll: true });
  };
  document.querySelector(".brand").onclick = (e) => {
    e.preventDefault();
    showHome();
  };
  $("home-import").onclick = () => openWorkspace("decks");
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
    revealed = false;
    checked = false;
    save();
  };
  $("order").onchange = (e) => {
    workspace.preferences.order = e.target.value;
    save();
    notify("将在下一轮生效");
  };
  $("history-display").onchange = (e) => {
    workspace.preferences.historyDisplay = e.target.value;
    save();
  };
  bindThemeControls(
    () => workspace.preferences,
    (patch, persist = true) => {
      Object.assign(workspace.preferences, patch);
      applyPreferences();
      if (persist) save();
    },
  );
  for (const key of ["motion", "haptics"])
    $(key).onclick = () => {
      workspace.preferences[key] = !workspace.preferences[key];
      motion.clear();
      applyPreferences();
      save();
    };
  $("restart-round").onclick = () => {
    remember("round");
    startRound(workspace);
    revealed = false;
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
      revealed = false;
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
    revealed = false;
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
    if (tab) return;
    // Keep native activation for navigation and history. In the learning area,
    // these keys always retain their original meaning, even on a focused term.
    if (
      e.target.closest("button,a") &&
      !e.target.closest("#study-stage,#study-controls") &&
      ["enter", " "].includes(key)
    )
      return;
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
    if (screen !== "study") return;
    if (key === "u") {
      e.preventDefault();
      undo();
      return;
    }
    if (reviewId) return;
    if (key === "enter" || key === " ") {
      e.preventDefault();
      if (currentCard(workspace)) {
        if (key === " ") rate("again");
        else reveal();
      } else if (activeDeck(workspace)) nextRound();
    } else if (key === "j" || key === "arrowleft") {
      e.preventDefault();
      rate("again");
    } else if (key === "x" || key === "arrowright") {
      e.preventDefault();
      rate("master");
    }
  });
  // Desktop shortcuts never intercept typing; touch paths do not rely on shortcuts.
  installControlFeedback({
    onInteraction: () => feedback.perform("settings"),
    motionEnabled: () => workspace.preferences.motion,
  });
  matchMedia("(max-width:760px)").addEventListener("change", () => {
    if (!tab && screen === "study") renderHistory();
  });
  systemDark.addEventListener("change", () => {
    if (workspace.preferences.appearance === "system") applyPreferences();
  });
  window.addEventListener("popstate", (event) => {
    const target = event.state?.view || "home";
    if (target === "entry" && event.state?.entryId) {
      entryId = event.state.entryId;
      openWorkspace("entry", false);
    } else if (target === "study" || target === "entry") showStudy(false);
    else if (
      ["settings", "decks", "library", "help", "backup"].includes(target)
    )
      openWorkspace(target, false);
    else showHome(false);
  });
}

async function boot() {
  $("study-stage").setAttribute("aria-busy", "true");
  $("study-controls").hidden = true;
  $("settings-trigger").disabled = true;
  try {
    const saved = await loadWorkspace();
    if (saved) workspace = validateWorkspace(saved);
    else workspace = createWorkspace();
  } catch (error) {
    workspace = createWorkspace(demoDeck);
    blockAutosave = true;
    storageWarning(
      "本地手帖未能读取，已进入临时示例。原数据不会被自动覆盖；可导入备份恢复，或导入新词册后明确开始。",
    );
  }
  revealed = false;
  $("settings-trigger").disabled = false;
  $("study-stage").removeAttribute("aria-busy");
  bind();
  applyPreferences();
  const initialRoute = location.hash.slice(1);
  if (initialRoute === "study" && activeDeck(workspace)) showStudy(false);
  else showHome(false);
  routeReady = true;
  route(screen, true);
  loading.finish();
  if (!blockAutosave) save();
}
boot();
