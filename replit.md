# Nourish360

Nourish360 is a **synthetic demonstration** of maternal, postpartum, and child health workflows in Sonipat. Do not enter real patient details. For real emergencies, call 108 directly; no action in the app dispatches an ambulance.

## Try the demo

- Choose a **Demo quick-fill** case on the home screen to open an isolated, editable copy with three visits: Aarav (child / green), Meena (pregnant / amber), Sunita (postpartum / red).
- Or choose a role, register with an invented name and a fictional number such as `0000000000`, grant consent, and use the displayed demo OTP. No SMS or call is sent. Returning-user examples are listed in the login tab.
- Open a demo profile online before going offline. In an offline-capable browser, the cached app shell, synthetic record, draft, and assessment rules remain available without a connection. Queued visits retry while the app is open and when it reconnects. Registration, authentication, exports, erasure, tele-review logging, and starting a new ambulance drill need a connection.
- The **Ambulance drill** uses fixed demonstration pickup points and a synthetic route, not live GPS or hospital availability. Map tiles need connectivity. The role-specific emergency checklist remains available offline. No family calls, clinic appointments, or bookings are sent to a provider.
- **DPDP controls** exports the synthetic record as JSON, signs out and clears the local copy, or permanently erases the synthetic profile and visits. Erasure detaches and de-identifies the revoked consent entry. The app only appends to its audit trail; this is not a tamper-proof database audit system.

## Run and maintain

- Run the Nourish360 web and API Server managed workflows together. The API uses the managed PostgreSQL database and the workspace `SESSION_SECRET` for cookie signing.
- `pnpm --filter @workspace/db run push` applies schema changes to the **development** database. The API seeds the template cases and demonstration facilities on startup. Managed production schema changes go through Publish, not API startup.
- `pnpm --filter @workspace/api-spec run codegen` regenerates React API helpers and request/response schemas after editing the API contract.
- `pnpm --filter @workspace/nourish360 --filter @workspace/api-server run typecheck` checks both Nourish360 services after library types have been built with `pnpm run typecheck:libs`.
- `artifacts/nourish360/src` contains the web workflow, `artifacts/api-server/src` the backend, `lib/db/src/schema` the database schema, and `lib/nourish-logic` the deterministic evaluator and capability-selection logic shared online and offline. Use the shared evaluator when revising rules so offline and server behavior remain consistent.

## Before any clinical pilot

Clinical rules, facility data, and forecasts are illustrative and have not been independently validated. No DPDP compliance certification or representation is made. A real rollout needs qualified clinical and privacy review, authorization and verification for live emergency dispatch and facilities, contracted SMS/voice delivery and stronger identity verification, a shared-device offline privacy design, production-grade audit immutability and retention, and operational safety testing on the target devices and networks. Do not enable real data collection or remove the demo messaging without addressing these requirements.
