# Energy & Bills — proposed first version

Status: first implementation available at `/energy`. The original design preview remains a separate, non-persistent demonstration.

## Scope

Prioritize the current ZeniΘ monthly electricity format. Keep provider adapters extensible for historical DEI imports. Reuse Terminal Hub's orange accent, terminal headings, analytics panels, and responsive tables. Keep existing English/Greek localization; Greek bill language does not force a change to the user's app language.

## Overview

- Header: Energy & Bills, period filter, upload PDF, manual entry fallback. Omit property/provider pickers until there is more than one choice.
- Summary: billed costs, recorded kWh, and monthly average for sufficiently covered calendar periods. While coverage is sparse, show average bill with its bill count rather than presenting it as average monthly household cost.
- Annual chart: cost by invoice issue month; separate consumption view by billing period, with an explicit calendar-allocation option in the implementation.
- Charge breakdown: supply after discounts, regulated charges, taxes/fees, and third-party charges.
- Bill list: issue date, consumption interval, actual/estimated type, kWh, current-period charges, total due, detail action.
- Compare equivalent covered periods across years. Show missing months and incomplete years explicitly. Do not invent comparisons when only one bill is present.
- Payments are separate from billed amounts. Direct-debit instructions do not mean that a bill was paid.

## Import and compact review

1. Select PDF. Extract embedded text locally with PDF.js. Check every page and retain text positions so column layouts can be interpreted correctly. Offer manual entry for unsupported layouts; OCR can follow when a real scanned sample is available.
2. Recognize provider/layout and extract to a draft. Nothing reaches stored analytics yet.
3. Show the original PDF beside a compact summary on desktop; stack them on mobile. Real implementation includes zoom and page controls.
4. Display provider, bill type, consumption interval and days, kWh, four summary charge groups, current-period total, and amount due when different. Issue/due dates are secondary metadata. Show previous balances, adjustments, or extraction uncertainty only when relevant.
5. Keep fixed charge and discount collapsed, already included in supply. Allow direct corrections without a field-by-field wizard. Expand edit mode to include provider/type/dates as well as numeric values in production.
6. Accept and save after validation. If the source total differs from component sums, require correction or an explicit unresolved adjustment; never silently replace the source amount. Detect duplicate document hashes and provider invoice IDs.

The interactive design preview uses a sanitized textual document excerpt; the production review must show the original PDF. Its upload action uses the supplied sample, and its save action changes only preview memory.

## Data and calculation decisions

Store the accepted summary, source-reported billing days and dates, provider invoice identity, actual/estimated type, breakdown components, current charges, balances/credits, and total due. Keep extracted candidates separate from accepted values. Review uses the local file independently of summary storage.

First-version retention decision: save accepted summaries, PDF hash, source filename, and parser version only. No PDF bytes or raw extracted text are sent to the server. Re-uploading a previously saved PDF offers to open the existing record with the local PDF for comparison.

Use decimal amounts and provider-rounded line values. Keep supply rates and effective total cost per kWh distinct. Do not count discounts or fixed charges twice. Preserve missing versus zero. The sample is a 29-day September–October interval issued in November: issue-month spending and consumption-month allocation must remain distinct. Allocation by days is an estimate, never measured calendar-month consumption. Estimated/settlement reconciliation remains required for historical DEI records.

## Implementation sequence

1. Review the overview and compact-review design.
2. Implement authenticated bill CRUD and owner isolation, domain calculations, localized frontend, and manual entry.
3. Add browser PDF.js extraction, versioned ZeniΘ field mapping, draft validation, compact review, and duplicate checks.
4. Verify the supplied sample end to end, malformed/unsupported PDFs, incorrect totals, missing fields, cross-month/year periods, and duplicate submissions. Use sanitized fixtures rather than committing personal source PDFs.
5. Add historical DEI reconciliation and scanned-document OCR after the primary flow works.

## Preview

`output/design/energy-bills-preview.html` shows the overview, sample selection, review, numeric corrections, confirmation, and cost/consumption switching. Only the one supplied current-provider bill populates the design, so the preview does not imply a complete annual dataset.

## Verification of the implementation

- Production frontend build and TypeScript checks passed. PDF.js and its worker are loaded on demand for import/review.
- Targeted ESLint checks and the production backend Docker build passed. The Docker restore stage includes the new Energy project.
- All 40 frontend unit tests passed, including synthetic Greek/positioned PDF extraction, mismatched totals, missing fields, cross-month/year allocation, and overlapping estimates.
- Backend suite: 168 passed, 6 existing database-dependent tests skipped. The new Energy database test ran against disposable PostgreSQL 17 and verified the actual migration, CRUD round trips, duplicate constraints, cross-user isolation, ownership reassignment denial, and rejection of inconsistent totals.
- Isolated headless browser verification used the supplied PDF locally and mocked authentication/API responses: original PDF extraction/rendering, compact review without exposed inputs, corrections, blocking inconsistent totals before POST, acceptance payload, dashboard rendering, reload, duplicate reopening, and mobile layout. Backend HTTP contracts and real database behavior were tested separately; no production account or hosted data was changed.
- The current-provider sample extracts 223 kWh, the September–October period, EUR 79.09, EUR 9.57 fixed charge and EUR -26.76 discount. Original personal PDFs are not regression fixtures.
- The Energy migration has now been applied to the linked Supabase project. The repository migration version matches the hosted history (`20261109224007_energy_bills.sql`). Verified the table, four indexes, ownership policy, RLS, authenticated grants and anonymous denial, and ran the API's read query as the authenticated database role. Other database environments still require this migration before running the API.
- Scanned-document OCR, automatic DEI mapping/reconciliation and confirmed-payment tracking are follow-up scope.

## Earlier ZeniΘ layout correction

The earlier two-page sample could identify the provider but not its fields: several headings are outlined graphics, identity is printed in a horizontal row, and consumption appears on page two. `zenith-monthly-v2` adds a separate position-aware adapter for that format. It combines excise/special fees with VAT in the tax summary and uses the printed first-page regulated total (which includes ETMEAR). The next meter-reading date is not treated as the payment due date.

The exact earlier file and the newer sample both passed the isolated browser upload/review/correction/acceptance checks with mocked API responses. All 44 frontend tests, TypeScript, targeted lint, and the production build passed. New anonymous synthetic regression cases cover the horizontal header, split taxes, adjacent payment date/amount, carried balance, incomplete headers, and actual/estimated heading detection. Source PDFs remain outside the regression fixtures.
