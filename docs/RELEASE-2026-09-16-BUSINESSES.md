# Business administration and quotation release

User approved isolated database testing followed by deployment on 2026-09-16.
This release supersedes the local-only status in the earlier UAT/roadmap notes.

- Application source: `50d94de` (includes feature commit `75abdb9`).
- Production: https://codexkitchen.vercel.app
- Deployment: `dpl_D51t8s5d4jAJ39scrg6429D44qkq`.
- Previous deployment for app rollback: `dpl_E7kXSf225fNYwsP7CpqGBhmGDc92`.
- Neon project: `silent-salad-81470619`; production branch `br-broad-flower-b4a0av8a`.
- Migration 0003 tested on isolated `br-bitter-poetry-b4rl3gsz`, then applied to
  production. Existing project/member/asset data fingerprints unchanged.
- Production counts after migration: 4 projects, 2 members, 2 businesses.
- Isolated integration checks passed for owner/business SQL access, presence,
  reviews and overview queries. Temporary test fixtures were rolled back.
- Recovery branch before production migration: `br-blue-meadow-b4qq8m98`.
  Recovery and test branches expire 2026-09-18 20:00 UTC. They are not permanent backups.
- Build succeeded. Public home serves new asset `index-CVvaO2zK.js`.
- Live config confirms database/auth/storage; anonymous project/business APIs
  return 401; anonymous session endpoint returns null.

No local environment configuration was replaced. A temporary ignored production
environment verification file was removed after checking configuration.

Not claimed complete: signed-in owner/operator browser UAT, mobile UAT, actual
Devonly branded quote verification. Devonly logo/contact/bank/conditions need
owner configuration before creating its quotation projects. Existing projects
remain Luxus. Pricing snapshots and per-project overrides remain as documented.

Git main was not merged or pushed by this release; Vercel was deployed from the
development checkout and explicitly promoted. Before a later main deployment,
merge the approved feature to avoid accidentally reverting the application.
