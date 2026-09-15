# Cabinex Assembly Lab — evolution plan

13 September 2026. Assemble and verify the existing systems. This is not a new cabinet geometry engine.

## Comparison and sequence

| Capability | Existing implementation to preserve | Next evolution | Evidence required |
|---|---|---|---|
| Board cabinets | Shotgun panels, rear stretchers, Gola notches, named groups | Explicit recipes; correct measured placement errors | Before/after dimensions, solid volumes, joint contact, source fingerprint |
| Aluminium carcass | Active hybrid engine continuous full/economy frames and cladding | Carry all end-condition/economy options through one adapter | Profile sections, shared-member count, cladding clearance, junction inspection |
| Doors and wardrobes | Box Gun front choices; existing sash and wardrobe builders | Separate carcass and front choices; publish only supported combinations | Original-vs-adapter geometry comparison for each combination |
| Hardware | Original screw, Minifix, dowel and combined-joint builders | Connector owns its mating parts AND operation list | Correct connector selected; entry faces, bore axes, depths and interference checks |
| Aluminium L connection | Exact two-way L connector with two rivet pilots requested by user | Trace original first; add/correct only after profile and fixing specification established | Two explicit pilot operations, diameter, centres, entry wall, mating member, rivet grip/access |
| Naming | Original cabinet and part group names | Stable IDs, source provenance and operation ownership alongside names | Project / room / run / cabinet or shared frame / part; hardware references both mating parts |
| CNC | Existing flatten/nest routines and DXF primitives | Explicit inside face, grain vector, face/edge setups and machining layers | Same transform for outline, labels and operations; independent DXF audit |
| Room design | Master width division, opening intervals, corner candidates and gap repair | Whole-room candidate comparison, immutable required appliances, opening sweeps | Hard constraints first; ranked feasible alternatives with reasons |
| Presentation | Existing SketchUp groups and previews | Clear choice controls, material preview, opening/assembly/flat views | Appearance cannot hide failed construction checks |
| Tokens / future web | Existing token client and contracts | Preserve IDs and a geometry-independent request/result schema | No credentials in model/export; server behaviour remains a separate integration |

Sequence: trace original -> generate reference -> measure -> record fault -> targeted correction -> compare -> extend.

## First small test

One 600 mm Shotgun handled board cabinet, preserving original names and rear stretchers. Measure bottom-to-side contact and horizontal stretcher tops. Only the exact known 18 mm placement errors may be corrected by translation; all other geometry remains source geometry. Show an original screw L-joint coupon beside an evolved coupon with physical cuts. This is a connector/CNC proof, not full-cabinet production export.

Reuse the master's actual `pair`, `poly`, `circle` and `dxf` method bodies in an isolated module; do not load its cabinet builder. Capture bore calls from the actual original joint builder. Convert the stepped screw clearance into equivalent surface-entry operations. Apply those operations to original coupon panels and use the identical records for DXF.

Source vertical coupon: 200 x 160 x 18 mm. Horizontal coupon: 200 x 180 x 18 mm. Two screws at source X positions 45 and 155 mm. Export vertical exterior setup separately from horizontal edge setup. Inside face cannot be substituted for the exterior screw-head entry. The edge drilling sheet is explicitly an edge setup, not a top-face nesting sheet.

## Hardware and tooling from the beginning

| Family | Model / assembly data | Machining / tooling data | Current gate |
|---|---|---|---|
| Confirmat / screw | Source screw, two mating part IDs, entry direction | Clearance bore, pilot, head recess; diameter, depth, start plane, through/blind; drill and recess tool | First coupon physically cut and exported; actual supplier screw/tool still to be approved |
| Minifix / Rastex | Exact selected cam + matching bolt, handedness and B distance | Cam pocket, edge channel, bolt bore; connector-specific depths | Source examples exist; no interchangeable supplier assumptions |
| Dowel | Diameter, length, insertion split | Both mating bores and depths; glue/assembly allowance | Source example exists; compare actual 10.5 mm depth with rounded annotation |
| OVVO | Exact product and compatible stock | Supplier groove geometry and cutter | Pending identified product; never generic guessed pocket |
| Aluminium L connector | Correct two-way connector, profile cavity and orientation | Exactly two rivet pilots as requested; pattern coordinates and which members are drilled | Pending traced original/specification; no substitute three-way cube |
| Rivets | Diameter, grip range, head, access for setting tool | Pilot diameter/tolerance, wall stack, entry and exit clearance | Pending matching L connector/profile and rivet |
| Hinges / runners / handles | Selected hardware, opening envelope, mounting references | Cups, pilots, slots, mounting centres and drill access | Reuse supplier-specific data; no decorative-only completeness claim |
| Back / Gola | Original back panel and actual L/C section | Receiving groove, notch contour, depth and available cutter radius | Named groove or overlapping sheet is insufficient proof |

Each operation needs: ID, part ID, connector ID, source revision, entry point, inward axis, diameter/contour, depth, through/blind status, setup, tool family, approval status. A connector references mating parts; an operation belongs to exactly one machined part. Geometry, BOM, DXF and flat-layout labels consume these same records.

## Serious risks — no silent fallback

1. Active older planner can coerce construction choices to aluminium. Bypass that routing; reject unsupported requests.
2. Different files define the same Ruby module. Keep revisions isolated, hash-pinned and never mix live constants.
3. Source solid groups can still have assembly gaps or misplaced rails. Check mating surfaces as well as solidity.
4. Source back-sheet overlap does not prove receiving grooves exist. Full-cabinet CNC release remains blocked until checked/corrected.
5. Source screw head is cylindrical despite countersink wording. First coupon represents a stepped cylindrical recess faithfully; do not export it as an approved conical countersink.
6. Source connector selection can fall into a Minifix path despite screw selection. Call explicit inspected routes.
7. Largest-face flattening and long-axis rotation do not establish inside face or grain. Add explicit orientation records before general nesting.
8. Three-way aluminium connector geometry and BOM fallback counts are not evidence of the requested L connector/two-rivet pattern.
9. The exact remembered universal VIP/non-VIP module is not yet conclusively identified. Box Gun and build_box are candidates, not proof of every combination.

## Smart designer research track

Research is recorded in RESEARCH.md. Proposed pipeline: room/openings/services -> required appliance anchors -> feasible corner ownership and cabinet intervals -> exact run division -> front-seam alignment -> door/drawer swept-volume checks -> score workflow, storage, symmetry, filler use and cost -> show several feasible alternatives -> call the verified construction adapters -> audit actual geometry -> manufacturing.

Hard constraints are never traded for visual score. A required sink/oven/fridge cannot disappear to make a layout fit. If no valid arrangement exists, show the conflicting constraints and available changes. Share source/recipe IDs with the assembly system so future planner output selects verified construction rather than generating new cabinet geometry.
