# CODEX KITCHEN APP — UAT 1

Local aluminum kitchen planning workspace. Run `npm install`, then `npm run dev` from this folder. The server binds port **9799** with strict port selection and exposes the app on the local network. Open http://localhost:9799 on this computer, or the network address printed by Vite on a phone on the same Wi-Fi. Keep this machine and server running. No cloud deployment or API key is needed.

## Workflow

Cloud sign-in, project saving, private files and admin approvals are available through **Cloud / Sign in**. See [DEPLOYMENT.md](DEPLOYMENT.md) for Neon/Vercel configuration and outstanding account setup. Cloud services require their environment variables and the reviewed database migration; device autosave remains separate.

Room dimensions and I/L/U/galley arrangement → doors/windows → site checklist and calendar reminder → requested cabinets/appliances and preferred walls → model editing/materials → rendering pack.

The default L kitchen places sink, hob/hood, drawers, spice pullout, oven/microwave tower, fridge, wall and glass units. Remaining usable space becomes base storage. Requested items that cannot fit remain explicitly unplaced and block rendering-pack export. The room uses millimeters; A is rear, B right, C front, D left, all measured clockwise. Room shapes are rectangular in this edition; kitchen arrangements vary within them.

The browser saves on this device. Save/Open project JSON transfers between devices. Moving from localhost to a LAN IP uses separate browser storage; import the JSON to carry a design across. A calendar ICS file only schedules a reminder after the user imports it into their calendar.

## Run movement and design alternatives

- Select a cabinet and enable **Move 3D** (or **Move items** below the scene). Drag its front in 3D or its footprint in the plan. The arrow buttons move the selection one position along its wall. Neighbours reorder and snap together within the connected usable row; room openings, corners and tall end bays are stops. Upper and bottom rows can both be moved; the plan's row selector makes upper boxes easier to select.
- Moves are drafts, not autosaves. Light-blue boxes show the proposed positions/widths. The small **OK / Edit / Cancel** card stays beside the 3D model, without a blocking modal. OK commits, Cancel restores. Edit chooses which boxes may resize. Door storage is adjusted first, then 150–250 mm spice pullouts, then drawers; sink exceptions require an explicit tick and are limited to ±50 mm. Cooker/hood widths remain fixed. Invalid or unfillable proposals cannot be approved.
- **Shuffle design** proposes a different storage sequence, retaining service positions (sink and cooker/hood), openings and anchored tall ends. Equivalent equal-size door swaps do not count as a new design. Constrained rooms can exhaust their distinct alternatives; the app says so instead of returning a duplicate.
- After OK, use a numbered slot's save icon to retain the design. Four slots are included in local project storage and downloaded project JSON, including each option's room, openings, materials and cabinet layout. View previews a slot; OK restores it. Replacing an occupied slot asks for confirmation. These are local saves, not cloud/database storage.
- UAT: move a drawer through a base run; repeat with a glass upper; release and Cancel; repeat and OK; create a gap and use Edit; shuffle and save four options; refresh; download/import JSON and restore each slot. Check that 3D remains visible during approval.

## Rendering handoff

Prepare rendering pack → download ZIP or individual PNGs → share images and prompt, or open ChatGPT and attach PNGs/paste the prompt. The ZIP includes perspective, a dimensioned box-reference isometric, top plan, all four wall elevations, island/front elevation when present, frame views, prompt, editable project JSON, resolved layout JSON and cabinet schedule CSV. No chat is automatically submitted, no paid image API is called, and images are not silently uploaded.

Native sharing is feature-detected and the user selects the receiving app. A website cannot guarantee that ChatGPT is installed or appears in the share sheet. Local-network HTTP is not a secure context, so mobile native file sharing is generally unavailable there; downloading images and copying/selecting the prompt remains supported. Use an approved HTTPS deployment for a future full mobile sharing test.

References: [Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API), [ChatGPT image generation and references](https://learn.chatgpt.com/docs/image-generation).

## Source basis and fidelity

`reference/manifest.json` records exact source hashes. Five Ruby files, the earlier browser frame generator and assembly notes were copied into `reference/`. They are source evidence and do not execute in the web app. No original repository source file was modified.

| Capability | UAT 1 status |
|---|---|
| Room maker, opening height bands and cabinet requirements | Implemented in browser |
| I/L/U/galley, explicit A-owned blind corners, optional island | Implemented with room/footprint and aisle checks |
| Layout sizing and manual unit edits | Implemented; explicit unplaced list, no hidden construction substitution |
| Hollow aluminum box bar dimensions, 6400 mm rail splitting | Ported into browser geometry |
| Original sash section and complementary mitred ends | Contour-based browser mesh, no machining certification |
| Shared contiguous frame rails and structural boundary members | Browser implementation; source equivalence still needs visual/geometry review |
| Premium/economy ACP presentation, opening fronts, appliance envelopes | UAT visualization |
| ACP notches, hood-adapted continuous frame, fixed sash box ends | Implemented for this UAT; machining approval still required |
| Complete Ruby catalogue, wardrobes, board and mixed construction | Source snapshots retained; outside this aluminum UAT slice |
| Supplier hardware, joinery cuts, bore operations, nesting, CNC exports | Review nesting/BOM implemented; connectors, bores and CNC release remain outstanding |
| Bills/pricing, licensing, cloud jobs, collaboration | Editable LKR estimate/BOM PDF implemented; licensing/cloud collaboration remain outside UAT 1 |
| Door/drawer swept-volume collisions and installation clearances | Manual review; closed unit footprints alone are checked |
| Image/prompt export and share-sheet handoff | Implemented; device/app compatibility requires UAT |

## Validation

## Fabrication / door-development increment

- `reference/fabrication/manifest.json` records 16 byte-identical source copies from Documents/Aluminum, the combined engine and Master Studio. Originals were not edited. Web adapters are separate in `src/assembly.js`, `src/sash-profile.js` and `src/fabrication.js`.
- Frame only; frame + carcass without doors/appliances/worktop; finished/open fronts; X-ray; isolated Door development with explode control.
- The active sash is the detailed six-wall web profile, including hollow chamber, shelf, retaining channel and return lip. The combined-engine grip is adapted separately without replacing that profile. Upper grips are below, base grips above; the 32 mm rise stays inside the overall leaf opening. This hybrid extrusion still requires product/manufacturing approval.
- Shared run rails, independent rear support grid (600 mm default review assumption), and stock-bounded U-notched panels. Rear uprights are turned 38.1 mm across the run × 25.4 mm deep so the rear ACP is flush. Front U-cuts have 1 mm clearance per cut edge; horizontal liners butt against the rear ACP and do not need cuts around rear posts. No structural rating is implied by support spacing.
- Cutting & BOM provides best-fit bar nesting, rectangular-blank sheet nesting with real U-notched outlines, material/profile/finish separation, kerf, trims, margins, rotation control, explicit oversized rejects, provisional hardware and ZIP export (CSV, SVG, JSON).
- Notch outlines are real connected shapes but packing uses rectangular blanks, not interlocking contour optimization. Worktop manufacture, drawer boxes, connector/screw schedules, verified hinge bores, column cutouts, machine posts and structural approval remain outstanding. These outputs are REVIEW ONLY, not production release.

The table above describes the initial UAT baseline; this increment supersedes its statements that nesting and horizontal ACP notches are wholly absent.

### Checks

Run `npm test` for deterministic planning regression checks and `npm run build` for production compilation. `node scripts/source-manifest.mjs` verifies copied sources and updates the manifest. See `UAT.md` for acceptance steps and the current verification boundary.

The app uses React/Vite and Three.js already present in the parent codebase, plus fflate for local ZIP creation. Source files stay separate from served build assets. It does not evaluate downloaded Ruby or expose the old licensing backend.

### Wall auditor and insertion correction

Latest construction corrections: box ends now use four mitred bars of the retained complex web sash plus channel-seated ACP, with no handles/hinges. The end sash itself carries the rail terminations, so duplicate box uprights and the old plain-ACP inner side liners are removed. U-cut outlines reference actual intersecting front uprights, with 1 mm clearance per edge; fixed end infills do not need U-cuts because no rail passes through them. Front uprights retain the combined-engine orientation (25.4 mm across X, 38.1 mm in depth); concealed rear uprights are deliberately turned 38.1 mm across X × 25.4 mm deep to close the rear ACP datum. Open-base choices are removed, and imported open-base requirements/units convert to closed base storage.

- Existing I/L/U/galley layouts retained; additional arrangements deferred.
- Cabinet space auditor shows usable and unboxed length per wall/row after openings (including their clearances), hood zones and perpendicular footprints. Audit & fill repeats until covered or unchanged, with a 24-pass safety cap. Unfillable gaps/conflicts remain visible, never reported as a successful repair.
- Manual insertion finds actual space or replaces untouched automatic storage bays. It does not stack new units at A/25, overwrite user-edited storage, or insert through an opening. If a tall specialist cannot fit under existing upper cabinets, it reports this instead of pretending insertion succeeded.
- Gap repair expands ordinary storage or a blind corner's accessible section; specialist widths are preserved. A contiguous specialist bay can move to transfer a gap to ordinary storage. Manual repair keeps fixed appliances in position; automatic generation may repack appliance positions within validation constraints, without resizing them.
- Automatic packing creates full storage bays before resolving small edge remnants, then revisits generated end closures. Straight kitchens finalize and validate the base row before placing wall cabinets around the final hood position. The 3850 mm and 4700 mm straight-run regressions close exactly with no unexplained filler strips. Appliance rendering uses the same 3 mm visual reveal as the adjacent fronts.
- Straight-kitchen fridge, oven and pantry towers form blocks only at the beginning or end of the usable run. Where a tall frame meets a base frame, the taller frame owns one shared fixed side sash and both runs terminate into it; duplicate back-to-back end sashes are not generated.
- Pullout/drawer/sink/oven openings no longer have arbitrary mid-height shelf members. Every permitted shelf is a closed four-sided aluminum frame; any intermediate support joins both perimeter rails. Plinth runners are also closed at both ends, and shelf ACP sits inside the frame without intersecting rear cladding. Source profiles and handle geometry remain unchanged.

### Lining, divisions and assembly PDF increment

- Box ends are four-sided fixed sash assemblies with channel-seated ACP and no second unframed inner sheet. Internal rails terminate into the end sash, so its infill needs no U-cut. Rear cladding and horizontal panels do not overlap. Bottom cabinet frames have no ACP top liner because granite/worktop closes them. Front box bars remain bare.
- No middle fillers are generated. Close run gaps removes existing middle fillers and redistributes their width into adjacent adjustable storage; corner expansion changes only the accessible side, not the blind return. Fixed-appliance-only conflicts remain flagged instead of receiving a fixed closure panel.
- Spice units accept 100 mm width with a visible 97 mm sash front. Other cabinet boxes have a 300 mm minimum. Narrow run-end closures are not cabinet boxes.
- Per-unit door/drawer divisions, ACP/glass and colour/tint feed 3D, door development, nesting, elevations, prompt and saved project data. Corner divisions apply only to the accessible opening.
- Incomplete custom designs show partial nesting for dimensionally valid placed parts. Errors and stock rejects still block a complete review ZIP.
- Cutting & BOM downloads an individual continuous frame-run PDF or all runs. Vector drawings, cut IDs, placement coordinates and liner schedules use the same records as the renderer/nesting. jsPDF is loaded on demand. These are assembly-review drawings, not approved connection details.
- Continuous frames is a separate viewer tab with isolated run selection and direct PDF export. Fixed end sashes replace end box uprights; rear supports use an independent spacing grid plus an editable fewer/more adjustment.
- The LKR calculator measures bottom/top linear feet, oven/pantry vertical feet (actual height × LKR 15,000), granite area, wall splashback and under-cabinet LED run. User rates are prefilled; every quantity/rate and custom other line is editable. ACP purchasing defaults are per complete 2440 × 1220 sheet, not an area multiplier. The purchasing BOM has a separate editable subtotal and combined PDF export so material costs are not double-counted into the selling estimate.
- Verification: 60 automated tests, including exact straight-run gap closure, exposed-end oven placement, bar-end connectivity and pricing units; all six geometry modes; 100 mm glass spice front in finished/open/door modes; production build and localhost HTTP 200. Frame and cost PDFs were generated and rendered for visual inspection. Browser visual and manufacturing UAT remain with the user.
