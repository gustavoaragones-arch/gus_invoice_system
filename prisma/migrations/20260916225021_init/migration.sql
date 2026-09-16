-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');

-- CreateEnum
CREATE TYPE "provenance" AS ENUM ('SYSTEM_CREATED', 'HISTORICAL_IMPORT');

-- CreateEnum
CREATE TYPE "tax_status" AS ENUM ('TAXABLE', 'ZERO_RATED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "client_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "service_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "work_candidate_review_state" AS ENUM ('PENDING', 'EDITED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "match_confidence" AS ENUM ('MATCHED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "send_attempt_status" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "calendar_connection_status" AS ENUM ('ACTIVE', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "audit_event_type" AS ENUM ('INVOICE_CREATED', 'INVOICE_FINALIZED', 'INVOICE_SEND_ATTEMPTED', 'INVOICE_VOIDED', 'REPLACEMENT_INVOICE_CREATED', 'PAYMENT_RECORDED', 'PAYMENT_REVERSED', 'PAYMENT_METHOD_NOTE_CORRECTED', 'TAX_CONFIGURATION_CHANGED', 'BUSINESS_SETTINGS_CHANGED', 'WORK_CANDIDATE_APPROVED', 'WORK_CANDIDATE_REJECTED', 'WORK_CANDIDATE_EDITED', 'CALENDAR_CONNECTION_CHANGED');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "address" TEXT,
    "gst_hst_registration_number" TEXT,
    "branding_logo_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "billing_address" TEXT,
    "contact_email" TEXT,
    "status" "client_status" NOT NULL DEFAULT 'ACTIVE',
    "provenance" "provenance" NOT NULL DEFAULT 'SYSTEM_CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "default_rate" DECIMAL(12,2) NOT NULL,
    "tax_status" "tax_status",
    "status" "service_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "invoice_number" TEXT,
    "invoice_date" DATE,
    "due_date" DATE,
    "pre_tax_subtotal" DECIMAL(12,2),
    "total_tax" DECIMAL(12,2),
    "invoice_total" DECIMAL(12,2),
    "payment_terms" TEXT,
    "notes" TEXT,
    "provenance" "provenance" NOT NULL DEFAULT 'SYSTEM_CREATED',
    "replaces_invoice_id" UUID,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "finalized_at" TIMESTAMP(3),
    "field_verification" JSONB,
    "billed_client_snapshot" JSONB,
    "billed_business_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_item" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "line_order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_subtotal" DECIMAL(12,2) NOT NULL,
    "tax_status" "tax_status" NOT NULL,
    "tax_group_key" TEXT,
    "service_id" UUID,
    "work_candidate_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_tax_line" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "tax_authority" TEXT NOT NULL,
    "tax_type" TEXT NOT NULL,
    "rate" DECIMAL(7,5) NOT NULL,
    "taxable_subtotal" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_tax_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_send_attempt" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "send_attempt_status" NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "invoice_send_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reversal" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_reversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_configuration_version" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_gst_hst_registered" BOOLEAN NOT NULL,
    "tax_lines" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_configuration_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_connection" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "google_account_email" TEXT,
    "access_token_ciphertext" TEXT,
    "refresh_token_ciphertext" TEXT,
    "status" "calendar_connection_status" NOT NULL DEFAULT 'ACTIVE',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnected_at" TIMESTAMP(3),

    CONSTRAINT "calendar_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "selected_calendar" (
    "id" UUID NOT NULL,
    "calendar_connection_id" UUID NOT NULL,
    "google_calendar_id" TEXT NOT NULL,
    "display_name" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selected_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" UUID NOT NULL,
    "selected_calendar_id" UUID NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "title" TEXT,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "description" TEXT,
    "retrieved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified_at" TIMESTAMP(3),

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_candidate" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "calendar_event_id" UUID NOT NULL,
    "review_state" "work_candidate_review_state" NOT NULL DEFAULT 'PENDING',
    "client_id" UUID,
    "service_id" UUID,
    "edited_description" TEXT,
    "edited_quantity" DECIMAL(10,2),
    "match_confidence" "match_confidence",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "event_type" "audit_event_type" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "prior_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "client_business_id_idx" ON "client"("business_id");

-- CreateIndex
CREATE INDEX "service_business_id_idx" ON "service"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_replaces_invoice_id_key" ON "invoice"("replaces_invoice_id");

-- CreateIndex
CREATE INDEX "invoice_business_id_status_idx" ON "invoice"("business_id", "status");

-- CreateIndex
CREATE INDEX "invoice_business_id_invoice_date_idx" ON "invoice"("business_id", "invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_business_id_invoice_number_key" ON "invoice"("business_id", "invoice_number");

-- CreateIndex
CREATE INDEX "invoice_line_item_invoice_id_idx" ON "invoice_line_item"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_tax_line_invoice_id_idx" ON "invoice_tax_line"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_send_attempt_invoice_id_idx" ON "invoice_send_attempt"("invoice_id");

-- CreateIndex
CREATE INDEX "payment_invoice_id_idx" ON "payment"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_reversal_payment_id_key" ON "payment_reversal"("payment_id");

-- CreateIndex
CREATE INDEX "tax_configuration_version_business_id_idx" ON "tax_configuration_version"("business_id");

-- CreateIndex
CREATE INDEX "calendar_connection_business_id_idx" ON "calendar_connection"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "selected_calendar_calendar_connection_id_google_calendar_id_key" ON "selected_calendar"("calendar_connection_id", "google_calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_event_selected_calendar_id_source_event_id_key" ON "calendar_event"("selected_calendar_id", "source_event_id");

-- CreateIndex
CREATE INDEX "work_candidate_business_id_idx" ON "work_candidate"("business_id");

-- CreateIndex
CREATE INDEX "work_candidate_calendar_event_id_idx" ON "work_candidate"("calendar_event_id");

-- CreateIndex
CREATE INDEX "audit_event_business_id_timestamp_idx" ON "audit_event"("business_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_event_entity_type_entity_id_idx" ON "audit_event"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "business" ADD CONSTRAINT "business_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client" ADD CONSTRAINT "client_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_replaces_invoice_id_fkey" FOREIGN KEY ("replaces_invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_item" ADD CONSTRAINT "invoice_line_item_work_candidate_id_fkey" FOREIGN KEY ("work_candidate_id") REFERENCES "work_candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tax_line" ADD CONSTRAINT "invoice_tax_line_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_send_attempt" ADD CONSTRAINT "invoice_send_attempt_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reversal" ADD CONSTRAINT "payment_reversal_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configuration_version" ADD CONSTRAINT "tax_configuration_version_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "selected_calendar" ADD CONSTRAINT "selected_calendar_calendar_connection_id_fkey" FOREIGN KEY ("calendar_connection_id") REFERENCES "calendar_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_selected_calendar_id_fkey" FOREIGN KEY ("selected_calendar_id") REFERENCES "selected_calendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_candidate" ADD CONSTRAINT "work_candidate_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_candidate" ADD CONSTRAINT "work_candidate_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
