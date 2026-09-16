import type { Business, Client } from "@prisma/client";

/**
 * Frozen snapshot structures (Phase 2 §04 Section 3.4 / §05 Sections
 * 5.1-5.2; DEC-ARCH-031/032). Captured once, at finalization, from the
 * then-current Client/Business records; never re-derived afterward
 * (INV-IMM-005/006/007). A finalized invoice must reproduce correctly
 * even if the Client or Business row is later edited or deleted.
 */

export interface BilledClientSnapshot {
  name: string;
  billingAddress: string | null;
  contactEmail: string | null;
}

export interface BilledBusinessSnapshot {
  legalName: string;
  address: string | null;
  gstHstRegistrationNumber: string | null;
  brandingLogoRef: string | null;
}

export function buildBilledClientSnapshot(client: Client): BilledClientSnapshot {
  return {
    name: client.name,
    billingAddress: client.billingAddress,
    contactEmail: client.contactEmail,
  };
}

export function buildBilledBusinessSnapshot(business: Business): BilledBusinessSnapshot {
  return {
    // Fall back to the required `name` field when no separate invoice
    // `legalName` has been configured — legalName is optional in the
    // field spec (Phase 2 §05 Section 2), but a printed invoice needs
    // *some* business name.
    legalName: business.legalName ?? business.name,
    address: business.address,
    gstHstRegistrationNumber: business.gstHstRegistrationNumber,
    brandingLogoRef: business.brandingLogoRef,
  };
}
