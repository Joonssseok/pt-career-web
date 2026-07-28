// One failing step (e.g. an FK violation, a network hiccup) must not stop the
// rest — otherwise fixture users/profiles are left behind. See docs/report
// (2026-07-28) for a real incident where this leaked live public profiles.
export async function safeCleanup(steps: Array<() => Promise<unknown>>): Promise<void> {
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      console.error('cleanup step failed (continuing):', error);
    }
  }
}
