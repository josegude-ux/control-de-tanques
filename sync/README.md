# Automatic synchronization preparation

This branch is not deployed and is not yet wired to app.js. It preserves the current local application.

Implemented: account-isolated IndexedDB outbox, automatic retries while open, online/resume triggers, manual sync entry point, server acknowledgement before deleting pending work, optimistic revisions, conflict retention, and mutation IDs for idempotent retries. A separate Supabase migration defines membership, access policies, record revisions and an audit trail without changing Control de Cargas tables.

Validation: `node --test sync/engine.test.mjs`. These tests use a simulated server, not a live Supabase project.

Before deployment:

- Connect the authorized Supabase project, inspect existing authentication and policies, and apply/review the migration there.
- Assign actual accounts to Almacén, Reparto and Gerencia; never derive permissions from the local demo profile picker.
- Add domain payload validation to the database and explicitly separate timing payloads from shared records.
- Wire authenticated account lifecycle and transactional enqueue into the existing local operations. Capture local changes and their outbox entries atomically before allowing automatic uploads. Never upload fictitious demo stock as live opening stock.
- Implement movement reconciliation for vehicle/cistern balances, correction/cancellation handling, customer/plan updates, conflict resolution UI and manager views. Do not overwrite local balances with another device's snapshot.
- Test actual two-device offline/reconnect, corrections, account changes, access denial and deployment/update paths before merging.

The current schema is a foundation. It must not be presented as a finished stock synchronization system.
