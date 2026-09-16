-- Phase 3 hand-written migration: constraints, indexes, triggers, and
-- Row-Level Security policies that Prisma's schema language cannot express
-- directly. Every rule here traces to a specific Phase 1/2 invariant cited
-- in the comment above it. This migration is idempotent-by-convention
-- (single application via `prisma migrate deploy`), not re-runnable.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. CHECK constraints — invoice financial-completeness invariants
--    (INV-LIFE-001/003, INV-IMM-001, Phase 1 FR-INV-013 as elaborated by
--    Phase 2 §06: a Finalized/Void invoice must carry its financial facts;
--    a Draft need not).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "invoice"
  ADD CONSTRAINT invoice_number_required_unless_draft
    CHECK (status = 'DRAFT' OR invoice_number IS NOT NULL);

ALTER TABLE "invoice"
  ADD CONSTRAINT invoice_financials_required_unless_draft
    CHECK (
      status = 'DRAFT'
      OR (
        pre_tax_subtotal IS NOT NULL
        AND total_tax IS NOT NULL
        AND invoice_total IS NOT NULL
        AND invoice_date IS NOT NULL
        AND billed_client_snapshot IS NOT NULL
        AND billed_business_snapshot IS NOT NULL
      )
    );

ALTER TABLE "invoice"
  ADD CONSTRAINT invoice_voided_at_required_when_void
    CHECK (status <> 'VOID' OR voided_at IS NOT NULL);

ALTER TABLE "invoice"
  ADD CONSTRAINT invoice_amounts_non_negative
    CHECK (
      (pre_tax_subtotal IS NULL OR pre_tax_subtotal >= 0)
      AND (total_tax IS NULL OR total_tax >= 0)
      AND (invoice_total IS NULL OR invoice_total >= 0)
    );

-- INV-CORR-001/002: a replacement invoice cannot replace itself.
ALTER TABLE "invoice"
  ADD CONSTRAINT invoice_cannot_replace_self
    CHECK (replaces_invoice_id IS NULL OR replaces_invoice_id <> id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CHECK constraints — line items, tax lines, payments, services
--    (DEC-MONEY-006/007: quantity > 0, rate >= 0, zero-value lines allowed;
--    DEC-PAY-001: payment amount > 0).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "invoice_line_item"
  ADD CONSTRAINT line_item_quantity_positive CHECK (quantity > 0);

ALTER TABLE "invoice_line_item"
  ADD CONSTRAINT line_item_unit_price_non_negative CHECK (unit_price >= 0);

ALTER TABLE "invoice_line_item"
  ADD CONSTRAINT line_item_subtotal_non_negative CHECK (line_subtotal >= 0);

ALTER TABLE "invoice_line_item"
  ADD CONSTRAINT line_item_order_positive CHECK (line_order >= 1);

ALTER TABLE "invoice_tax_line"
  ADD CONSTRAINT tax_line_rate_non_negative CHECK (rate >= 0);

ALTER TABLE "invoice_tax_line"
  ADD CONSTRAINT tax_line_taxable_subtotal_non_negative CHECK (taxable_subtotal >= 0);

ALTER TABLE "invoice_tax_line"
  ADD CONSTRAINT tax_line_amount_non_negative CHECK (tax_amount >= 0);

ALTER TABLE "payment"
  ADD CONSTRAINT payment_amount_positive CHECK (amount > 0);

ALTER TABLE "service"
  ADD CONSTRAINT service_default_rate_non_negative CHECK (default_rate >= 0);

ALTER TABLE "tax_configuration_version"
  ADD CONSTRAINT tax_config_effective_to_after_from
    CHECK (effective_to IS NULL OR effective_to >= effective_from);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Partial unique index — at most one *current* tax configuration
--    version per business (Phase 2 §08 Effective-Dating Rules).
-- ═══════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX tax_configuration_version_one_current_per_business
  ON "tax_configuration_version" (business_id)
  WHERE effective_to IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Audit trail append-only enforcement (INV-AUD-002 / SEC-AUDIT-001).
--    No application code path may UPDATE or DELETE an AuditEvent; this
--    trigger makes that true even for code that bypasses the domain layer.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_event_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_event records are append-only and cannot be updated or deleted (id: %)', OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update
  BEFORE UPDATE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();

CREATE TRIGGER audit_event_no_delete
  BEFORE DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_event_append_only();

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Row-Level Security — business isolation as defense-in-depth
--    (SEC-ISO-004, INV-ISO-001/002/003). Application-layer authorization
--    (src/server/domain/businessAuthorization.ts) remains the primary
--    enforcement; this is the second, independent layer: even a query
--    that forgot a businessId filter cannot cross a business boundary.
--
--    The application sets `app.user_id` to the authenticated user's id at
--    the start of every transaction via `select set_config('app.user_id',
--    $1, true)` (see src/server/db/authorizedTransaction.ts). Until that
--    is set, current_setting(..., true) returns NULL and every policy
--    below evaluates to false — i.e. the default is deny, not allow.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_current_business_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM "business"
  WHERE owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- business: a row is visible/writable only to its own owner.
ALTER TABLE "business" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business" FORCE ROW LEVEL SECURITY;
CREATE POLICY business_owner_isolation ON "business"
  FOR ALL
  USING (owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Directly business-scoped tables (Section 6 of the Phase 3 brief).
CREATE POLICY client_business_isolation ON "client"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client" FORCE ROW LEVEL SECURITY;

CREATE POLICY service_business_isolation ON "service"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_business_isolation ON "invoice"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice" FORCE ROW LEVEL SECURITY;

CREATE POLICY tax_configuration_version_business_isolation ON "tax_configuration_version"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "tax_configuration_version" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tax_configuration_version" FORCE ROW LEVEL SECURITY;

CREATE POLICY calendar_connection_business_isolation ON "calendar_connection"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "calendar_connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_connection" FORCE ROW LEVEL SECURITY;

CREATE POLICY work_candidate_business_isolation ON "work_candidate"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "work_candidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_candidate" FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_event_business_isolation ON "audit_event"
  FOR ALL
  USING (business_id IN (SELECT app_current_business_ids()))
  WITH CHECK (business_id IN (SELECT app_current_business_ids()));
ALTER TABLE "audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_event" FORCE ROW LEVEL SECURITY;

-- Dependent entities — isolation enforced via their immutable parent chain
-- ("enforce ownership relationships for dependent entities", Section 6).

CREATE POLICY invoice_line_item_business_isolation ON "invoice_line_item"
  FOR ALL
  USING (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())))
  WITH CHECK (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())));
ALTER TABLE "invoice_line_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_item" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_tax_line_business_isolation ON "invoice_tax_line"
  FOR ALL
  USING (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())))
  WITH CHECK (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())));
ALTER TABLE "invoice_tax_line" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_tax_line" FORCE ROW LEVEL SECURITY;

CREATE POLICY invoice_send_attempt_business_isolation ON "invoice_send_attempt"
  FOR ALL
  USING (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())))
  WITH CHECK (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())));
ALTER TABLE "invoice_send_attempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_send_attempt" FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_business_isolation ON "payment"
  FOR ALL
  USING (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())))
  WITH CHECK (invoice_id IN (SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())));
ALTER TABLE "payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment" FORCE ROW LEVEL SECURITY;

CREATE POLICY payment_reversal_business_isolation ON "payment_reversal"
  FOR ALL
  USING (payment_id IN (
    SELECT id FROM "payment" WHERE invoice_id IN (
      SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())
    )
  ))
  WITH CHECK (payment_id IN (
    SELECT id FROM "payment" WHERE invoice_id IN (
      SELECT id FROM "invoice" WHERE business_id IN (SELECT app_current_business_ids())
    )
  ));
ALTER TABLE "payment_reversal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_reversal" FORCE ROW LEVEL SECURITY;

CREATE POLICY selected_calendar_business_isolation ON "selected_calendar"
  FOR ALL
  USING (calendar_connection_id IN (SELECT id FROM "calendar_connection" WHERE business_id IN (SELECT app_current_business_ids())))
  WITH CHECK (calendar_connection_id IN (SELECT id FROM "calendar_connection" WHERE business_id IN (SELECT app_current_business_ids())));
ALTER TABLE "selected_calendar" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "selected_calendar" FORCE ROW LEVEL SECURITY;

CREATE POLICY calendar_event_business_isolation ON "calendar_event"
  FOR ALL
  USING (selected_calendar_id IN (
    SELECT id FROM "selected_calendar" WHERE calendar_connection_id IN (
      SELECT id FROM "calendar_connection" WHERE business_id IN (SELECT app_current_business_ids())
    )
  ))
  WITH CHECK (selected_calendar_id IN (
    SELECT id FROM "selected_calendar" WHERE calendar_connection_id IN (
      SELECT id FROM "calendar_connection" WHERE business_id IN (SELECT app_current_business_ids())
    )
  ));
ALTER TABLE "calendar_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calendar_event" FORCE ROW LEVEL SECURITY;
