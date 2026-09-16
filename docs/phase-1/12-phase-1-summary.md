# 12 — Phase 1 Summary

Status: Draft for Project Director review
Phase: 1 — Accounting & Billing Rules Definition

## Phase 1 Objective

Convert the accounting, invoice-lifecycle, payment, tax, money, historical-data, and auditability decisions Phase 0 left unresolved into a precise, internally consistent, implementation-ready rules specification — behavioral rules only, no code, schema, or architecture.

## Completed Decisions

37 formal decisions were established and classified in [11-accounting-decision-register.md](11-accounting-decision-register.md), spanning:

- **Accounting basis** (4 decisions): revenue defined as pre-sales-tax invoice-based billing revenue, distinct from separately reported Sales Tax and payment-based "Amount Collected"; YTD is calendar-year, business-scoped; Outstanding Amount is a point-in-time snapshot excluding void invoices.
- **Invoice lifecycle** (9 decisions): a minimal three-state persisted lifecycle (`Draft`/`Finalized`/`Void`), with Payment Status, Overdue, and Delivery Status as derived indicators rather than separate stored states; numbers assigned only at finalization, never reused, sequential per business.
- **Finalization and corrections** (folded into invoice-lifecycle decisions): a single correction mechanism (Void + linked Replacement), no in-place editing of finalized content ever.
- **Payments** (6 decisions): explicit Balance Due / Amount Paid / Overpayment formulas; overpayment accepted and surfaced, never auto-applied or blocked; amount/date immutable, corrected only via reversal; payments on voided invoices remain attached to the original invoice with no automatic movement or reassignment.
- **Tax and pricing** (3 decisions, plus explicit non-assumption of real tax facts): tax-exclusive entry by default; sales tax reported separately from Revenue; tax groups defined by tax type/authority + applicable rate, each calculated and rounded independently; a fixed calculation sequence and rounding points, applied only once valid business-specific tax configuration exists.
- **Money and rounding** (7 decisions): CAD-only, 2-decimal precision throughout, round-half-up convention at line subtotal and per-tax-group points, no discount mechanism (out of scope), zero-value lines permitted.
- **Historical records** (7 decisions): same data model as live records, provenance-marked, entering directly as `Finalized`, exempt from standard completeness validation, numbers and tax values preserved exactly as they were.
- **Auditability** (1 decision plus a full required-event list): 14 event types identified as requiring an audit record, with a requirement that corrections/changes preserve prior values, not only new ones.

## Authoritative Rules Established

The full, binding rule set is captured across [01](01-accounting-basis.md) through [10](10-auditability-rules.md); the register in [11](11-accounting-decision-register.md) is the single authoritative index into all of it. Together these define exactly how Work → Invoice → Payment → Revenue behaves, without introducing general-ledger, double-entry, or other excluded accounting machinery (Phase 0 [09-scope-boundary.md](../phase-0/09-scope-boundary.md) is not violated anywhere in this rule set — see Cross-Document Validation below).

Key remediated rules:

- **Revenue** = pre-sales-tax subtotal of finalized, non-void invoices.
- **Sales Tax** = separately identifiable sales tax amounts charged on finalized, non-void invoices; not included in Revenue.
- **Amount Collected** = actual non-reversed payments recorded by payment date, regardless of whether the originally attached invoice was later voided.
- **Outstanding** = balance due from finalized, non-void invoices only.
- **Tax groups** = tax type/authority + applicable rate; each distinct group calculated and rounded separately.
- **Invoice total** = pre-tax subtotal + sum of tax-group amounts.
- **Void/payment interaction**: payments remain attached to the original invoice; replacement invoices do not automatically inherit payments.

## Remaining Professional Confirmations

The following require the business owner's/accountant's confirmation before being relied upon for a real, live business (none have been treated as settled facts):

1. Whether invoice-based revenue is an acceptable proxy for the business's actual tax/accounting revenue reporting (DEC-ACC-001).
2. Whether the void+replacement period-attribution behavior (replacement counted in its own period, not backdated) matches the owner's accounting practice (DEC-INV-008).
3. The tax calculation sequence and round-half-up rounding convention (DEC-TAX-002, DEC-MONEY-003).
4. Business A's and Business B's actual GST/HST registration status, applicable rate(s), and place-of-supply facts (restated from Phase 0; not decided in Phase 1).
5. Whether either business has a PST/RST/QST obligation (restated from Phase 0).
6. Which services, if any, qualify as zero-rated or exempt.
7. The owner's real-world set of payment methods (DEC-PAY-005).
8. Whether 2-decimal quantity precision is sufficient for the owner's actual billing practice (DEC-MONEY-004).

## Remaining Unresolved Decisions

Two items could not be safely resolved within Phase 1's authority and are carried forward as genuinely open (see [11-accounting-decision-register.md](11-accounting-decision-register.md), "Open / Unresolved Items"):

1. **Reconciling Business A's historical invoice-numbering pattern with the new sequential per-business scheme** — blocked on Business A source data (Phase 0 UD-DATA-003) that does not yet exist in this phase.
2. **Whether fiscal-year (vs. calendar-year) YTD reporting is needed** — no Phase 0 requirement indicates it is, so it was not built; flagged only in case real usage reveals a need.

## Cross-Document Validation

A cross-document consistency pass was performed against the criteria in the governing prompt's Section 24. Result: **the rule set is internally consistent.**

- Invoice lifecycle ([02](02-invoice-lifecycle.md)) agrees with finalization/correction rules ([04](04-finalization-and-corrections.md)): the permitted-transition table in 02 and the Void/Correction mechanism in 04 describe the same state machine without divergence.
- Invoice numbering ([03](03-invoice-numbering.md)) agrees with lifecycle rules ([02](02-invoice-lifecycle.md)): numbers exist exactly where the lifecycle table says they exist (not on Draft, permanently on Finalized/Void).
- Corrections agree with immutability rules: no document permits in-place editing of a Finalized invoice; correction is uniformly Void + Replacement.
- Payments agree with invoice balance rules and revenue rules: [05](05-payment-rules.md)'s formulas are the single source [02](02-invoice-lifecycle.md) and [06](06-revenue-reporting-rules.md) both defer to, rather than each defining their own.
- Revenue reporting agrees with void/correction treatment: [06](06-revenue-reporting-rules.md) Section 12 explicitly restates, rather than contradicts, [01](01-accounting-basis.md) Sections 5-6.
- Revenue excludes sales tax everywhere: [01](01-accounting-basis.md), [06](06-revenue-reporting-rules.md), and [11](11-accounting-decision-register.md) (DEC-ACC-001, DEC-TAX-003) consistently define Revenue as pre-sales-tax and sales tax as a separate figure.
- Tax grouping is unambiguous: [07](07-tax-and-pricing-rules.md) and [08](08-money-and-rounding-rules.md) consistently define tax groups as tax type/authority + applicable rate, with each group calculated and rounded independently.
- Void/payment interaction is consistent: [05](05-payment-rules.md) Section 11, [06](06-revenue-reporting-rules.md) Section 12, and [01](01-accounting-basis.md) Section 5 all agree that payments remain attached to void invoices, void invoices are excluded from current Outstanding, and replacement invoices do not inherit payments.
- Tax rules agree with Phase 0's tax baseline: [07](07-tax-and-pricing-rules.md) introduces no registration/rate assumption anywhere, consistent with Phase 0 [04-canadian-billing-and-tax-audit.md](../phase-0/04-canadian-billing-and-tax-audit.md).
- Rounding rules agree with invoice totals: [08](08-money-and-rounding-rules.md) restates, rather than diverges from, [07](07-tax-and-pricing-rules.md) Section 4's rounding points and convention.
- Historical rules do not mutate finalized records: [09](09-historical-record-rules.md) Section 9 explicitly subjects historical records to the same immutability rules as any other Finalized invoice.
- Audit rules cover all irreversible financial actions identified elsewhere: every transition/action in [02](02-invoice-lifecycle.md), [04](04-finalization-and-corrections.md), and [05](05-payment-rules.md) appears in [10](10-auditability-rules.md) Section 2's event list.
- All business-scoped rules preserve business isolation: numbering, payments, and reporting are each explicitly re-scoped to one business throughout, with no cross-business figure introduced anywhere.
- No document introduces a Phase 0 exclusion: discounts, payment processing, multi-currency, and cross-business reporting are each explicitly called out as out of scope where the topic naturally arose (rather than silently omitted or silently included).

**No contradiction in Phase 0 itself was discovered during this review.** Every gap identified above is a matter requiring further business-specific input, not a conflict within the governing baseline.

## Architecture Implications (for Phase 2)

Phase 2 must design a schema and application architecture capable of:
- A three-state invoice lifecycle with derived (not stored) Payment/Delivery/Overdue indicators.
- Atomic number assignment at finalization ([03](03-invoice-numbering.md) DEC-INV-005).
- Immutable financial fields post-finalization, with a Void+Replacement linkage construct.
- Payment records with immutable amount/date and a linked reversal mechanism.
- Per-business tax configuration with effective-dating (so historical invoices are never retroactively recalculated).
- A provenance marker distinguishing historically-imported from system-created records, with a completeness-exemption path for the former.
- An append-only audit trail covering the 14 event types in [10-auditability-rules.md](10-auditability-rules.md), each preserving prior values where the event represents a change.

## Scope Compliance

No item in Phase 0's [09-scope-boundary.md](../phase-0/09-scope-boundary.md) exclusion list was introduced. Discounts, payment processing, multi-currency accounting, and cross-business combined reporting were each explicitly considered and explicitly excluded rather than silently built in. No database schema, application code, or architecture decision was made.

## Risks Discovered

- **Business A numbering/migration risk** (elaborates Phase 0 RISK-016/017): until the historical numbering pattern is known, DEC-INV-003/009's reconciliation question stays open, which could delay migration planning if not addressed before Phase 2 concludes.
- **Rounding/tax-sequence reliance risk**: DEC-TAX-002/DEC-MONEY-003 are defensible, common defaults, but if the accountant's confirmed convention differs, invoices generated before that confirmation could need reissuing under the Void+Replacement mechanism — a real but bounded and already-designed-for risk, not a gap in the rules.
- **Overpayment/credit-handling risk**: DEC-PAY-002 deliberately does not auto-resolve overpayments; if the owner's real practice generates frequent overpayments, the manual-resolution burden may prove high enough to warrant a future scope decision (a credit-balance feature) — flagged, not solved, here.

## Phase 1 Readiness Assessment

All required documentation output exists, is internally consistent (see Cross-Document Validation), classifies every decision per the governing prompt's Section 21 scheme, does not contradict Phase 0, and introduces no implementation artifacts. Two items remain genuinely unresolved pending business-specific input (Section "Remaining Unresolved Decisions," above) and are recorded, not guessed at.

**Recommendation: Phase 1 documentation is ready for Project Director review.**
