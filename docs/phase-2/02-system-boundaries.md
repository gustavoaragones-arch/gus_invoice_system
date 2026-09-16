# 02 — System Boundaries

Status: Draft for Project Director review
Phase: 2

## 1. Purpose

Define what is inside and outside the application boundary, preserving Phase 0 exclusions and Phase 1 behavioral scope.

## 2. Inside the Application

| Capability | Boundary |
|---|---|
| Business profile management | Per-business identity, branding, settings |
| Client records | CRUD scoped per business |
| Service catalog | CRUD scoped per business |
| Invoice lifecycle | Draft → Finalized → Void; correction via Void + Replacement |
| Invoice numbering | Sequential, per-business, atomic at finalization |
| Payment recording | Against finalized invoices; reversal mechanism |
| Revenue reporting | Pre-tax Revenue, Sales Tax, Amount Collected, Outstanding |
| Tax calculation | Per tax group (type/authority + rate); effective-dated config |
| Google Calendar assist | Read-only retrieval → Work Candidates → review → approval |
| Invoice delivery | PDF generation, email send, delivery status tracking |
| Audit trail | Append-only events for material actions |
| Historical import | Same model with provenance; import-only Finalized entry |

## 3. Outside the Application (Phase 0 Exclusions — Preserved)

The architecture must **not** introduce:

| Exclusion | Architectural Implication |
|---|---|
| General ledger | No chart of accounts, journal entries, or GL accounts |
| Double-entry accounting | No debit/credit pairs |
| Financial statements | No balance sheet, income statement generation |
| Payment processing | No card/bank rail; records payments after the fact only |
| Multi-currency | CAD only |
| Automatic credit application | Overpayments surfaced, not auto-applied |
| Automatic refunds | Manual resolution outside system |
| Cross-business combined reporting | No multi-business aggregate figures |
| Discount functionality | No negative-amount or discount line items |
| Accounts payable | No vendor/expense tracking |
| Bank reconciliation | No bank feed integration |
| Payroll / inventory / CRM | Not in scope |

## 4. Boundary Definitions

### 4.1 Billing vs. Accounting

| Inside (Billing) | Outside (Accounting) |
|---|---|
| Invoice creation and finalization | GAAP/ASPE revenue recognition |
| Pre-tax Revenue reporting | Tax filing/remittance accounting |
| Sales tax charged on invoices | Sales tax remittance ledgers |
| Payment recording | Bank reconciliation |
| Outstanding balance snapshot | Full AR management |

### 4.2 Revenue Reporting vs. Payment Recording

- **Revenue**: invoice-date, pre-tax subtotal of finalized non-void invoices
- **Sales Tax**: invoice-date, tax amounts on finalized non-void invoices
- **Amount Collected**: payment-date, non-reversed payments
- These are never merged into a single figure

### 4.3 Tax Calculation vs. Tax Registration Decisions

The system calculates tax once configuration is supplied. Whether a business is registered, which rates apply, and place-of-supply treatment are business configuration / professional confirmation — not architectural defaults.

### 4.4 Google Calendar vs. Financial Records

```
INSIDE:  Calendar Connection → Calendar Event → Work Candidate → Review
OUTSIDE: Automatic invoice/payment creation from calendar events
```

### 4.5 Email Delivery vs. Financial State

Sending an invoice affects Delivery Status only. It does not change invoice financial values, lifecycle state, or payment status.

### 4.6 Authentication vs. Business Authorization

Authentication establishes who the user is. Business-scoped authorization determines which business's data may be accessed. Active business context in UI does not substitute for server-side enforcement.

## 5. Phase 2 Boundary

Phase 2 produces architecture documentation only. It does not implement any boundary-crossing integration.
