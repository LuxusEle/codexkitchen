# Customer design / direct cabinet editing UAT

1. Click a door, drawer, carcass or frame member in 3D. A compact editor
   should open near the pointer without changing the current workflow tab.
   In a shared continuous frame, select near the second/third cabinet and
   verify that cabinet is selected, not always the first box of the run.
2. Click a lower or upper box in the plan (use the row filter if needed).
   Its matching 3D box highlights and the same editor opens. Keyboard Enter
   or Space on a plan box should also open it; Escape closes the editor.
3. Change width, height, front divisions, ACP/glass or front colour. Valid
   edits update the design and the provisional estimate strip immediately.
   Invalid/incomplete dimension entries must not change the geometry.
4. Cooker and sink widths remain protected. Gaps / overlaps remain visible
   as review issues. **Review / close gaps** uses the existing approval
   process, not silent resizing of neighbouring boxes.
5. Delete a cabinet. It disappears, its requested count updates where
   appropriate, and the remaining gap stays visible. Undo restores it.
   A subsequent layout change invalidates Undo so newer work is not overwritten.
   Changing prices or project name must not prevent Undo.
6. Selecting an island offers **Delete island**, explicitly removing the
   whole feature, not leaving half an island's frame/worktop behind. Undo
   restores its units and settings.
7. **Move** enables dragging in 3D/plan. A drag must not open the editor
   over the pointer; a simple click should still open it. System movement
   previews retain the existing OK / Cancel approval.
8. **More** opens the full cabinet editor. The placed-box buttons above the
   designer open the same quick editor as a click in the scene.
9. **Edit quote & BOM** takes the user to editable prices. Manufacturing
   outputs remain accessible under Advanced, clearly labelled previews.
10. Check the quote strip for missing prices, unplaced items, layout errors,
    unconfirmed site measurements, manual quantity overrides and partial BOM.
    A material reference cost is not a full job cost or a guaranteed margin.
11. Test both input-unit modes, light/dark themes and phone layout. The editor
    becomes a compact bottom sheet on narrow screens and remains scrollable.

Automated coverage checks deletion / undo, requirements, island removal,
shared-frame hit selection and quote warnings. Browser interaction remains UAT.
