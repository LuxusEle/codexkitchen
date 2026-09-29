# Site kitchen BOM review - 29 September 2026

Local branch: dev/site-kitchen-bom. Based on ebecfc6, containing origin/main 357536e plus 11 local commits. Fetch and fast-forward sync completed without overwriting local work. No push or deployment.

Preview: http://127.0.0.1:9799/site-review.html. Development-only page; no cloud accounts or production authentication changes. Export project, cut lists, nesting SVGs and BOM: node scripts/export-site.mjs OUTPUT_DIRECTORY.

## Final user corrections

Site wall labels: A = original bottom/sink, B = original left/hob, C = original top/fridge, D = original right/plain wall. WALL D HAS NO DOOR. Fridge is on C opposite sink A. Its reservation is 762 mm (30 inches), from 1418 to 2180 measured from the original top-left corner. Adjacent base storage is 818 mm. Engine coordinates are retained separately (engine A/B/C/D = site B/C/D/A); the review scene and schedule display site labels.

Bottom doorway begins at 1890 rather than the handwritten 2000 cabinet run; cabinet end is 1865, allowing 25 mm. The previous interpretation of a 680 mm opening on D was explicitly rejected by the user and removed. Above-hood box is included: 600 x 530 x 350, underside 1640, top 2170, with two doors. There are only TWO drawers, both under the hob; 13 hinged fronts and 15 fronts in total.

The rectangular 3190 x 2900 approximation omits a 160 mm wall step. Ceiling, window sill/height, green top opening, actual appliance dimensions, ventilation and hood duct clearance still require site confirmation. No fridge surround is included.

## Continuous construction

Four continuous assemblies: R1 lower B 2900; R2 lower C 818; R3 lower A 1265; R4 upper B 2900. R4 has continuous top rails and a raised centre underside over the cooker hood. Intermediate shelves stop either side of the hood duct zone. Doors remain separate. The project opts into continuousUpper; renderer and takeoff use the same assembly members. Do not revert to separate top boxes or add four right-return drawers in illustrations.

## Changes and checks

Optional cabinetRuns limits are validated on import and used by layout generation, gap auditing, repair and cabinet validation. Existing automatic U standard-corner minimum stays; error messages distinguish full room dimensions from cabinet lengths. This measured U project uses a manually validated layout.

Final preliminary BOM: 14 box bars at 6100; 8 sash bars at 6400; 3 grip bars at 3000; 3 graphite + 6 neutral + 1 cream ACP sheets; 26 hinge sets; 2 drawer systems. 186 bar cuts, 47 panels, 25 stock bars and 10 sheets; no nesting rejects. Worktops, appliances, services, connectors and fixings excluded from the fabrication BOM. Profile fit, stock lengths, machining, connections and hardware remain review only.

Latest model checks: 149 tests passed; production build passed with the existing bundle-size warning. PDF cut schedules include every bar and panel ID. PDF field values, widget appearances and calculation order verified; sample gross-margin/tax arithmetic passed. Automatic PDF calculations require a compatible viewer such as Adobe Acrobat Reader.

## Surface takeoff and editable estimate

Granite from countertopPieces: gross before sink cutout 3.083125 m2 = 33.19 sq ft; net after nominal 500 x 320 mm sink cutout 2.923125 m2 = 31.46 sq ft. No hob cutout deducted. Depth 625 mm, nominal stone thickness 25 mm. Corners counted once: B 2900 x 625, A return beyond corner 1240 x 625, C return beyond corner 793 x 625. Gross area is the initial quote basis, not supplier slab yield.

Provisional tiled backsplash: B (2300 x 575 + 600 x 675) = 18.59 sq ft; A (1865 x 101.6) = 2.04 sq ft; C (1418 x 101.6) = 1.55 sq ft. Total 22.18 sq ft, no waste. A/C bands are nominal 4 inches below windows/opening. C central opening dimensions remain unmeasured. D has no tile. With 10% waste: granite 36.51 sq ft and tile 24.40 sq ft.

## Current reports and supplier reference

App reporting choices: editable BOM/estimate; renders, frames and isometrics; cut plans and cut lists; full report. Local build passed, full suite 149 tests passed, three focused reporting tests passed. App-generated PDFs: 1 / 23 / 48 / 72 pages respectively. All 57 app form fields correspond to widgets, 20 calculation actions verified, sample comma/margin/tax arithmetic passed. Blank initial fields have no appearance streams; nonempty fields have appearances.

Delivered polished PDFs in outputs:
- kitchen-editable-estimate.pdf: 2-page A4; 61 fields, 21 calculations, LKR prefilled, rates blank; filled sample logical values, appearances and arithmetic verified.
- kitchen-views-and-frames.pdf: 19-page A3; finish illustration, literal full perspective and side app captures, front elevations, four continuous frames with vector isometrics and end projections, front and surface schedules.
- kitchen-cut-plans-and-lists.pdf: 35-page A3; every cut ID, stock bars, ACP nesting, notches, BOM and review notes.
- contractor-kitchen-pack.pdf: 54 pages; all technical pages plus editable estimate. Full 61-field form tree and 21 calculation order entries verified after merging.
- pantry-supplier-price-reference.csv/json: 26 extrusion codes, 76 listed finish/accessory prices transcribed from attached one-page list. LKR confirmed by user. Stock length, wall thickness, tax and price unit not supplied. Source date comes from filename only. No direct approved profile matches. CNT-3825 is a candidate only. Do not apply 2x1 box price to our 1.5x1 box or accessory bracket prices to hinge sets.

The supplier catalogue is saved in workspace outputs only, not integrated into the app. The earlier approval usage-limit blocker was resolved during the later user-requested render fix. Static deliverables use the full perspective capture instead of the cropped app isometric; complete vector frame isometrics remain included. No push/deployment.

## Local render fix

ReportingPanel now captures previews automatically after the sibling 3D scene mounts. The Renders tab is always available and previews are independent of PDF results, so switching report types no longer erases renders. Captures are shared with visual/full PDF generation to avoid rerendering; project changes invalidate previews. A failed capture is retriable. Isometric span increased to include complete upper cabinets and centre target raised. Browser verified fresh page load, all six 3D JPEGs loaded at 1440 x 960, BOM generation, return to Renders and report switching. Eight reporting/site tests and production build passed (existing bundle-size warning). Local only; no push or deployment.
