const patterns = {
  next: 8,
  master: [16, 26, 8],
  undo: [7, 20, 12],
  settings: 5,
};

// Browser-provided vibration only. Audio is reserved for a later iteration.
export function createFeedback(preferences) {
  return {
    perform(kind) {
      if (
        !preferences().haptics ||
        typeof navigator.vibrate !== "function" ||
        !matchMedia("(pointer:coarse)").matches
      )
        return;
      try {
        navigator.vibrate(patterns[kind] ?? patterns.settings);
      } catch {}
    },
  };
}
