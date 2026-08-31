# Security metadata validation

These scripts validate the additive `Company -> Security -> SecurityListing`
model before legacy metadata is removed.

## Production parity report

Run the read-only consolidated report against the linked project:

```powershell
npx --yes supabase@2.116.0 db query --linked --file supabase/validation/security_metadata_parity_report.sql
```

The report returns one result set because the linked Supabase query API exposes
only the final result set from a SQL file.

- Every `gate` row must have status `pass` before consumer cutover.
- A `review` row lists explicit incomplete, unknown, failed, or
  provider-discovered metadata that requires an operator decision.
- An `info` row records inventory or a check that must run at another layer.
- Quantity and cost-basis parity are proven in SQL. Live quote market value and
  allocation parity remain API-level cutover checks.
- After consumer cutover, legacy/canonical parity covers the historical rows
  that still contain legacy symbols. The canonical-only transaction and
  catalog counters show new writes that intentionally leave duplicated legacy
  metadata null during the observation window.

The report is safe to rerun: it contains only `SELECT` statements and creates
no persistent database objects.

## Local migration checks

- `security_metadata_fixture.sql` loads representative pre-migration data.
- `security_metadata_backfill_assertions.sql` fails when fixture backfill or
  parity expectations are violated.
- `security_metadata_rls_assertions.sql` checks authenticated-user isolation
  and read-only access to shared canonical metadata.
- `security_metadata_validation.sql` contains the detailed exploratory queries
  used while reviewing individual mappings, policies, grants, and holdings.
