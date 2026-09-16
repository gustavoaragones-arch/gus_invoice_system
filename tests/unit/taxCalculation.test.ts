import { describe, expect, it } from "vitest";
import { UnresolvedTaxApplicabilityError } from "@/server/domain/errors";
import { Decimal } from "@/server/domain/money";
import { buildTaxGroupKey, calculateInvoice, isTaxApplicabilityResolvable } from "@/server/domain/taxCalculation";

describe("tax calculation — grouping and sequence (Phase 2 §07, INV-TAX-*)", () => {
  it("single tax group reproduces Phase 2 §07 Section 8 example", () => {
    const result = calculateInvoice(
      [{ key: "l1", quantity: new Decimal("10"), unitPrice: new Decimal("100.00"), taxStatus: "TAXABLE" }],
      [{ taxAuthority: "CRA", taxType: "GST", rate: new Decimal("0.05") }],
    );
    expect(result.preTaxSubtotal.toFixed(2)).toBe("1000.00");
    expect(result.totalTax.toFixed(2)).toBe("50.00");
    expect(result.invoiceTotal.toFixed(2)).toBe("1050.00");
    expect(result.taxGroups).toHaveLength(1);
    expect(result.taxGroups[0]?.taxGroupKey).toBe(buildTaxGroupKey("CRA", "GST", new Decimal("0.05")));
  });

  it("rejects multiple configured tax groups because applicability is unresolved (INV-TAX-006 containment)", () => {
    const taxLines = [
      { taxAuthority: "CRA", taxType: "GST", rate: new Decimal("0.05") },
      { taxAuthority: "BC Ministry of Finance", taxType: "PST", rate: new Decimal("0.07") },
    ];
    expect(isTaxApplicabilityResolvable(taxLines)).toBe(false);
    expect(() =>
      calculateInvoice(
        [{ key: "l1", quantity: new Decimal("1"), unitPrice: new Decimal("100.00"), taxStatus: "TAXABLE" }],
        taxLines,
      ),
    ).toThrow(UnresolvedTaxApplicabilityError);
  });

  it("same authority/type at different rates produces distinct groups", () => {
    const key1 = buildTaxGroupKey("CRA", "GST", new Decimal("0.05"));
    const key2 = buildTaxGroupKey("CRA", "GST", new Decimal("0.10"));
    expect(key1).not.toBe(key2);
  });

  it("zero-rated lines are excluded from the taxable base but not silently omitted", () => {
    const result = calculateInvoice(
      [
        { key: "taxable", quantity: new Decimal("1"), unitPrice: new Decimal("100.00"), taxStatus: "TAXABLE" },
        { key: "zero", quantity: new Decimal("1"), unitPrice: new Decimal("50.00"), taxStatus: "ZERO_RATED" },
      ],
      [{ taxAuthority: "CRA", taxType: "GST", rate: new Decimal("0.05") }],
    );
    // Pre-tax subtotal includes the zero-rated line (it is still billed).
    expect(result.preTaxSubtotal.toFixed(2)).toBe("150.00");
    // But the taxable base for the GST group excludes it.
    expect(result.taxGroups[0]?.taxableSubtotal.toFixed(2)).toBe("100.00");
    expect(result.taxGroups[0]?.taxAmount.toFixed(2)).toBe("5.00");
    const zeroLine = result.lineItems.find((l) => l.key === "zero");
    expect(zeroLine?.taxGroupKey).toBeNull();
  });

  it("exempt lines are excluded from any tax group entirely", () => {
    const result = calculateInvoice(
      [{ key: "exempt", quantity: new Decimal("1"), unitPrice: new Decimal("200.00"), taxStatus: "EXEMPT" }],
      [{ taxAuthority: "CRA", taxType: "GST", rate: new Decimal("0.05") }],
    );
    expect(result.taxGroups[0]?.taxableSubtotal.toFixed(2)).toBe("0.00");
    expect(result.taxGroups[0]?.taxAmount.toFixed(2)).toBe("0.00");
    expect(result.totalTax.toFixed(2)).toBe("0.00");
    expect(result.invoiceTotal.toFixed(2)).toBe("200.00");
  });

  it("a business with no tax configuration produces no tax groups at all", () => {
    const result = calculateInvoice(
      [{ key: "l1", quantity: new Decimal("1"), unitPrice: new Decimal("100.00"), taxStatus: "TAXABLE" }],
      [],
    );
    expect(result.taxGroups).toHaveLength(0);
    expect(result.totalTax.toFixed(2)).toBe("0.00");
    expect(result.invoiceTotal.toFixed(2)).toBe("100.00");
  });
});
