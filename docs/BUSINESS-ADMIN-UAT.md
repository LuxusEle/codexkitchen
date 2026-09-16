# Two-business owner administration — local development only

## Release boundary

Live Vercel and main remain unchanged. Do not push, deploy or apply migration 0003
to production without approval. No cloud services or accounts were changed.

Businesses: Luxus Elemente and Devonly Holdings. The proposed migration assigns
legacy members/projects to Luxus; confirm this assumption before applying it.

## Implemented locally

- Owner dashboard inside Users & activity: business branding, logo, bank details,
  quote conditions, advance percentage, selling rates and supported formulas.
- Assign each operator one business, access status and a standing monthly target.
- Staff project queries require BOTH owner ID and assigned business; private asset
  access also checks the parent project's business. Owner access remains tied to
  the configured trusted identity, never a client-supplied role.
- New/imported/copied projects use the selected business; server selects the
  authoritative profile. Saved projects keep a pricing/branding snapshot.
- Cross-business copies clear old quote drafts and price overrides. Reassigning
  staff does not move old projects; the owner can still inspect/edit them.
- Approximate presence every 45 seconds while visible; offline after two minutes
  without a heartbeat. Interaction timestamps only, no keystroke contents or
  screenshots. Multiple tabs share one last-report record. This is NOT attendance.
- Business/staff project totals, creation counts and approved-revision counts for
  a Sri Lanka calendar month. Trash excluded. Targets are standing values, not a
  historical monthly target ledger. Disabled staff remain visible.
- Owner opens saved designs and records approval/corrections. New design saves
  invalidate approval. Review uses optimistic revision checks. Staff see feedback.
- Quotes use the project business, including embedded watermarks and logo with
  preserved aspect ratio. Internal BOM prices stay outside customer PDFs.

## Deliberate limits

- Devonly contact/logo/bank/conditions must be supplied; no invented branding.
  Configure these BEFORE creating Devonly projects. Existing snapshots do not
  automatically adopt later changes; create a reviewed copy to use new defaults.
- Formula choices: base/upper run feet OR external cabinet front square feet;
  tall total height feet OR total width feet. No arbitrary formula scripting.
  Granite, splash, LED and services retain their existing calculation methods.
- Per-project rate/quantity overrides still work. Business defaults are not a
  margin guarantee. Owner must review scope, quantities and supplier costs.
- Saved cloud work only: no live stream of unsaved edits or screen monitoring.
- No cross-business project transfer, historical target ledger, or arbitrary
  logo/letterhead positioning editor in this slice.
- No change to kitchen placement/construction algorithms. Manufacturing outputs
  remain preview-level, not a production cutting release.

## Checks completed

134 automated tests pass, including predicate isolation, forbidden staff admin
operations, stale review rejection, copied-project isolation, business formulas,
incomplete Devonly quote rejection and existing kitchen regression tests.
Production build passes (existing large-bundle warning remains).
Four-page Luxus PDF proof rendered and visually checked with embedded test images.
No customer images, private source quotations or credentials committed.

## Required before release — not yet completed

1. Confirm legacy ownership is Luxus. Create an isolated Neon test branch using
   the Neon branch-first workflow; never point local migration at live credentials.
2. Apply the additive migration there; verify legacy projects, staff, assets,
   sign-in, default business rows, member creation and all foreign keys.
3. Sign in as owner and as two operators (one per business). Attempt direct-ID
   project and asset reads/writes across users/businesses; require denial.
4. Configure Devonly using real approved branding/rates/terms. Create a project
   in each business; edit prices, save/reopen and compare quote/PDF totals.
5. Owner opens and edits an operator project without changing its ownership.
   Review revision N; operator saves N+1; approval must no longer count.
6. Test simultaneous owner/operator saves and settings edits: stale writes must
   fail with a conflict, without silently overwriting newer data.
7. Test reassignment, blocking, existing sessions, local recovery, private file
   upload/download and short-lived uploads in flight during reassignment.
8. Check presence active/idle/offline states and last-project access. Check monthly
   boundaries in Sri Lanka time and totals after trash/restore and reassignment.
9. Desktop/mobile UAT: forms, dark/light modes, dashboard, PDFs for both businesses.
   Confirm actual logo layout, maximum-length contact fields and long conditions.
10. Only after explicit approval: plan backup, additive migration, app deployment
    and rollback to previous app build (retain added data/tables).

Database integration and browser UAT are release gates, not claimed complete.
