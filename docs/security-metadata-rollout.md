# Security metadata rollout

The implementation is intentionally additive. The migration creates the canonical
company/security/listing model, links existing catalog and transaction rows, persists
provider state, and retains every legacy metadata column.

## Migration-history gate

Verified with Supabase CLI `2.116.0`: the linked database reports only
`20260809210716_prepare_transaction_list_api` and
`20260809211158_add_transactions_portfolio_index`. The first version matches locally.
The second corresponds to local version `20260809211149`; both create the verified live
`transactions_portfolio_id_idx` index on `transactions(portfolio_id)`. Older schema
objects also exist in production while their migration files remain in this repository.
Do not run `db push`, repair history in bulk, or reset the linked database.

Read-only inspection confirmed that the live transaction API indexes and optimized
transaction ownership policies exist. It also confirmed intentional live drift in the
transaction numeric/nullability/default definitions. This is not yet sufficient to
mark every missing local version applied: each historical migration still needs an
object-by-object equivalence record, followed by a reviewed, one-version-at-a-time
history repair.

### Historical equivalence audit

The pre-feature migration chain was replayed locally through `20260812211950` and
compared with the linked `public` schema using the strict `pg-delta` engine. No
historical feature table, column, API index, policy replacement, access-token hook, or
service/portfolio object was missing from the linked database. The data-only ticker
catalog migration was checked separately against live rows: all 20 distinct
transaction user/ticker pairs are represented by the 21 catalog rows, with zero
missing pairs. All 62 transaction actions are non-null and use an allowed value.

The following final-state differences are recorded as legacy drift rather than missing
migrations and must not be silently applied by `db push`:

- live transaction shares and price remain `real`, with the previously observed
  nullability/default differences;
- several original transaction constraints, duplicate indexes, and update triggers are
  present only in the replayed baseline;
- the replayed baseline retains four legacy quoted transaction policies alongside the
  canonical policies, while live retains only the canonical policies;
- `touch_updated_at` has a search-path definition difference;
- the local and hosted environments differ in the `supabase_auth_admin` grant on the
  `public` schema.

These differences are either deliberately out of scope for this feature or neutralized
by the additive migration. In particular, the additive migration removes the redundant
quoted transaction policies. The verified blank historical versions through
`20260812211950` may therefore be repaired as applied one at a time;
`20260829191006` must remain pending for the real schema deployment.

Before deployment, use Supabase CLI `2.116.0` and compare local and remote history. For
each missing version, prove the live objects are equivalent before marking that single
version applied. Record any remaining differences as new forward-only migrations. The
live `real` types for transaction shares and price and the current foreign-key behavior
are deliberately outside this feature.

The local verification gate is complete:

- the full migration chain replayed twice from an empty database;
- the additive migration applied to the production-shaped fixture in
  `supabase/validation/security_metadata_fixture.sql`;
- all fixture linkage, shared-symbol deduplication, catalog-only preservation, exact
  override locks, financial parity, and authenticated-user RLS assertions passed;
- a final clean replay passed and the local Supabase security advisor reported no
  warnings.

For a repeatable production-shaped check, reset locally to `20260812211950`, apply the
fixture, apply `20260829191006_persisted_security_metadata.sql`, then execute the three
assertion files under `supabase/validation` with `psql -v ON_ERROR_STOP=1`. The CLI's
`db query --file` path prepares the entire input as one statement and is unsuitable for
these multi-statement validation scripts.

The linked security advisor currently reports leaked-password protection as disabled.
The linked performance advisor also reports legacy auth-init-plan policies and unused
indexes outside this feature; retain these as explicit baseline findings. The new
migration replaces the affected ticker-catalog policies and was deployed only after
migration history was reconciled.

### Linked deployment status

Migration history was reconciled one verified version at a time and now matches locally
and remotely. The additive migration `20260829191006` was deployed successfully. Live
validation confirmed that all 62 transactions and all 21 catalog rows reference valid
listings, 17 shared listings were created, provider identifiers are unique, the
catalog-only listing was preserved, and the legacy/listing financial parity query
returns no differences. All 17 Alpha Vantage refresh records are pending as expected
before the first worker run.

The post-deployment advisor identified two uncovered foreign keys. Forward-only
migration `20260829213238_index_security_metadata_foreign_keys.sql` adds their covering
indexes and has also been deployed. The linked advisor now reports no unindexed foreign
keys and no RLS initialization-plan findings for the security metadata, transaction, or
ticker-catalog slice. Project-level leaked-password protection and unrelated legacy RLS
performance findings remain explicit follow-up work.

## Refresh process

Configure `ALPHAVANTAGE_API_KEY`, then invoke the finite worker with:

```text
dotnet App.Api.dll --run-security-metadata-refresh=true --metadata-limit=10
```

Use `--metadata-force=true` only for a reviewed re-fetch. The default 20-request budget
keeps five requests below Alpha Vantage's current free daily limit. A listing consumes at
most two requests. Successful metadata is refreshed after 90 days; incomplete and
not-found metadata retries after 30 days. Provider errors back off exponentially and a
rate-limit result defers the rest of the claimed batch.

Schedule the same container image as a daily finite job. Yahoo remains the live quote
provider and is not part of this worker.

## Cutover and cleanup gates

Do not create or apply the destructive cleanup migration until all of these are true:

- every transaction and catalog row has a valid listing link;
- all active holdings are succeeded or explicitly reviewed as incomplete;
- every migrated manual classification has a reviewed canonical equivalent;
- the parity query reports no quantity or cost differences;
- deployed telemetry reports no legacy fallback use;
- two daily snapshot jobs and the metadata job have completed successfully;
- the observation window has completed with no unresolved RLS or advisor findings.

Only then should a separate migration require listing IDs, rename transaction currency,
drop legacy metadata columns, and remove compatibility DTO and dual-write code. That
destructive migration is intentionally absent from this change set.
