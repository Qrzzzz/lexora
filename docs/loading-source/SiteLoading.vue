<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vitepress";
import { sitePoems } from "./sitePoems.mjs";
import { createLoadingPoemPlayer } from "./loadingPoemRuntime.mjs";

const router = useRouter();
const visible = ref(true);
const boot = ref(true);
const poemRoot = ref<HTMLElement | null>(null);
let player: ReturnType<typeof createLoadingPoemPlayer> | undefined;
let pending = "";
let reveal: ReturnType<typeof setTimeout> | undefined;
let bailout: ReturnType<typeof setTimeout> | undefined;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
const before = router.onBeforePageLoad;
const after = router.onAfterRouteChange;

function clearTimers() {
  clearTimeout(reveal);
  clearTimeout(bailout);
  clearTimeout(recoveryTimer);
}

function showRecovery() {
  const controls = document.querySelector<HTMLElement>('.site-loading [data-loading-recovery]');
  if (controls) controls.hidden = false;
}

function continueReading() {
  if (boot.value) return; // The standalone bootstrap owns first-paint recovery.
  finish();
  void nextTick(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;
    if (!main.hasAttribute('tabindex')) {
      main.setAttribute('tabindex', '-1');
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
    main.focus({ preventScroll: true });
  });
}

function retryLoading() {
  if (!boot.value) window.location.reload();
}

function finish() {
  clearTimers();
  player?.destroy();
  player = undefined;
  visible.value = false;
  pending = "";
  document.documentElement.classList.remove("site-boot-loading");
}

const start: NonNullable<typeof router.onBeforePageLoad> = async (to) => {
  const result = await before?.(to);
  if (result === false) return false;
  if (new URL(to, location.href).pathname === router.route.path) { finish(); return; }
  if (pending === to) return;
  clearTimers();
  pending = to;
  reveal = setTimeout(async () => {
    visible.value = true;
    await nextTick();
    if (!visible.value || pending !== to || !poemRoot.value) return;
    player?.destroy();
    player = createLoadingPoemPlayer({ root: poemRoot.value, poems: sitePoems });
    player.start();
  }, 180);
  // A stalled request must never leave the reading surface covered indefinitely.
  recoveryTimer = setTimeout(showRecovery, 6000);
  bailout = setTimeout(finish, 12000);
};

const complete: NonNullable<typeof router.onAfterRouteChange> = async (to) => {
  try {
    await after?.(to);
  } finally {
    await nextTick();
    if (pending === to) finish();
  }
};

function finishBoot() {
  finish();
  boot.value = false;
}

onMounted(() => {
  document.addEventListener("site-loading-finished", finishBoot, { once: true });
  if (document.documentElement.classList.contains("site-boot-loading")) {
    document.dispatchEvent(new Event("site-loading-ready"));
  } else {
    finishBoot();
  }
  router.onBeforePageLoad = start;
  router.onAfterRouteChange = complete;
});

onBeforeUnmount(() => {
  document.removeEventListener("site-loading-finished", finishBoot);
  finish();
  if (router.onBeforePageLoad === start) router.onBeforePageLoad = before;
  if (router.onAfterRouteChange === complete) router.onAfterRouteChange = after;
});
</script>

<template>
  <div
    v-if="visible"
    class="site-loading"
    :data-poem-count="sitePoems.length"
    :class="{ 'site-loading--boot': boot }"
    role="status"
    aria-live="polite"
    aria-label="Loading"
    lang="en"
  >
    <div class="site-loading__composition" aria-hidden="true">
      <div class="site-loading__heading">
        <div class="site-loading__title">
          <span v-for="(letter, index) in 'loading'" :key="index" :style="{ '--letter': index }">{{ letter }}</span>
        </div>
      </div>
      <div class="site-loading__poem-stage">
        <div ref="poemRoot" class="site-loading__poem" data-poem-player data-allow-mismatch>
          <div class="site-loading__poem-ghost" data-poem-ghost></div>
          <div class="site-loading__poem-live"><span data-poem-text></span><span class="site-loading__cursor">_</span></div>
          <p class="site-loading__attribution" lang="en">Words by <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" tabindex="-1">ChatGPT 6 Astra</a></p>
        </div>
      </div>
    </div>
    <div class="site-loading__recovery" data-loading-recovery data-allow-mismatch="attribute" hidden role="group" aria-label="Loading options">
      <p>Still loading. You can continue reading or try again.</p>
      <button type="button" data-loading-continue @click="continueReading">Continue reading</button>
      <button type="button" data-loading-retry @click="retryLoading">Retry</button>
    </div>
  </div>
</template>

<style scoped>
.site-loading, .site-loading * { box-sizing: border-box; }
.site-loading {
  position: fixed;
  inset: 0;
  z-index: 100;
  padding: 0;
  color: var(--site-accent);
  background: var(--site-canvas);
  pointer-events: none;
  overflow: hidden;
}
.site-loading--boot { visibility: hidden; }
.site-loading__recovery[hidden] { display: none; }
.site-loading__recovery {
  position: absolute;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 0 24px;
  width: min(100% - 64px, 640px);
  background: var(--site-canvas);
  color: var(--site-text-muted);
  font-family: var(--site-font-sans);
  font-size: 14px;
  line-height: 1.6;
  pointer-events: auto;
}
.site-loading__recovery p { flex-basis: 100%; margin: 0; }
.site-loading__recovery button { border: 0; padding: 0; background: transparent; font: inherit; min-height: 44px; color: var(--site-accent); text-decoration: underline; text-underline-offset: 4px; cursor: pointer; }
.site-loading__recovery button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.site-loading:has([data-loading-recovery]:not([hidden])) .site-loading__composition { height: calc(100% - 124px); padding-bottom: 16px; }
:global(html.site-boot-loading .site-loading--boot) {
  visibility: visible;
}
.site-loading__composition {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 40px;
  width: min(100% - 96px, 640px);
  height: 100%;
  margin-inline: auto;
  padding-block: 40px;
}
.site-loading__heading {
  flex: 0 0 auto;
}
.site-loading__title {
  display: flex;
  justify-content: flex-start;
  font-family: var(--site-font-mono);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.3;
  letter-spacing: .08em;
}
.site-loading__title span {
  display: inline-block;
  animation: loading-letter 2.6s ease-in-out infinite;
  animation-delay: calc(var(--letter) * 90ms);
}
.site-loading__poem-stage {
  display: flex;
  min-width: 0;
  max-height: 100%;
  overflow-y: auto;
  font-size: clamp(30px, 2.5vw, 38px);
}
.site-loading__poem {
  display: grid;
  width: min(100%, 28ch);
  min-width: 0;
  font-family: var(--site-font-reading);
  color: var(--site-text);
  text-align: left;
  line-height: 1.6;
  font-weight: 400;
  overflow-wrap: anywhere;
}
.site-loading__poem[data-form="verse"] { width: max-content; max-width: 100%; }
.site-loading__poem:lang(zh-CN) { letter-spacing: .035em; }
.site-loading__poem:lang(en) {
  font-family: "Newsreader", var(--site-font-reading);
  font-size: clamp(36px, 3.1vw, 50px);
  line-height: 1.34;
  letter-spacing: -.018em;
}
.site-loading__poem-ghost, .site-loading__poem-live {
  grid-area: 1 / 1;
  white-space: pre-wrap;
  min-width: 0;
}
.site-loading__poem-ghost { visibility: hidden; }
.site-loading__attribution {
  grid-area: 2 / 1;
  margin: 28px 0 0;
  font-family: var(--site-font-sans);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: .02em;
  color: var(--site-text-muted);
}
.site-loading__attribution a, .site-loading__attribution a:hover { color: var(--site-text); text-decoration: none; background: none; cursor: default; pointer-events: auto; }
.site-loading__cursor {
  display: inline-block;
  width: .65em;
  margin-left: .06em;
  font-family: var(--site-font-mono);
  font-size: .7em;
  font-weight: 500;
  line-height: 1;
  color: var(--site-accent);
  letter-spacing: 0;
  text-shadow:
    0 0 3px color-mix(in srgb, var(--site-accent) 40%, transparent),
    0 0 8px color-mix(in srgb, var(--site-accent) 16%, transparent);
}
[data-cursor="hidden"] .site-loading__cursor,
.site-loading__poem:not([data-cursor]) .site-loading__cursor { opacity: 0; }
[data-cursor="blinking"] .site-loading__cursor { animation: loading-cursor .6s steps(1, end) 3; }
@keyframes loading-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes loading-letter {
  0%, 60%, 100% { opacity: .7; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-1px); }
}
@media (max-width: 680px) {
  .site-loading__composition { width: calc(100% - 64px); gap: 28px; }
  .site-loading__title { font-size: 12px; }
  .site-loading__poem-stage {
    font-size: clamp(22px, 6.9vw, 28px);
  }
  .site-loading__poem:lang(en) { font-size: clamp(27px, 8vw, 34px); line-height: 1.32; }
  .site-loading__attribution { margin-top: 22px; font-size: 12px; }
}
@media (max-height: 560px) and (min-width: 681px) {
  .site-loading__composition { gap: 24px; padding-block: 24px; }
  .site-loading__poem-stage { font-size: clamp(22px, 2.8vw, 26px); }
  .site-loading__poem { line-height: 1.4; }
  .site-loading__poem:lang(en) { font-size: clamp(27px, 3.4vw, 32px); line-height: 1.28; }
  .site-loading__attribution { margin-top: 18px; }
}
@media (max-height: 600px) and (max-width: 680px) {
  .site-loading__poem-stage { font-size: 22px; }
  .site-loading__poem:lang(en) { font-size: 27px; }
}
@media (prefers-reduced-motion: reduce) {
  .site-loading__title span { animation: none; }
  .site-loading__cursor { animation: none; }
}
</style>
