# Feet / inches input UAT

1. Open a project and choose **Input units → Feet + inches** above the 3D view.
   A 2210 mm room width shows 7 ft and approximately 3.008 in. The exact
   2210 mm remains underneath and the geometry must not change on switching.
2. Enter 7 ft + 3 1/2 in (or 3.5 in). Confirm the underlying width is
   2222.5 mm, then switch to mm and back. No further rounding/resizing.
3. At 2210 mm, change only feet from 7 to 8. Expected: 2514.8 mm, preserving
   the original precise inch remainder instead of rounding it from the display.
4. Enter 7 ft + 15 in. On leaving the field, expect 8 ft + 3 in (2514.6 mm).
5. Enter an incomplete/invalid fraction such as 3 1/ or 2/0. An inline
   **Not applied** message must appear. Project Save / chooser OK must not
   approve that incomplete entry. Correct it or switch units to discard it.
6. Check room, doors/windows (width/height/sill/offset), cabinet dimensions,
   island/breakfast-bar dimensions, the box chooser and stock dimensions.
7. Quantity counters, rear-upright count adjustment and money remain ordinary
   numeric fields. Fixed appliance widths remain disabled in the chooser.
8. Save/open and JSON export/import: all geometry is numeric millimetres.
   Cutting, BOM, labels and render exports remain explicitly metric.
9. Refresh the browser: the input-unit preference is remembered on this device.
10. Check light/dark modes, keyboard navigation, fractional typing and narrow
    phone widths. Feet/inch fields must not overlap; both retain their labels.

Automated coverage checks conversion, fraction validation, carry/normalization,
precision preservation and metric project round-trip. Interactive browser
checks remain UAT.
