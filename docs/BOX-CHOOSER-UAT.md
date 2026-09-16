# Box chooser / compact L kitchen UAT

Site measurements supplied: wall A 2210 mm, window wall B 2410 mm,
window sill 1000 mm. The window's actual width, height and corner offset
are not yet confirmed. Do not treat the synthetic windows in automated
tests as site dimensions.

1. Create a new project. Oven tower, pantry and fridge quantities must start
   at zero; ordinary base and wall storage must still generate.
2. Choose L, width 2210 and depth 2410. Enter the actual window on B once
   its missing dimensions are measured. A new project has no invented openings.
3. Above the 3D view, open **Choose boxes**. Choose sink on B, cooker on A,
   one drawer bank and two wall cabinets. Untick other unneeded requirements.
   Set upper walls to A only. Review the schedule and press **OK**.
   Cabinets must appear on both lower runs; no unexplained spans or overlaps.
4. Select **Drawers** and **2 divisions** for the cooker to create two fronts
   under the hob. The hood/cooker stays 600 mm wide; sink stays 800 mm.
   Appliance/runner clearance still requires supplier confirmation.
5. Change a wall cabinet's starting height and width in the chooser. Check
   the proposed final widths: flexible storage may resize to fill the run.
   Press Cancel once: the current project must remain unchanged. Reopen and
   approve: dimensions must reach 3D, elevations and BOM.
6. Click a requirement chip to preview switching it off. Approve; its chip
   should say Off. Switch it back on: its previous quantity/settings return.
   Ordinary auto-fill storage is not disabled by unticking a requested type.
7. Click a placed box ID above the view. Its individual editor must open.
   Set an end upper box to **Open shelves**, leaving adjacent upper boxes
   closed. Check that no doors/handles/hinges remain on that open box.
8. On an older saved project, **No tall units / fridge** previews their
   removal and replaces usable empty run space with base storage. Cancel
   must preserve the old design. Existing saved designs are not migrated
   or stripped of explicitly requested appliances automatically.
9. Save the project, return to Projects, reopen and export/import JSON.
   Quantities, remembered off chips, defaults, upper walls and individual
   front arrangements must survive.
10. Resize an old demo to A=2210 while its A-window still ends at 2500.
    A prominent message must explain which measurement is invalid and link
    to Openings. It must not silently move or shrink the window.
11. Over-request cabinets or enter an invalid width. Errors must be visible.
    Invalid geometry cannot be approved; unplaced requirements require an
    explicit acknowledgment and must remain listed in Layout check.
12. Check popup keyboard focus, Tab, Escape/Cancel, light/dark modes and a
    phone-width screen. The popup should scroll and keep its actions reachable.

Automated coverage: compact return depths 1900, 2210, 2410 and 2499 mm;
safe cooker landing space; exact default removal of tall/fridge; non-mutating
draft/toggles; save/import; width/height validation; shared drawer/open-front
construction and BOM. Browser interaction and visual checks remain UAT.
