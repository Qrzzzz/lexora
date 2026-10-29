import { createLoadingPoemPlayer } from "./poem-player.js";
import { sitePoems } from "./poems.js";

// Native-page adapter only. The document site's player, poems and CSS are copied
// unchanged; route hydration is replaced by Lexora's IndexedDB/preset readiness.
const overlay = document.getElementById("site-loading");
const notebook = document.querySelector(".notebook");
notebook.inert = true;
const player = createLoadingPoemPlayer({
  root: overlay.querySelector("[data-poem-player]"),
  poems: sitePoems,
});
player.start();
let continueLoading;
const continued = new Promise((resolve) => {
  continueLoading = resolve;
});
const timer = setTimeout(() => {
  overlay.querySelector("[data-loading-recovery]").hidden = false;
}, 6000);
overlay.querySelector("[data-loading-retry]").onclick = () => location.reload();
overlay.querySelector("[data-loading-continue]").onclick = () =>
  continueLoading();
export const loading = {
  continued,
  allowContinue() {
    overlay.querySelector("[data-loading-continue]").disabled = false;
  },
  finish() {
    clearTimeout(timer);
    player.destroy();
    overlay.remove();
    notebook.inert = false;
  },
};
