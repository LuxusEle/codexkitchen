# Business pilot roadmap - discussion saved 2026-09-16

## Release boundary

Live baseline: `357536e` on main. Do not push, merge or deploy this development
branch without explicit approval. Existing Vercel behaviour must remain unchanged.
The broader design roadmap below is NOT authorised for implementation yet.
Only the separate customer quotation pack described below is authorised locally.

## Goal

Fast customer design, understandable drawings and transparent quote review.
Manufacturing output remains a review preview, not a production release.
Readiness is demonstrated by real-project reconciliation, not a completion percentage.

## Proposed stages (pending approval)

1. Agree stacked-upper pricing, mixed front arrangements, appliance locking,
   standard rate inclusions, and customer drawing contents.
2. Elevation-first editing alongside plan and 3D: unequal splits, stacked rows,
   shared alignment datums, explicit locks and approval of automatic adjustments.
3. A vector customer drawing pack from one resolved snapshot: plan, all designed
   wall elevations, island faces, cabinet IDs, dimension chains, title/revision
   blocks and outstanding assumptions. Keep mm authoritative with optional ft/in.
4. Separate private costing from customer quotation, with confirmed/provisional/
   missing cost statuses, complete job allowances and revision control.
5. Validate against real kitchens, including the supplied complex drawing. Compare
   views, cabinet counts, widths, fronts, totals, save/reopen and exports manually.
6. Later: rated hardware, collision envelopes, joinery and fabrication release.

## Constraints and known risks

- Current upper pricing unions horizontal spans; stacked rows may be undercounted.
- Front divisions are mostly equal; oven compartments are currently preset.
- Rectangular rooms and generic appliance defaults do not describe every real site.
- Fronts, storage compartments and continuous structural frames must be distinct
  but linked; a front division must not imply duplicate front/rear structure.
- Classify intentional ventilation/access spaces separately from unresolved gaps.
- Corners have one owner; avoid double counting and impossible door access.
- Preserve old projects with versioned migration and regression fixtures.
- Drawings and quotes should identify measured/customer-supplied/assumed dimensions.
- Material subtotal is not full job cost or guaranteed profit.
- AI images are visual impressions, not dimensional or manufacturing authority.

## Approved local slice: customer quotation pack

Staff selects Create customer quote -> uploads rendered JPG/PNG/WebP images ->
reviews customer, package price, scope, optional extras and terms -> confirms ->
downloads one PDF containing the quotation and lightly LUXUS-watermarked images.
User refinement: images must be embedded, with no separate images or ZIP output.
Use the Luxus logo and business letterhead from the supplied quotes; do not commit
source customer PDFs or their customer information. Do not include internal BOM,
supplier rates, margin, auth data or project JSON in the customer pack.

Quotation, not invoice. A single package selling price plus selected optional
extras; unselected options are clearly not included. Explicit inclusions override
generic exclusions. Source terms include 85% advance and 30-day production; these
are editable commercial drafts requiring staff review, not legal advice.
No warranty, tax rate, new bank information or approval signature is invented.
Render uploads are processed locally for this slice, not silently stored in cloud.
No automatic email/WhatsApp send; the user chooses the recipient through sharing.

## Acceptance before publication

- Existing tests/build pass without layout, auth or pricing-engine changes.
- Quote totals, options and deposits reconcile; non-finite/negative values blocked.
- Customer output excludes internal costing and private project metadata.
- PDF pages are visually checked; long text paginates and images preserve aspect.
- Watermarks are baked into exported image copies; originals remain untouched.
- Failed uploads/generation are actionable; edits invalidate old generated files.
- Browser UAT includes phone sharing, upload failure, draft saving and project reopen.
- Owner approves wording, bank details and tax treatment before live rollout.

## Confidence discussed

Approximately 85% subjective engineering confidence in reaching a controlled
design/quotation pilot with staged UAT; not a measured readiness score, guarantee
of quotation margin or fabrication reliability.
