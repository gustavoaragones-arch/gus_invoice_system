import { describe, expect, it } from "vitest";
import {
  canExecuteInvoiceSend,
  isDestinationEmailVisible,
  shouldBlockSendWithoutDestinationConfirmation,
} from "@/lib/invoiceSendConfirmation";

describe("invoice send destination confirmation", () => {
  it("treats a non-empty destination as visible to the user", () => {
    expect(isDestinationEmailVisible("billing@client.test")).toBe(true);
    expect(isDestinationEmailVisible("  billing@client.test  ")).toBe(true);
    expect(isDestinationEmailVisible("")).toBe(false);
    expect(isDestinationEmailVisible("   ")).toBe(false);
  });

  it("blocks send execution until the destination is explicitly confirmed", () => {
    expect(shouldBlockSendWithoutDestinationConfirmation(false)).toBe(true);
    expect(shouldBlockSendWithoutDestinationConfirmation(true)).toBe(false);
    expect(canExecuteInvoiceSend("billing@client.test", false)).toBe(false);
  });

  it("allows send only after explicit confirmation of a valid destination", () => {
    expect(canExecuteInvoiceSend("billing@client.test", true)).toBe(true);
    expect(canExecuteInvoiceSend("invalid-email", true)).toBe(false);
    expect(canExecuteInvoiceSend("", true)).toBe(false);
  });
});
