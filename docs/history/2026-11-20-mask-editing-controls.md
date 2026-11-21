# Mask editing controls

On 2026-11-20 the Next mask playground corrected the visibility toggle,
which had requested the current visibility on every click. Hide, Show,
Undo and Redo now use the editor. The README walks through connecting a
vanilla stage to an editor and wiring a visibility command and undo.

`pnpm verify:region-mask` passed all six checks. The Next cases use the
rendered controls with Chromium desktop clicks and touch-emulated taps at
the iPhone 14 viewport. They check the rectangle disappears, the circle
remains, and the preview pixel alpha changes after undo, redo and show.
The old test-only hide command was removed. Physical iOS Safari input remains
unmeasured.
