import { createLoadingPoemPlayer } from "./poem-player.js";
import { sitePoems } from "./poems.js";

const overlay = document.getElementById("site-loading");
const notebook = document.querySelector(".notebook");
let player, timer, continued, continueLoading;
function show({ canContinue = false } = {}) {
  player?.destroy();
  clearTimeout(timer);
  overlay.hidden = false;
  notebook.inert = true;
  overlay.querySelector("[data-loading-recovery]").hidden = true;
  overlay.querySelector("[data-loading-continue]").disabled = !canContinue;
  continued = new Promise((resolve) => {
    continueLoading = resolve;
  });
  player = createLoadingPoemPlayer({
    root: overlay.querySelector("[data-poem-player]"),
    poems: sitePoems,
  });
  player.start();
  timer = setTimeout(() => {
    overlay.querySelector("[data-loading-recovery]").hidden = false;
  }, 6000);
}
overlay.querySelector("[data-loading-retry]").onclick = () => location.reload();
overlay.querySelector("[data-loading-continue]").onclick = () =>
  continueLoading();
export const loading = {
  show,
  get continued() {
    return continued;
  },
  allowContinue() {
    overlay.querySelector("[data-loading-continue]").disabled = false;
  },
  finish() {
    clearTimeout(timer);
    player?.destroy();
    overlay.hidden = true;
    notebook.inert = false;
  },
};
// Independent entry runs ahead of the app; static HTML already shows a poem.
show();
