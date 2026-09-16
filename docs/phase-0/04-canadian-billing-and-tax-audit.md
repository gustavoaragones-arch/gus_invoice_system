# 04 — Canadian Billing and Tax Audit

Status: Draft for Project Director review
Phase: 0

## 0. Purpose and Method

This document audits the Canadian billing, GST/HST, invoicing, and recordkeeping requirements relevant to this system's design. It distinguishes:

1. **Confirmed Canadian requirements** — sourced from primary Government of Canada / CRA publications.
2. **Configurable software requirements** — things the software must let the business configure, because the correct value depends on facts not knowable in Phase 0.
3. **Business-specific accounting/tax decisions** — decisions that belong to the business owner and their accountant, not to this system or this agent.
4. **Items requiring professional confirmation** — anything this document flags as needing an accountant/CRA confirmation before being encoded in the product.

No tax rate, registration status, or tax treatment is assumed for Business A or Business B anywhere in this document. Where business-specific facts are required and unavailable, this document states: **"Business-specific determination required."**

**This software does not, and must not, replace professional accounting or tax advice.** Every place this system touches GST/HST must be driven by configuration the business owner (informed by their accountant) confirms — not by defaults invented by this system.

All primary-source citations below were retrieved on 2026-09-15 from canada.ca. CRA web content is updated periodically; the specific figures below (rates, thresholds) should be re-verified against canada.ca at architecture/implementation time and again before go-live, since rates and thresholds are subject to change by the Government of Canada.

---

## 1. Confirmed Canadian Requirements (Primary-Sourced)

### 1.1 GST/HST Registration — Small Supplier Threshold

- **Requirement**: A person/business must register for a GST/HST account if (a) it is not a "small supplier," and (b) it makes taxable supplies in Canada. A business is a small supplier as long as its total worldwide taxable revenues (and those of associates) are $30,000 or less in a single calendar quarter and over the last four consecutive calendar quarters. (Charities and public institutions use a $50,000 threshold — not relevant to this system's currently defined business profiles unless a future business profile is a charity.)
- **Applicability**: Applies to both Business A and Business B, individually. Registration status is not something this system may assume — see Section 4.
- **Source**: Government of Canada, "When to register for and start charging the GST/HST" — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html
- **Currentness**: Retrieved 2026-09-15. The $30,000 threshold is a long-standing statutory figure under the Excise Tax Act; confirm it has not changed before go-live.
- **Software implication**: The system must not assume either business is or is not GST/HST-registered. Registration status, and the business's GST/HST account number (if registered), must be an explicit, per-business configuration value (see 04-2 below), supplied by the owner.
- **Generic implementability**: The *mechanics* of applying tax once a registration status and rate are configured can be generic. The *decision* of whether a business is registered is not generic — it is a fact about that business.
- **Business-specific confirmation required**: Yes — for both Business A and Business B. **Business-specific determination required.**

### 1.2 Which GST/HST Rate to Charge — Place of Supply

- **Requirement**: The rate of GST/HST to charge depends on the "place of supply" — generally where the supply is made to the customer — not simply where the supplier is located. Current published rates: 5% GST in Alberta, British Columbia, Manitoba, Northwest Territories, Nunavut, Quebec, Saskatchewan, and Yukon; 13% HST in Ontario; 15% HST in New Brunswick, Newfoundland and Labrador, and Prince Edward Island; and, per a Government of Nova Scotia rate decrease effective April 1, 2025, 14% HST in Nova Scotia (previously 15%).
- **Applicability**: Applies to any invoice issued by a GST/HST-registered business in this system, for every taxable supply.
- **Source**: Government of Canada, "Charge and collect the tax – Which rate to charge" — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html
- **Currentness**: Retrieved 2026-09-15; explicitly notes the Nova Scotia rate change effective April 1, 2025. Provincial HST/PST rates are subject to change by provincial and federal governments and must be re-verified at implementation and periodically thereafter (rate changes have historically been announced with lead time but take effect on specific dates).
- **Software implication**: Tax rate must never be hard-coded as a single constant. It must be configurable per applicable jurisdiction/place-of-supply and must be maintainable (updatable) without a code change, because rates change over time and by province. Place-of-supply determination rules (e.g., based on client billing address vs. where the service is performed) are themselves a business-specific/service-specific determination — see Section 3.
- **Business-specific confirmation required**: Yes — which province(s)/rate(s) apply to each business's actual clients and service delivery locations. **Business-specific determination required.**

### 1.3 Provincial Sales Taxes Outside the GST/HST Framework (PST/RST/QST)

- **Requirement**: British Columbia, Saskatchewan, and Manitoba levy their own separately-administered provincial sales taxes (PST/RST) in addition to the 5% federal GST; these are not part of the CRA-administered GST/HST framework. Quebec's QST is administered by Revenu Québec, not the CRA, alongside the 5% federal GST.
- **Applicability**: Relevant only if a business profile's clients or places of supply fall in BC, SK, MB, or QC and the business's services are subject to those provincial taxes.
- **Source**: Government of Canada, "Charge and collect the tax – Which rate to charge" (confirms GST/HST scope and non-participating provinces) — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html. Provincial PST/QST administration is outside CRA's authority and is not itself detailed on this CRA page; PST/RST/QST registration and rates are governed by the respective provincial revenue authorities (Revenu Québec for QST) and were not independently verified against a provincial primary source in this pass.
- **Software implication**: If either business has clients/services subject to a provincial sales tax outside the GST/HST system, the software must be able to represent that as a separate, configurable tax line — it must not be folded silently into "HST" or assumed away.
- **Business-specific confirmation required**: Yes, and additionally **requires professional confirmation** against the specific provincial tax authority (e.g., Revenu Québec for QST) rather than CRA sources alone, since CRA does not administer these taxes. **Business-specific determination required.**

### 1.4 Invoice/Receipt Documentation Requirements for Input Tax Credits (ITC)

- **Requirement**: A GST/HST registrant supplying taxable property/services must provide the purchaser with specific information on the invoice/receipt if the purchaser will claim an input tax credit, scaled by the amount payable on the purchase before tax:
  - **Under $100**: supplier's (or intermediary's) name/trading name; the date of the invoice or, if no invoice, the date on which GST/HST is paid or payable; the total amount paid or payable.
  - **$100 to $499.99**: all of the above, plus the supplier's GST/HST registration number (Business Number + GST/HST account number); an indication of the total tax charged, or that the amount includes GST/HST; and, where a supply includes both taxable and exempt supplies, an indication of the status of each supply.
  - **$500 or more**: all of the above, plus the recipient's (purchaser's) name or trading name (or that of their authorized agent or representative); the terms of payment; and a brief description of the property or services.
- **Applicability**: Applies to any invoice issued by a GST/HST-registered business where the client may claim an ITC (i.e., most B2B invoicing).
- **Current CRA sources**: Government of Canada / CRA, Excise and GST/HST News No. 118, "Changes to the documentary requirements for claiming input tax credits" — https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/news118/news118-excise-gst-hst-news-no-118.html; CRA, "Input tax credits," Section "Records you need to support your claim" — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html; and current Guide RC4022, "General Information for GST/HST Registrants" — https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/rc4022/general-information-gst-hst-registrants.html
- **Current requirement and currentness**: Retrieved 2026-09-15. The current CRA guidance establishes $100 and $500 as the operative documentary-information thresholds, effective April 20, 2021. An older GST/HST Memorandum 8-4 page still displays the historical $30 and $150 thresholds. The historical memorandum therefore must not be used as the current threshold for product requirements. The current CRA guidance is the operative source for this Phase 0 baseline.
- **Historical source discrepancy**: GST/HST Memorandum 8-4, "Documentary Requirements for Claiming Input Tax Credits" — https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/8-4/documentary-requirements-claiming-input-tax-credits.html — still contains the historical under-$30, $30-to-under-$150, and $150-or-more figures. CRA Excise and GST/HST News No. 118 explains that legislative changes replaced the former $30 and $150 thresholds with $100 and $500, effective April 20, 2021.
- **Software implication**: If a business is GST/HST-registered, the invoice system should be capable of producing the information necessary for the highest applicable documentation tier: supplier name, GST/HST registration number, invoice date, total amount, tax amount/indication, recipient name, payment terms, and a sufficient description of the property or services. Normal professional invoice content should satisfy these disclosure/documentation requirements. The system does not need special UI behavior for each threshold unless a later phase determines that it would be useful.
- **Business-specific confirmation required**: Confirm the business's GST/HST registration number format and that it is displayed accurately; otherwise generically implementable.

### 1.5 Recordkeeping Retention Period

- **Requirement**: Records — including all sales and purchase invoices and other records related to business operations and GST/HST — must generally be kept for six years from the end of the tax year to which they relate. The CRA may request records be kept longer in specific circumstances (e.g., ongoing audit/appeal); early destruction requires written CRA approval.
- **Applicability**: Applies to both businesses' invoice, payment, and supporting records.
- **Source**: Government of Canada, "What records to keep" — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/complete-file-return-business/what-records-keep.html
- **Currentness**: Retrieved 2026-09-15.
- **Software implication**: The system must not provide a mechanism to delete finalized invoices, line items, or payment records within the statutory retention window (aligns with the financial-record integrity principle, [01-product-definition.md](01-product-definition.md)). This is a generic requirement — a minimum six-year non-destructive retention posture for finalized financial records is safe to build in regardless of business-specific facts, though the business should confirm no longer retention period applies to it (e.g., ongoing CRA correspondence).
- **Business-specific confirmation required**: No, for the baseline six-year rule; **yes**, if either business has any circumstance (audit, appeal, CRA request) requiring longer retention.

### 1.6 Electronic Recordkeeping

- **Requirement**: The CRA accepts electronic records, provided they are reproducible in paper form on request, stored in a format readable by CRA systems, and adequately backed up against loss. Registrants generally do not need to submit receipts/supporting documents when filing GST/HST returns electronically, but must retain them in case CRA requests them.
- **Applicability**: Applies to how this system stores invoice, payment, and supporting Calendar-derived work records.
- **Source**: Government of Canada, "What records to keep" — https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/complete-file-return-business/what-records-keep.html
- **Currentness**: Retrieved 2026-09-15.
- **Software implication**: Reinforces NFR-BACKUP requirements ([03-non-functional-requirements.md](03-non-functional-requirements.md)) — the database is the system of record and must be backed up and, if needed, reproducible/exportable in a durable form.
- **Business-specific confirmation required**: No.

---

## 2. Configurable Software Requirements (Generic, But Must Be Business-Configured, Not Hard-Coded)

These are requirements the software should be built to support generically, with the actual values supplied per business:

- **CFG-TAX-001**: Per-business GST/HST registration status (registered / not registered) and, if registered, GST/HST account number.
- **CFG-TAX-002**: Per-business (or per-invoice, per place-of-supply) applicable GST/HST rate, maintainable without a code change as rates or the business's operating provinces change.
- **CFG-TAX-003**: Support for representing a separate provincial sales tax (PST/RST/QST) line where applicable, distinct from GST/HST, per Section 1.3.
- **CFG-TAX-004**: Tax-inclusive vs. tax-exclusive line-item pricing behavior (see Section 4 — unresolved).
- **CFG-TAX-005**: Effective-dating of tax configuration, so that a rate change (e.g., the Nova Scotia April 2025 change) does not retroactively alter tax on already-finalized invoices (aligns with financial-record integrity principle) while correctly applying to new invoices going forward.
- **CFG-TAX-006**: Rounding rule for tax and totals (see Section 4 — unresolved).
- **CFG-BUS-001**: Per-business legal/operating name, address, and GST/HST registration number for display on invoices/PDFs, consistent with Section 1.4's documentation requirements.

---

## 3. Business-Specific Accounting/Tax Decisions (Not the Software's or This Agent's to Make)

The following are facts or judgment calls specific to Business A and/or Business B that must come from the owner and/or their accountant — this system must never infer or default them:

- Whether Business A is currently GST/HST-registered, and its registration number if so.
- Whether Business B will register for GST/HST (voluntarily, if under the small-supplier threshold, or because it is required to).
- Which province(s) are the correct "place of supply" for each business's services, and therefore which GST/HST rate (and any PST/QST) applies to a given client/invoice.
- Whether any of either business's services are zero-rated, exempt, or otherwise not subject to standard GST/HST treatment.
- Whether historical invoices for Business A were issued under a different tax treatment or registration status than will apply going forward, and how that history should be represented.
- Any provincial PST/RST/QST obligations applicable to either business.

Everywhere this document states **"Business-specific determination required,"** that determination must be supplied to the Project Director/owner before the corresponding configuration (Section 2) is populated for a real business — it is not a gap this system fills with a default.

---

## 4. Items Requiring Professional Confirmation

- Confirming current GST/HST registration status and number for Business A (existing business) — requires the owner/accountant, not CRA web content alone.
- Confirming Business B's obligation or election to register, based on projected revenue and the small-supplier rules in Section 1.1.
- Confirming whether either business has any provincial PST/RST/QST obligation (Section 1.3), which requires consulting the relevant provincial revenue authority, not CRA.
- Confirming whether invoice pricing should be presented tax-inclusive or tax-exclusive, and the rounding convention, as a matter of the business's own invoicing practice/accounting advice (see [11-unresolved-decisions.md](11-unresolved-decisions.md)).
- Re-verifying, at architecture/implementation time, that the rates, thresholds, and documentary-requirement tiers cited above have not changed, since this audit reflects a single retrieval pass on 2026-09-15 and CRA content is subject to updates.
- The historical GST/HST Memorandum 8-4 page contains the old $30/$150 thresholds, while current CRA material reflects the $100/$500 thresholds effective April 20, 2021. Product requirements shall use the current $100/$500 thresholds; current CRA guidance should still be rechecked before go-live because tax requirements can change. This is a historical/current-source distinction, not an unresolved contradiction between equally current sources.

---

## 5. Explicit Non-Reliance Statement

This audit is a requirements-gathering document produced by an implementation agent, based on a single pass of publicly available Government of Canada web content on 2026-09-15. It is **not** a legal or accounting opinion, does not constitute tax advice, and must not be relied upon as the business's sole basis for GST/HST compliance. The system built from this specification must likewise never present itself to the end user as a substitute for professional accounting or tax advice (see [01-product-definition.md](01-product-definition.md), Section 10).
