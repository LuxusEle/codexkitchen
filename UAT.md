# UAT 1 test guide

## Door development / fabrication retest

1. Select a base cabinet, then Door development. Enable X-ray and increase Explode: inspect the hollow sash chamber, retaining lip, seated panel and mitres. The grip must be at the top.
2. Select an upper cabinet: the grip must be at the bottom, with the complex sash unchanged. Overall leaf height includes the 32 mm grip allowance.
3. Compare Frame only and Frame + carcass: the latter adds continuous U-notched cladding, without moving frames or showing doors, appliances or worktop.
   - A bottom cabinet must have a U-notched bottom ACP panel but no ACP top panel; the granite/worktop is its cover.
   - At each exposed run end, confirm the only side infill is inside a four-sided sash. There must be no second plain ACP side liner.
4. Inspect a run of narrow cabinets: front uprights follow divisions, rear posts use an independent support grid. Do not approve support spans from visualization alone.
5. Open Cutting & BOM. Match nested part IDs with cuts and panels. Change kerf/stock size/rotation. Oversize pieces must appear as rejects and block complete review ZIP export.
6. Download the review ZIP. Inspect SVG U-notches, cut CSVs, hardware assumptions and JSON. Hinge drilling and machine-release approval are not included.

Open http://localhost:9799. The default example is a 4800 × 3600 × 2700 mm L kitchen.

1. Room: change width/depth; compare plan and model. Try I, L, U and galley. An impossible layout must report a conflict.
2. Openings: add a window/door, move to another wall and change sill. Cabinets must respect the occupied height band. Move an opening beyond the wall: export must be blocked.
3. Checklist: check measured details, add service notes and download a dated calendar event. Importing it into a calendar is a separate user action.
4. Kitchen brief: add pantry, dishwasher, drawers, spice and glass units. Set a preferred wall. Too many requested units must appear as unplaced instead of disappearing.
5. Design: switch finished/frame/open views; orbit/zoom; change ACP/frame/counter colors. Select a cabinet in the plan and change width or offset. Overlap/out-of-bounds must be reported. Rebuild automatic layout to discard manual arrangement.
6. Export: prepare pack, download ZIP and inspect perspective, plan, elevations and frame PNGs. Match every cabinet ID with the schedule and prompt. Download project and reopen it.
7. Phone: visit the printed LAN address on the same Wi-Fi. Import the saved project. Check all steps and scrolling. On supported HTTPS, share images/prompt and choose ChatGPT if offered; on LAN HTTP use downloads and paste.

## Verification boundary at handoff

### Gap-fix retest

- Refresh the app. For a saved manual layout, use Design → Close run gaps; automatic layouts recalculate on reload.
- Check L and U corners in finished and frame views: upper runs use shallow upper corners, small residual spans have closures, and base worktops cover fillers without overlapping at turns.
- Remove an automatically added base or upper cabinet: an unfilled-run warning must appear. Close run gaps should clear it while keeping fixed appliances in place.
- Confirm windows, doors and the cooker hood remain unobstructed. These intentional spaces must not be filled.
- Adjacent closed doors should have 3 mm reveals. Open-door view intentionally shows the cabinet interiors.

- Production compilation and local HTTP response verified.
- Automated planning tests exercise required-item preservation, layout variants, opening constraints, corner bounds, manual collision detection, island spacing, import validation and prompt content.
- Native browser UI inspection was interrupted by the physical Escape key; no completed visual/browser UAT pass is claimed.
- Phone-native sharing, ChatGPT attachment acceptance, exported-image visual fidelity and on-device touch interaction still require the user's UAT.
- Optional WebMCP read tool is feature-detected; no compatible WebMCP validation context was available.

Please record: device/browser, project JSON, affected cabinet ID, expected result and actual result for each issue.

## Current retest: middle fillers, liners and assembly PDF

- Box ends: fixed four-sided lipped sash with ACP infill; no handle bar and no hinges. Frame-only shows its four bars, while Frame + carcass shows the seated panel too. Door handles elsewhere are unchanged.
- Bottom storage must have closing fronts. Old open-base units migrate to closed base units on reload/import without moving or resizing placed units. Open fronts inspection mode still intentionally opens doors.
- Inspect inner end liner/front rail junctions for the corrected 12.7 mm slit. U-cuts reference actual post IDs in JSON; allow only 1 mm per cut edge. The combined-engine upright orientation is retained pending manufacturing approval.

The former Close run gaps action is now **Audit & fill gaps**. The live Cabinet space auditor also offers **Run audit & fill**.

- On the 3300 x 3700 room, add a spice, bottle, waste or drawer unit in Design. It should occupy an available automatic bay without overlapping A/25. Try a tall pantry with occupied upper bays: it must give a no-fit message instead of inserting through those cabinets.
- Check usable/unboxed lengths for each wall; door clearances, windows and the hood remain excluded. Run audit & fill twice: the second run should not change an already repaired layout.
- A gap can widen ordinary storage, but must not stretch specialist equipment. If a gap lies between immovable appliances with no reachable adjustable storage, it stays visible with an explanation.
- Confirm no mid-height rail crosses a pullout, drawer, sink or oven access opening. Frame outlines, end liners, lipped sash and handle direction remain intact.

1. Refresh localhost:9799. For a saved design select Design > Close run gaps. The middle K13 filler must disappear, its width absorbed into neighbouring opening storage. Run-end closures may remain. Fixed-appliance-only gaps must stay flagged rather than get a new middle filler.
2. In a new U example inspect Wall A's left blind corner: its accessible opening has two doors; the blind return remains fixed and the sink stays in position. Check Finished and Open views.
3. Check the end panels for striping in normal (non-X-ray) view. Open doors and inspect side/rear/top/bottom liners. Front box bars must have NO ACP strips. Frame-only mode must show only metal.
4. Set a spice unit to 100 mm, adjust neighbouring widths, and inspect its opening/pulled-out front. A 100 mm ordinary base cabinet must report an error, not become an accepted thin box.
5. Select a cabinet; change door divisions, ACP/glass and colour. Inspect normal and isolated-door views, save/reimport, then compare exported elevation and infill stock grouping.
6. On a custom layout with an unplaced requirement, Cutting & BOM must still show partial nested parts and an incomplete-design warning. Fix issues before downloading the complete review ZIP.
7. In Cutting & BOM choose one frame run and download its assembly PDF. Match bar IDs/positions and stock references to the nesting output. Try All continuous frames too. PDF sheets are review-only; approve supports, fixings and hardware separately.
8. Open Continuous frames in the viewer, isolate each run and compare it to the selected-run PDF. A two-leaf 1200 mm bay must not gain a centre box upright. Adjust Rear upright adjustment negative/positive and confirm only the concealed rear grid changes.
9. In Cutting & BOM review the LKR calculator. Confirm bottom/top run, 2100 mm tall equivalent, granite square feet, splashback, LED and plumbing/wiring quantities. Edit every rate/quantity, add an Other line, and download the cost + BOM PDF. Treat the purchasing subtotal separately from the selling estimate.
8. In a panel SVG/JSON, measure an interior front U-cut: 25.4 mm upright + 1 mm each side = 27.4 mm slot width. Rear posts remain behind the inner rear liner, without redundant rear shelf notches.
