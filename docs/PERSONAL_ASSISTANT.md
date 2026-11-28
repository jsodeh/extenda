# Personal assistant upgrade

This branch extends the existing side panel, Knowledgebase, History, Integrations, voice tool router and workflow approval dialog. The API and scheduled worker share PostgreSQL. Browser steps use the signed-in MV3 service worker. The release can be evaluated locally without publishing a post, sending an invitation or connecting a production database.

## Issue status and evidence

| GitHub issue | Implemented | Verification and remaining limits |
| --- | --- | --- |
| [1 · Stability](https://github.com/jsodeh/extenda/issues/1) | Route aliases, owner-scoped chat and socket delivery, resolved action reviews, per-step persistence, cancellation, duplicate request claims and CI | Concurrent approval attempts, wrong owner, cancellation, restart at an approval and required-step failure tested on PostgreSQL. An in-flight external write interrupted by process or browser loss requires checking provider history. |
| [2 · Knowledgebase](https://github.com/jsodeh/extenda/issues/2) | Private originals, real uploads, extraction, optional OCR and vectors, cited search, preview, replacement, retry, deletion, tags, editable profile and writing preferences | Real Chrome upload, close, reopen and source-grounded CV chat passed with both the local model fixture and development Gemini. PDF and DOCX extraction and two historical database layouts tested. Gemini OCR transcribed a synthetic test image. OpenAI embedding delivery awaits a development key. A PDF mixing text pages with scanned-only pages can need external OCR before upload. |
| [3 · Form automation](https://github.com/jsodeh/extenda/issues/3) | Accessible control inspection, grounded mapping, missing-answer review, page-bound filling, reviewed original-file attachment, next-step handling and submission evidence | A real Chrome fixture covered target changes, filling, in-page navigation, current-answer approval and a confirmation receipt. File chooser restrictions, CAPTCHA, MFA, cross-origin frames and navigation that destroys the content script can require manual completion. |
| [4 · Planning](https://github.com/jsodeh/extenda/issues/4) | Calendar selection, free/busy checks, attendee handling, event revisions, timezone preferences, recurring events and reminders, PostgreSQL job claims, worker and History view | Real database tests covered duplicate workers, DST and interrupted delivery. Google requests were mocked. Credentials, hosted cron execution and live invitations await staging verification. |
| [5 · LinkedIn](https://github.com/jsodeh/extenda/issues/5) | Personalized private drafts, editing, visibility, per-version approval, immediate and scheduled publishing, local publication history and manual copy | Mocked identity, refresh, permission failures, rate limits and provider-issued receipts. Real PostgreSQL test verified editing cancels a scheduled version. Live member publishing requires an authorized LinkedIn application and member. |

All five GitHub issues were left open. The review branch is `upgrade/personal-assistant`, based on `a51b44b`. The release targets a draft review against main.

## Run locally

Use Node 22 or newer, pnpm 8.9.0, Chrome and a disposable PostgreSQL database with the vector extension installed. The repository's Compose PostgreSQL service supplies pgvector.

1. Run the following from the repository root. The Compose command starts the local database service. Set up a separate local database if port 5432 is already in use.

   ```sh
   pnpm install --frozen-lockfile
   docker compose up -d postgres
   ```

2. Create a private `apps/api/.env` from `apps/api/.env.example` if one does not already exist. Set `DATABASE_URL` to the local database, for example `postgresql://postgres:password@localhost:5432/extenda`. Supply a random signing secret for `JWT_SECRET` and a separate stable 64-character hexadecimal `ENCRYPTION_KEY`. Generate each independently with `openssl rand -hex 32`. Set the OAuth client and registered callback for the login provider you will use. Keep the environment file out of Git.

3. Build, migrate and run the local API. For a local-only test bundle, set both extension URLs to the local API during build. The API also applies pending journaled migrations at startup.

   ```sh
   VITE_API_URL_LOCAL=http://localhost:3000 VITE_API_URL_CLOUD=http://localhost:3000 pnpm -r run build
   pnpm db:migrate
   pnpm --filter api start
   ```

4. Open `chrome://extensions`, enable developer mode and load `apps/extension/dist` unpacked. Open the Extenda side panel, select the local backend, sign in and configure a supported model for the selected BYOK provider. Use one connected browser for browser automation. For a Docker-hosted API using local Ollama, set the trusted host origin explicitly.

5. To exercise scheduled delivery locally, run `node apps/api/dist/scripts/run-scheduler.js` from the root against the same local environment. Each invocation processes due jobs and exits. A real installation needs the minute trigger enabled.

## Try the assistant

- **Personal knowledge** — Upload a synthetic CV through Knowledgebase. Inspect the extracted text and confirm or correct suggested fields under **Preview / profile**. Reopen the extension, start a new conversation and ask “What are my qualifications and previous work experiences?” Compare the citations with the original. The chat composer also offers a separate option to keep attachments permanently.
- **Forms** — Open a test application in an ordinary HTTP(S) tab. Ask “Use my CV to complete this application.” Inspect the proposed field values, missing answers, original file and destination. Edit in the review or on the page. Ask to submit when ready. The website must show a recognizable receipt for Extenda to confirm submission. Check the site after an uncertain outcome before issuing another request.
- **Planning** — Desktop reminders appear when Chrome is connected or after it reconnects. Set an IANA timezone under **History → Scheduled tasks** and connect a test Google account. Ask for two development hours each day and a Friday review reminder. Review each time, selected calendar, invitee and recurrence. Calendar creation rechecks availability at execution. Finite DAILY and WEEKLY RRULEs with COUNT and optional INTERVAL are checked occurrence by occurrence across up to one year. Ambiguous daylight-saving times, complex or open-ended rules and time changes to an existing series require review in Google Calendar. Calendar availability is a point-in-time provider check. Another calendar client can book a slot after the final check.
- **LinkedIn** — Ask for three posts for Monday, Wednesday and Friday based on a test CV and project. Review and edit them under **Integrations → LinkedIn drafts**. Approve each author, text, link, visibility and time. Edits cancel the previous pending version. The manual copy button works without publishing permission. A post link requires LinkedIn's creation receipt.
- **Unified workflows** — The planner can combine form inspection, profile/document retrieval, reviews, calendar work and private drafting. Dependent steps use actual tool results. An unavailable provider or required step failure stops that workflow. Inspect history for any earlier actions that already completed.

## Configuration and data flow

| Setting | Purpose |
| --- | --- |
| `DATABASE_URL` | Same PostgreSQL database for the API and cron. Provide a separate `TEST_DATABASE_URL` for tests. |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Persistent signing secret and AES-256-GCM OAuth key. The worker needs the same encryption key as the API. Preserve previous keys with backups. |
| `EXTENSION_ORIGINS` | Comma-separated exact `chrome-extension://<id>` origins permitted for production login, browser API requests and sockets. The unpacked extension ID is visible at `chrome://extensions`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth application with Calendar API enabled and access to the target calendar. The legacy name `GOOGLE_AUTH_CLIENT_SECRET` also works. Register `GOOGLE_AUTH_REDIRECT_URI` for login at `/oauth/auth/callback/google` and `GOOGLE_REDIRECT_URI` for linking at `/oauth/callback/google`. Calendar writes need event permission, availability and calendar lookup need read permission. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn application with OpenID Connect and Share on LinkedIn. Register `LINKEDIN_INTEGRATION_REDIRECT_URI` at `/oauth/callback/linkedin`. The separate login setting `LINKEDIN_REDIRECT_URI` points at `/oauth/auth/callback/linkedin`. |
| `KNOWLEDGE_OPENAI_KEY`, `KNOWLEDGE_EMBEDDING_MODEL` | Optional OpenAI embeddings for opted-in files. The default model is `text-embedding-3-small`. The configured model must support 1,536 output dimensions. Search compares embeddings from matching model versions. Replace or reprocess affected documents after changing models. |
| `KNOWLEDGE_OCR_MODEL`, `GEMINI_API_KEY` | Optional multimodal transcription of images and image-only PDFs. Select a currently available Gemini model that accepts the file type. The user must enable OCR for the upload. |
| `GEMINI_VISION_MODEL` | Optional available Gemini model for the existing screenshot-based browser tool. |
| `OLLAMA_ALLOWED_ORIGINS` | Trusted remote or Docker model origins. During local development, localhost and loopback HTTP(S) origins are also accepted. Production requires an explicitly configured origin. |
| `INTEGRATION_CREDENTIAL_OWNER` | Optional UUID of the single user who may use legacy administrator-configured integration tokens. New per-user OAuth connections take precedence. |
| `VITE_GEMINI_LIVE_MODEL` | Optional extension build-time Gemini Live model override. Voice uses the member’s Gemini key. |
| `VITE_API_URL_LOCAL`, `VITE_API_URL_CLOUD` | Extension build-time API destinations. Register a changed deployment origin in the MV3 extension page connect policy before distributing it. |

The library stores original bytes, extracted passages, source locations and any confirmed facts in the user's PostgreSQL records. Files are limited to 10 MiB. Keyword retrieval, PDF text extraction and DOCX body extraction run locally on the API. OCR sends the original to Gemini. Opt-in semantic indexing sends passages and subsequent search queries to OpenAI. Chat, form mapping and drafting send selected excerpts and conversation context to the user's selected model. Profile suggestions send a bounded preview of the selected document to that model. Vision-assisted clicks send a screenshot to the configured vision provider. Preview and download require authentication. Desktop notifications can display reminder text.

Deleting a library document removes its live original, chunks and document-bound profile. Prior chat messages, published material, separately approved drafts, remote provider retention and database backups have separate lifetimes. Manage disk encryption, restricted backup access and backup expiry on the deployment. Chat attachments stay temporary unless explicitly saved. Switching environments can optionally copy existing chat and workflow history with consent.

LinkedIn member publishing uses the self-serve UGC endpoint, OpenID member identity and `w_member_social`. The app verifies the author again before the write. A refresh token is used when the provider issues one. Expired or revoked access can require reconnecting. See [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) and [LinkedIn refresh tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens).

## Verification

At baseline, workspace package builds passed. The root Turbo build hit a macOS sandbox certificate-store error, the API lacked a test script, and extension Jest stopped during configuration. The revised root build passed all three packages with normal certificate-store access. TypeScript runs in each package build. Vite still warns about the side panel bundle size and the existing browsers database.

```sh
pnpm run build --force
pnpm --filter @extenda/extension run test --runInBand
TEST_DATABASE_URL='postgresql://localhost/extenda_test' pnpm --filter api run test
```

Use a disposable test cluster with pgvector and permission to create databases. The legacy layout tests create uniquely named databases and drop them on completion. The CI job supplies a pgvector service. Without `TEST_DATABASE_URL`, database integration tests skip. The local release check ran them against PostgreSQL 18.1 and pgvector 0.8.2. The checked-in suites comprise 27 API tests and ten extension tests. Provider tests use synthetic identities and mocked HTTP calls. A separate development Gemini run verified cited CV chat, a private LinkedIn draft, reviewed form filling and a persisted weekly reminder in Chrome. The extension’s Gemini Live session manager negotiated its tool declarations and decoded reply audio for synthetic text; microphone capture, speaker playback, live sign-in and hosted alerts still require staging verification. The combined Chrome fixture used the real extension and API to fill education from a stored CV, leave an unsupported certification blank, save a private LinkedIn draft and persist an approved weekly reminder.

The optional `apps/extension/scripts/personal-assistant-smoke.cjs` exercises the compiled MV3 bundle with Chrome for Testing, a real API, Socket.IO and PostgreSQL. It needs a migrated disposable local test database, a Chrome for Testing executable, and an installation of `playwright-core` compatible with that executable. The runtime and ordinary CI do not require Playwright. Run from the repository root with ports 55871 and 55872 available.

```sh
export TEST_DATABASE_URL='postgresql://localhost/extenda_test'
DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
export SMOKE_EXTENSION_DIR="$(mktemp -d)"
VITE_API_URL_LOCAL=http://localhost:55871 VITE_API_URL_CLOUD=http://localhost:55871 pnpm --filter @extenda/extension exec vite build --outDir "$SMOKE_EXTENSION_DIR"
# Point CHROME_BIN at Chrome for Testing and PLAYWRIGHT_MODULE at the installed playwright-core module.
node apps/extension/scripts/personal-assistant-smoke.cjs
```

## Migration, deployment and rollback

1. Take a consistent database snapshot and record the current extension, API and worker revisions. Restore the snapshot into an isolated staging database and run the migration against that staging URL. Keep the journal and existing vector data together.
2. Install the pgvector extension files on the database host. Use a migration role permitted to create the extension, or have the database administrator enable it first. Run `DATABASE_URL="$STAGING_DATABASE_URL" pnpm db:migrate` after confirming that variable points to staging. Use the existing journal through migrations 0008–0013. The compatibility migration preserves UUID-era documents and vectors, imports their text and retains the IDs and chunks of the integer layout. Historical rows lacking stored original bytes require a replacement upload for download or attachment.
3. Build the API and extension from the same revision. Configure login, provider callbacks and secrets on staging. The web command is `pnpm --filter api start` and the health route is `/health`. Configure the cron service from `render.yaml` or an equivalent minute trigger for `node apps/api/dist/scripts/run-scheduler.js`. Give it the same database, encryption key and relevant OAuth client credentials. Worker hosting and any charges require deployment authorization.
4. Inspect pending, running, failed and uncertain jobs in History. The worker claims rows with PostgreSQL locks. An interrupted external delivery is quarantined after 20 minutes. Check provider history before creating a replacement. At startup and on each worker invocation, interactive runs idle for 30 minutes are recorded as interrupted. Pending approvals remain available when the chat reopens. Browser-dependent actions require an open connected Chrome extension. Server-side jobs can run while Chrome is closed, and desktop reminders are delivered when the extension reconnects.
5. To roll back, disable the new trigger, stop new writes, reconcile in-flight external actions and retain a snapshot of new user data. Roll the API, worker and extension back together. Restore the matching pre-upgrade database into a separate instance before switching traffic, particularly for the historical UUID layout. Verify login, stored originals and chat against the intended database. Restoring a backup can discard post-snapshot writes and cannot undo published posts, invitations or submissions. Keep the new snapshot for recovery.

## Credential and form approval compatibility

The corrective release uses the existing credential table and encryption key. On credential or integration-status lookup, the API locks the user row and moves any legacy Google tokens out of the users table. A current canonical grant takes precedence. Legacy-only records carry no reliable disconnect history, so their encrypted copy stays inactive until an explicit Google connection replaces it. Disconnect atomically clears pending integration links, the canonical grant and both legacy columns. A provider request already dispatched can finish before disconnect returns. A late refresh cannot restore access.

Calendar and LinkedIn jobs retain their reviewed account binding. After disconnect, account replacement, or upgrade from a job without a binding, the worker stops delivery. Review a new job against the connected account. Workflow approvals for the former account cannot authorize the replacement. Existing reminders continue on their original schedule. No extra notification service or schema migration is required for these corrections.

Form review records the intended form, target fields, labels, control types, choices and submission destinations. A replacement form at the same URL requires a fresh review. Controlled inputs can rerender with the same field identity. An external form action or submitter override requires manual completion. Form mapping uses explicit source facts and leaves unsupported, expired, conflicting or ambiguous professional answers for the user. Free-form CV prose may require a confirmed profile entry or manual answer.

The regression suite exercises ambiguous legacy credentials, concurrent refresh and disconnect, account replacement, stale scheduled work, field and destination changes, and unsupported claims. The Chrome fixture also replaces a form while its workflow approval is open, checks that the replacement remains blank, then approves the new review.

## Release gates and staging verification

The repository targets Render and PostgreSQL with pgvector. The production server version, installed vector version and live cron configuration could not be established from this checkout. The local database used PostgreSQL 18.1 and pgvector 0.8.2. CI exercises PostgreSQL 15 and 18. Release operators should record the actual versions, timestamp and successful staging run before rollout.

1. Use an authorized read-only connection to the actual deployment. Run the following SQL and record only its result. Then restore a backup into a **disposable staging database** with the same major version and extension version. Run the journaled migrations twice on staging, verify row counts for each owner and both old document layouts, and download a synthetic original. Migration 0013 protects the approved job payload and allows a worker to advance the due time for repeats or retries. The API serializes migration startup with a PostgreSQL advisory lock. The migration role needs DDL permission and two available database connections.

   ```sql
   BEGIN READ ONLY;
   SELECT current_setting('server_version') AS postgres_version,
          (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS installed_vector,
          (SELECT default_version FROM pg_available_extensions WHERE name = 'vector') AS available_vector;
   ROLLBACK;
   ```

2. Run a single API replica. Browser routing and pending Socket.IO response listeners live in that process. The PostgreSQL scheduler can run in a separate process, and concurrent job claims use row locks. The Render cron must run every minute, in UTC, with network access to the same database and provider endpoints. Render bills cron separately. Ensure migrations have finished before enabling the trigger. Submit a synthetic reminder due in three minutes, record its job UUID from History, close Chrome, restart the staging API, and observe the cron invocation and the completed job. Reopen Chrome and verify a single notification. Check worker exit status and monitor overdue pending, failed and uncertain jobs. A worker processes up to 40 jobs per invocation. Retryable LinkedIn throttling respects Retry-After. After an interrupted external write, reconcile the provider's history before scheduling again. [Render cron documentation](https://render.com/docs/cronjobs)

3. Use a test Google member and the registered staging callback URLs. Sign in, link Calendar and select a secondary test calendar. Check free/busy across a finite series with a conflict at occurrence two, remove the fixture conflict and review an event with no attendees. Verify its event ID and time in that calendar. Using a test grant with offline consent, repeat a read after access-token expiry and check that it succeeds without interactive login. Revocation should surface a reconnect error. Use an ordinary Chrome microphone for a two-way voice conversation and decline a voice email action. Inspect the recipient mailbox only in a test setup.

4. For embedding verification, configure the staging-only `KNOWLEDGE_OPENAI_KEY` and a model supporting 1,536 dimensions. Upload a synthetic CV with semantic indexing enabled. Check `vector_dims(embedding)`, the stored model and the document's owner in staging; try a paraphrase from a new chat, then repeat from a second account. Deleting the CV should remove its original, chunks, vectors and confirmed profile from live queries. For OCR, opt in on a generated image or image-only PDF and compare literal text against the preview. Voice, OCR and retrieval use separate configuration paths.

5. Give a LinkedIn development application the OpenID Connect and Share on LinkedIn products and configure the member integration callback. Link a consenting test member; verify the identity, granted scope and expiry. Save and edit a private draft. Schedule that version, edit it, and verify the old job was cancelled. Only proceed to real member publishing with explicit authorization for the exact text, member, visibility and time. Check the returned post link and the member's activity. Revoke the grant and verify that manual copy remains usable.

6. Build the release Docker image on a host with a running daemon and smoke-test its health endpoint against the staging database.

7. Rotate the database credential previously embedded in the two historical maintenance scripts and audit access. If any deployment used the historical Compose signing or encryption defaults, replace them with independently generated secrets. Preserve an encrypted backup and plan re-encryption or account reconnection before changing an OAuth encryption key. Existing Git history and clones may retain old values. Use the journaled migration command for rollout.

## Changed files

For all release changes, run `git diff --name-status a51b44b...HEAD`. Paths below are relative to the repository root. The Jest configuration moved from TypeScript to CommonJS. To inspect individual patches, use `git diff a51b44b..HEAD -- <path>`.

<details>
<summary>121 paths in the original five phases, through 5313296</summary>

```text
.github/workflows/check.yml
README.md
apps/api/.env.example
apps/api/migrations/0002_milky_random.sql
apps/api/migrations/0008_schema_sync.sql
apps/api/migrations/0009_document_library.sql
apps/api/migrations/0010_scheduled_jobs.sql
apps/api/migrations/0011_linkedin_drafts.sql
apps/api/migrations/0012_workflow_requests.sql
apps/api/migrations/meta/_journal.json
apps/api/package.json
apps/api/src/adapters/airtable.ts
apps/api/src/adapters/asana.ts
apps/api/src/adapters/browser-interaction.ts
apps/api/src/adapters/buffer.ts
apps/api/src/adapters/calendly.ts
apps/api/src/adapters/clickup.ts
apps/api/src/adapters/gmail.ts
apps/api/src/adapters/google-calendar.ts
apps/api/src/adapters/google-docs.ts
apps/api/src/adapters/google-drive.ts
apps/api/src/adapters/google-forms.ts
apps/api/src/adapters/google-sheets.ts
apps/api/src/adapters/hootsuite.ts
apps/api/src/adapters/hubspot.ts
apps/api/src/adapters/index.ts
apps/api/src/adapters/jira.ts
apps/api/src/adapters/linkedin.ts
apps/api/src/adapters/notion.ts
apps/api/src/adapters/planning.ts
apps/api/src/adapters/slack.ts
apps/api/src/adapters/system-utils.ts
apps/api/src/adapters/tab-manager.ts
apps/api/src/db/migrate.ts
apps/api/src/db/schema.ts
apps/api/src/env.ts
apps/api/src/index.ts
apps/api/src/lib/__tests__/approval.test.ts
apps/api/src/lib/__tests__/calendar.test.ts
apps/api/src/lib/__tests__/documents.test.ts
apps/api/src/lib/__tests__/library-db.test.ts
apps/api/src/lib/__tests__/linkedin.test.ts
apps/api/src/lib/__tests__/migration.test.ts
apps/api/src/lib/__tests__/publication-db.test.ts
apps/api/src/lib/__tests__/schedule.test.ts
apps/api/src/lib/__tests__/workflow-db.test.ts
apps/api/src/lib/__tests__/workflow-dependencies.test.ts
apps/api/src/lib/approval.ts
apps/api/src/lib/auth.ts
apps/api/src/lib/crypto.ts
apps/api/src/lib/models.ts
apps/api/src/lib/scheduling.ts
apps/api/src/lib/workflow-dependencies.ts
apps/api/src/routes/auth-oauth.ts
apps/api/src/routes/config.ts
apps/api/src/routes/knowledge.ts
apps/api/src/routes/linkedin.ts
apps/api/src/routes/oauth.ts
apps/api/src/routes/schedule.ts
apps/api/src/routes/templates.ts
apps/api/src/routes/user.ts
apps/api/src/routes/vision.ts
apps/api/src/routes/voice-tools.ts
apps/api/src/scripts/run-scheduler.ts
apps/api/src/server.ts
apps/api/src/services/chat-service.ts
apps/api/src/services/file-processor.ts
apps/api/src/services/intent-classifier.ts
apps/api/src/services/knowledge-base.ts
apps/api/src/services/linkedin.ts
apps/api/src/services/oauth-manager.ts
apps/api/src/services/orchestrator.ts
apps/api/src/services/scheduler.ts
apps/api/src/services/vision-analyzer.ts
apps/api/src/services/workflow-persistence.ts
apps/api/src/tools/ai-processor.ts
apps/api/src/tools/definitions/base-tools.ts
apps/api/src/tools/definitions/content-tools.ts
apps/api/src/tools/form-answers.ts
apps/api/src/tools/registry.ts
apps/extension/jest.config.cjs
apps/extension/jest.config.ts
apps/extension/manifest.json
apps/extension/package.json
apps/extension/scripts/personal-assistant-smoke.cjs
apps/extension/src/background/index.ts
apps/extension/src/components/ApprovalGate.tsx
apps/extension/src/components/LinkedInDrafts.tsx
apps/extension/src/components/OnboardingWizard.tsx
apps/extension/src/components/__tests__/NavigationMenu.test.tsx
apps/extension/src/components/chat/InputArea.tsx
apps/extension/src/components/chat/ModelSelectDropdown.tsx
apps/extension/src/content/__tests__/forms.test.ts
apps/extension/src/content/dom-reader.ts
apps/extension/src/content/form-filler.ts
apps/extension/src/content/index.ts
apps/extension/src/contexts/auth-context.tsx
apps/extension/src/lib/api.ts
apps/extension/src/lib/environment-service.ts
apps/extension/src/lib/oauth.ts
apps/extension/src/lib/tools/screenshot.ts
apps/extension/src/lib/tools/smart-click.ts
apps/extension/src/lib/tools/tab-manager.ts
apps/extension/src/lib/tools/tool-router.ts
apps/extension/src/lib/voice/session-manager.ts
apps/extension/src/lib/websocket-background.ts
apps/extension/src/lib/websocket.ts
apps/extension/src/pages/HistoryPage.tsx
apps/extension/src/pages/IntegrationsPage.tsx
apps/extension/src/pages/KnowledgebasePage.tsx
apps/extension/src/pages/SettingsPage.tsx
apps/extension/src/sidepanel/App.tsx
apps/extension/vite.config.ts
docker-compose.yml
docs/PERSONAL_ASSISTANT.md
package.json
packages/shared/src/events.ts
packages/shared/src/index.ts
packages/shared/src/profile.ts
pnpm-lock.yaml
render.yaml
```

</details>
