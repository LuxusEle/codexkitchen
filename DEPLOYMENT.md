# Vercel + Neon deployment

The web app and `/api/cloud` run on Vercel. Neon provides Postgres and Auth. A **private** Vercel Blob store holds project attachments and render ZIPs. Local saving remains available independently.

## Setup

1. Sign in with `gh auth login`, `npx neon@latest login`, and `npx vercel@latest login` (use `npx.cmd` on Windows if PowerShell blocks scripts).
2. Link the existing Neon project, and create/check out a development branch before testing migrations. The supplied project is in `us-east-2`. Do not create an unrelated Neon project or use a temporary claimable database.
3. Copy `.env.example` to `.env.local` if needed. Use the branch's pooled `DATABASE_URL`, direct `DATABASE_URL_UNPOOLED`, and matching Auth URLs. Never prefix database or storage secrets with `VITE_`.
4. Run `npm run db:check`, then `npm run db:migrate` against the development branch. Review the generated migration before applying it to the intended live branch. It only creates `codex_kitchen.projects`, `codex_kitchen.assets`, `codex_kitchen.members`, their constraints and indexes, plus Drizzle's migration journal. It never edits Neon Auth tables.
5. Import `LuxusEle/codexkitchen` in Vercel. The repository root is the app root, framework Vite, build `npm run build`, output `dist`, Node 24. If using the original monorepo instead, set Root Directory to `CODEXKITCHENAPP`.
6. Create/connect a **private** Blob store. Add its `BLOB_READ_WRITE_TOKEN` to Vercel's server environment and your ignored local env for local uploads. Do not use a public store. Client upload tokens are scoped to one pre-authorised file (25 MB maximum, 10-minute expiry); the read-write token never reaches the browser.
7. Set Vercel env variables from `.env.example`, including server-only `ADMIN_EMAIL`. Set the public `VITE_NEON_AUTH_URL` before building. Use matching database/Auth branches for Preview and Production. Migrations are explicit, never run by the Vite build.
8. Add the exact Vercel production domain and required preview domains to Neon Auth's trusted domains. Allow localhost for UAT. Do not use a wildcard for arbitrary origins. Cross-site cookie restrictions can interfere with local browser auth; use Neon's supported custom-domain/proxy guidance rather than disabling browser security.
9. Deploy, then sign up/sign in using the configured admin email and verify that email. The admin panel is under **Cloud / Sign in**. Only the configured, verified admin can approve or block users. No passwords are hard-coded or stored in app tables.

## Accounts and access

- Create the requested admin account through Neon Auth using its configured email. The password is entered at signup, not committed in source or supplied in deployment commands. Rotate any password previously shared in chat.
- `operator1` can be a display name, but Neon email login needs a real email address. Choose at least 8 characters for the password; `123456` is not accepted by this UI. Register the operator, sign in once to create its pending membership, then approve it in the admin panel.
- Approval gates cloud projects/files; the local planner still works offline. The API verifies signed, expiring Neon JWTs with issuer and audience checks on every user request. Owner filters apply to project/file reads and writes. Admin approval does **not** grant access to another user's project data.
- A blocked user cannot obtain new upload tokens or read/write cloud projects. An already-issued upload token remains valid until its short expiry; its file is still private.
- Saved project revisions prevent silent overwrites from another device. On conflict, open the latest cloud version or save a new copy; local data is not discarded automatically.
- Files upload directly to Blob, avoiding Vercel's request-body size limit. A server-side HEAD check verifies ownership metadata, exact path, size, content type and private storage before recording completion. Signed callbacks and an authenticated completion endpoint support hosted and local development.

## UAT before production

Run `npm test` and `npm run build`. Check sign-in/email verification, pending-user denial, admin approval/blocking, two-user project isolation, file isolation, project revision conflicts, save/open with four design alternatives, refresh, and private image/ZIP upload/download. Do not claim cloud UAT complete from a successful build alone.

Secrets are excluded by `.gitignore` and `.vercelignore`. `.env.local` must stay local. Rotate the database password supplied in chat and update local/Vercel server environments before production use.

References: [Neon React Auth](https://neon.com/docs/auth/quick-start/react), [Neon JWT verification](https://neon.com/docs/auth/guides/plugins/jwt), [Vercel private Blob storage](https://vercel.com/docs/vercel-blob/private-storage), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
