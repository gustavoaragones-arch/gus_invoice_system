import { prisma } from "@/server/db/client";
import { withAuthorizedTransaction, type Tx } from "@/server/db/authorizedTransaction";
import type { AuthContext } from "@/server/auth/types";

/**
 * Test-only fixture builders. Deliberately go through the same
 * withAuthorizedTransaction path production code uses (not a bypass) so
 * that fixture creation itself is a continuous proof that RLS + the
 * `app.user_id` session variable work end-to-end, not just that the
 * domain functions do.
 */

let counter = 0;
function unique(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function createTestUser(email?: string) {
  return prisma.user.create({ data: { email: email ?? `${unique("user")}@example.test` } });
}

export function authFor(user: { id: string; email: string }): AuthContext {
  return { userId: user.id, email: user.email };
}

export async function createTestBusiness(auth: AuthContext, overrides: Partial<{ name: string; gstHstRegistrationNumber: string; legalName: string; address: string }> = {}) {
  return withAuthorizedTransaction(auth, async (tx) => {
    return tx.business.create({
      data: {
        ownerUserId: auth.userId,
        name: overrides.name ?? unique("Business"),
        legalName: overrides.legalName,
        gstHstRegistrationNumber: overrides.gstHstRegistrationNumber,
        address: overrides.address,
      },
    });
  });
}

export async function createTestClient(auth: AuthContext, businessId: string, overrides: Partial<{ name: string; billingAddress: string; contactEmail: string }> = {}) {
  return withAuthorizedTransaction(auth, async (tx) => {
    return tx.client.create({
      data: {
        businessId,
        name: overrides.name ?? unique("Client"),
        billingAddress: overrides.billingAddress,
        contactEmail: overrides.contactEmail,
      },
    });
  });
}

export async function createTestService(auth: AuthContext, businessId: string, overrides: Partial<{ description: string; unit: string; defaultRate: string }> = {}) {
  return withAuthorizedTransaction(auth, async (tx) => {
    return tx.service.create({
      data: {
        businessId,
        description: overrides.description ?? unique("Service"),
        unit: overrides.unit ?? "hour",
        defaultRate: overrides.defaultRate ?? "100.00",
      },
    });
  });
}

export interface TestTaxLine {
  taxAuthority: string;
  taxType: string;
  rate: string;
  appliesTo?: string;
}

export async function createTestTaxConfiguration(
  auth: AuthContext,
  businessId: string,
  options: { isGstHstRegistered: boolean; taxLines: TestTaxLine[]; effectiveFrom?: Date },
) {
  return withAuthorizedTransaction(auth, async (tx) => {
    return tx.taxConfigurationVersion.create({
      data: {
        businessId,
        effectiveFrom: options.effectiveFrom ?? new Date("2020-01-01"),
        isGstHstRegistered: options.isGstHstRegistered,
        taxLines: options.taxLines as unknown as object,
      },
    });
  });
}

/** Full happy-path fixture: a user owning a business with a GST-registered
 * 5% configuration, one client, and one $100/hour service. */
export async function createFullTestFixture(overrides: { taxLines?: TestTaxLine[] } = {}) {
  const user = await createTestUser();
  const auth = authFor(user);
  const business = await createTestBusiness(auth);
  const client = await createTestClient(auth, business.id);
  const service = await createTestService(auth, business.id);
  const taxLines = overrides.taxLines ?? [{ taxAuthority: "CRA", taxType: "GST", rate: "0.05" }];
  await createTestTaxConfiguration(auth, business.id, { isGstHstRegistered: true, taxLines });
  return { user, auth, business, client, service };
}

export async function withTx<T>(auth: AuthContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withAuthorizedTransaction(auth, fn);
}
