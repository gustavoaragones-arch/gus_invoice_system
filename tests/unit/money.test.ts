import { describe, expect, it } from "vitest";
import {
  Decimal,
  calculateBalanceDue,
  calculateInvoiceTotal,
  calculateLineSubtotal,
  calculateOverpayment,
  calculateTaxGroupAmount,
  roundToCent,
  sumLineSubtotals,
  sumNonReversedPayments,
  sumTaxGroups,
} from "@/server/domain/money";

describe("money engine — exact decimal arithmetic (Section 8, INV-RND-*)", () => {
  it("never uses floating point: 0.1 + 0.2 style drift does not occur", () => {
    const a = new Decimal("0.10");
    const b = new Decimal("0.20");
    expect(a.plus(b).toFixed(2)).toBe("0.30");
  });

  it("rounds half-up to the nearest cent (DEC-MONEY-003 / INV-RND-001)", () => {
    expect(roundToCent(new Decimal("1.005")).toFixed(2)).toBe("1.01");
    expect(roundToCent(new Decimal("1.004")).toFixed(2)).toBe("1.00");
    expect(roundToCent(new Decimal("2.675")).toFixed(2)).toBe("2.68");
  });

  it("computes line subtotal = quantity × unit price, rounded (INV-RND-002)", () => {
    const subtotal = calculateLineSubtotal(new Decimal("3"), new Decimal("33.333"));
    // 3 × 33.333 = 99.999 → rounds to 100.00
    expect(subtotal.toFixed(2)).toBe("100.00");
  });

  it("sums already-rounded line subtotals without re-rounding", () => {
    const sum = sumLineSubtotals([new Decimal("10.00"), new Decimal("20.005")]);
    // No rounding is applied by sumLineSubtotals itself — inputs are
    // expected to already be rounded by calculateLineSubtotal.
    expect(sum.toFixed(3)).toBe("30.005");
  });

  it("computes tax group amount rounded once per group (INV-RND-003)", () => {
    const amount = calculateTaxGroupAmount(new Decimal("1000.00"), new Decimal("0.05"));
    expect(amount.toFixed(2)).toBe("50.00");
  });

  it("computes invoice total = pre-tax subtotal + total tax, no further rounding (INV-RND-004)", () => {
    const total = calculateInvoiceTotal(new Decimal("1000.00"), new Decimal("50.00"));
    expect(total.toFixed(2)).toBe("1050.00");
  });

  it("Phase 2 §07 Section 8 worked example reproduces exactly", () => {
    const lineSubtotal = calculateLineSubtotal(new Decimal("10"), new Decimal("100.00"));
    expect(lineSubtotal.toFixed(2)).toBe("1000.00");
    const preTaxSubtotal = sumLineSubtotals([lineSubtotal]);
    const taxAmount = calculateTaxGroupAmount(preTaxSubtotal, new Decimal("0.05"));
    expect(taxAmount.toFixed(2)).toBe("50.00");
    const totalTax = sumTaxGroups([taxAmount]);
    const invoiceTotal = calculateInvoiceTotal(preTaxSubtotal, totalTax);
    expect(invoiceTotal.toFixed(2)).toBe("1050.00");
    // Revenue excludes tax (INV-REV-002).
    expect(preTaxSubtotal.toFixed(2)).toBe("1000.00");
  });

  it("Phase 2 §07 Section 9 mixed-tax-group arithmetic reproduces exactly as isolated primitives (not invoice finalization behavior)", () => {
    const lineA = calculateLineSubtotal(new Decimal("1"), new Decimal("500.00"));
    const lineB = calculateLineSubtotal(new Decimal("1"), new Decimal("300.00"));
    const gstAmount = calculateTaxGroupAmount(lineA, new Decimal("0.05"));
    const pstAmount = calculateTaxGroupAmount(lineB, new Decimal("0.07"));
    expect(gstAmount.toFixed(2)).toBe("25.00");
    expect(pstAmount.toFixed(2)).toBe("21.00");
    const totalTax = sumTaxGroups([gstAmount, pstAmount]);
    expect(totalTax.toFixed(2)).toBe("46.00");
    const preTaxSubtotal = sumLineSubtotals([lineA, lineB]);
    const invoiceTotal = calculateInvoiceTotal(preTaxSubtotal, totalTax);
    expect(invoiceTotal.toFixed(2)).toBe("846.00");
  });

  it("balance due floors at zero and never goes negative (DEC-PAY-001)", () => {
    const balance = calculateBalanceDue(new Decimal("100.00"), new Decimal("150.00"));
    expect(balance.toFixed(2)).toBe("0.00");
  });

  it("overpayment is the excess beyond invoice total, floored at zero", () => {
    const overpayment = calculateOverpayment(new Decimal("100.00"), new Decimal("150.00"));
    expect(overpayment.toFixed(2)).toBe("50.00");
    const noOverpayment = calculateOverpayment(new Decimal("100.00"), new Decimal("60.00"));
    expect(noOverpayment.toFixed(2)).toBe("0.00");
  });

  it("sums non-reversed payment amounts", () => {
    const total = sumNonReversedPayments([new Decimal("40.00"), new Decimal("60.00")]);
    expect(total.toFixed(2)).toBe("100.00");
  });
});
