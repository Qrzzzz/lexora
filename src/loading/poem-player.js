/** Shared by the pre-hydration loader and client navigation; no Vue dependency. */
export function createLoadingPoemPlayer({
  root, poems, random = Math.random, schedule = setTimeout,
  cancel = clearTimeout, now = () => performance.now(),
  cycleMs = 30000, shuffle = false
}) {
  const doc = root.ownerDocument;
  const motion = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const ghost = root.querySelector('[data-poem-ghost]');
  const output = root.querySelector('[data-poem-text]');
  let timer;
  let task;
  let active = false;
  let disposed = false;
  let poem;
  let letters = [];
  let count = 0;
  let startedAt = 0;
  let pausedAt = 0;
  let paused = false;
  let suspended = false;
  let bag = [];
  let lastId;

  function clear() {
    if (timer !== undefined) cancel(timer);
    timer = undefined;
    task = undefined;
  }

  function later(delay, callback) {
    clear();
    task = { delay, callback, due: now() + delay };
    if (suspended) return;
    timer = schedule(() => {
      timer = undefined;
      task = undefined;
      if (active && !disposed) callback();
    }, delay);
  }

  function render() { output.textContent = letters.slice(0, count).join(''); }
  function phase(value, cursor) {
    root.dataset.phase = value;
    root.dataset.cursor = cursor;
  }
  function hold() {
    phase('holding', 'hidden');
    later(Math.max(0, cycleMs - ((suspended ? pausedAt : now()) - startedAt)), erase);
  }
  function complete() {
    if (motion?.matches) { hold(); return; }
    phase('settling', 'blinking');
    later(1800, hold);
  }
  function type() {
    if (count >= letters.length) { complete(); return; }
    count += 1;
    render();
    const letter = letters[count - 1];
    const base = poem.lang === 'en' ? 13 : 22;
    later(/[，。；！？,.!?;\n]/u.test(letter) ? base * 2 : base, type);
  }
  function erase() {
    phase('erasing', 'typing');
    if (motion?.matches) {
      count = 0;
      render();
      next();
      return;
    }
    if (count > 0) {
      count -= 1;
      render();
      later(poem.lang === 'en' ? 9 : 15, erase);
    } else {
      phase('between', 'hidden');
      later(240, next);
    }
  }
  function next() {
    const previous = shuffle ? lastId : doc.documentElement.dataset.loadingLastPoem;
    const candidates = poems.filter(item => String(item.id) !== String(previous));
    const pool = candidates.length ? candidates : poems;
    if (shuffle) {
      if (!bag.length) {
        bag = [...poems];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.min(i, Math.floor(Math.max(0, random()) * (i + 1)));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && String(bag.at(-1).id) === String(previous)) {
          [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
      }
      poem = bag.pop();
    } else {
      poem = pool[Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length))];
    }
    if (!poem) return;
    lastId = poem.id;
    if (!shuffle) doc.documentElement.dataset.loadingLastPoem = String(poem.id);
    root.dataset.poemId = String(poem.id);
    root.dataset.form = poem.form;
    root.lang = poem.lang;
    // Full-text geometry prevents reflow while characters enter and leave.
    ghost.textContent = poem.text + '\u00a0_';
    letters = Array.from(poem.text);
    count = motion?.matches ? letters.length : 0;
    startedAt = suspended ? pausedAt : now();
    phase('typing', motion?.matches ? 'hidden' : 'typing');
    render();
    if (motion?.matches) hold();
    else later(100, type);
  }
  function visibility() {
    if (!active) return;
    const shouldSuspend = doc.hidden || paused;
    if (shouldSuspend === suspended) return;
    suspended = shouldSuspend;
    if (suspended) {
      pausedAt = now();
      if (task) task.delay = Math.max(0, task.due - now());
      if (timer !== undefined) cancel(timer);
      timer = undefined;
    } else {
      startedAt += now() - pausedAt;
      if (task) later(task.delay, task.callback);
    }
  }
  function motionChange() {
    if (!active || !poem) return;
    clear();
    count = letters.length;
    render();
    hold();
  }
  doc.addEventListener('visibilitychange', visibility);
  motion?.addEventListener('change', motionChange);
  return {
    start() {
      if (disposed || active) return;
      active = true;
      pausedAt = now();
      suspended = doc.hidden || paused;
      next();
    },
    pause(value = true) {
      paused = value;
      visibility();
    },
    next() {
      if (!active || disposed || root.dataset.phase === 'erasing' || root.dataset.phase === 'between') return;
      clear();
      erase();
    },
    destroy() {
      active = false;
      disposed = true;
      clear();
      doc.removeEventListener('visibilitychange', visibility);
      motion?.removeEventListener('change', motionChange);
      phase('idle', 'hidden');
    }
  };
}

/** Runs before the app bundle: slow first visits get the same poem animation. */
export function bootstrapLoadingPoem(poems, createPlayer) {
  const doc = document;
  let player;
  let dismissal;
  let watchdog;
  let recoveryTimer;
  let failed = false;
  let done = false;
  let ready = false;
  let shownAt;
  const observer = new MutationObserver(attach);
  function attach() {
    if (done || player) return;
    const root = doc.querySelector('.site-loading [data-poem-player]');
    if (!root) return;
    observer.disconnect();
    player = createPlayer({ root, poems });
    player.start();
    if (failed) showRecovery();
    // Start the minimum exposure after a painted frame, not while HTML is arriving.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (done) return;
      shownAt = performance.now();
      settle();
    }));
  }
  function settle() {
    if (done || !ready || shownAt === undefined) return;
    const styles = [...doc.querySelectorAll('link[data-site-boot-style]')];
    if (styles.some(link => !link.sheet && link.dataset.siteStyleReady !== 'true')) return;
    clearTimeout(dismissal);
    dismissal = setTimeout(finish, Math.max(0, 700 - (performance.now() - shownAt)));
  }
  function appReady() {
    ready = true;
    settle();
  }
  function showRecovery() {
    const controls = doc.querySelector('.site-loading [data-loading-recovery]');
    if (controls) controls.hidden = false;
  }
  function resourceFailed(event) {
    if (!['SCRIPT', 'LINK'].includes(event.target?.tagName)) return;
    failed = true;
    showRecovery();
    clearTimeout(watchdog);
    watchdog = setTimeout(finish, 6000);
  }
  function action(event) {
    if (!event.target?.closest?.('.site-loading [data-loading-recovery]')) return;
    if (event.target.closest('[data-loading-continue]')) {
      finish();
      const main = doc.querySelector('main');
      if (main) {
        const hadTabindex = main.hasAttribute('tabindex');
        if (!hadTabindex) {
          main.setAttribute('tabindex', '-1');
          main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
        }
        main.focus({ preventScroll: true });
      }
    } else if (event.target.closest('[data-loading-retry]')) doc.defaultView?.location.reload();
  }
  function finish() {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(dismissal);
    clearTimeout(watchdog);
    clearTimeout(recoveryTimer);
    player?.destroy();
    doc.documentElement.classList.remove('site-boot-loading');
    doc.removeEventListener('site-loading-ready', appReady);
    doc.removeEventListener('site-loading-style-ready', settle);
    doc.removeEventListener('click', action);
    doc.removeEventListener('error', resourceFailed, true);
    doc.dispatchEvent(new Event('site-loading-finished'));
  }
  doc.documentElement.classList.add('site-boot-loading');
  doc.addEventListener('site-loading-ready', appReady, { once: true });
  doc.addEventListener('site-loading-style-ready', settle);
  // Native event handlers work even when the application bundle never starts.
  doc.addEventListener('click', action);
  doc.addEventListener('error', resourceFailed, true);
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  attach();
  recoveryTimer = setTimeout(showRecovery, 6000);
  // A broken startup must release SSR quickly, including when no root arrived.
  watchdog = setTimeout(finish, 12000);
}
