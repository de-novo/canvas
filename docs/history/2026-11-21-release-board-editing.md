# Release board card editing

The flow playground uses one editor command to update the selected card’s
title and status while retaining its owner. The inspector reads the document
after selection and history changes. The serialized card lives on its existing
HTML node and the host renders the title as plain text.

The flow example typecheck and both `pnpm verify:flow-showcase` checks passed.
Desktop Chromium selected the Build card, applied a title and status, observed
the updated card and one history entry, and restored the original values with
Undo. The initial mobile-emulated case covered rendering.

The board also saves its document in browser local storage on an explicit
Save. Opening the page validates and restores the snapshot into a fresh
editor. Storage errors are surfaced in the panel. Canvas2D accepts HTML
cards as transform targets and positions their overlay during a preview.
The board's Connect tool owns the drag so navigation cannot pan away the
target before release.

Desktop Chromium renamed and moved the Build card, dragged a new connector
from Intake to Build, saved and reloaded. The restored editor document matched
the pre-save document exactly, including the new edge, and the rendered
card retained its edited title, status and position. The web package build,
flow typecheck, flow showcase (2/2), and hit-testing suite passed.

The mobile check now runs the same save/reload scenario in Chromium with the
iPhone 14 profile. It taps controls and uses browser touch events for dragging.
The single-column grid uses a zero minimum track size so the canvas cannot
expand the page width during editing. Both showcase cases passed and the
restored mobile screenshot is stored at
[flow-release-board-mobile.png](../../artifacts/verification/flow-release-board-mobile.png).
Physical devices, iOS Safari and on-screen keyboard input remain unmeasured.
