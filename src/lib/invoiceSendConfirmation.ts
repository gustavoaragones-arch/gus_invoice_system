/**
 * Transient send-confirmation gate for invoice delivery UI.
 * The server still validates destination format and invoice state independently.
 */
export function isDestinationEmailVisible(destinationEmail: string): boolean {
  return destinationEmail.trim().length > 0;
}

export function canExecuteInvoiceSend(destinationEmail: string, destinationConfirmed: boolean): boolean {
  if (!destinationConfirmed) return false;
  const trimmed = destinationEmail.trim();
  return trimmed.length > 0 && trimmed.includes("@");
}

export function shouldBlockSendWithoutDestinationConfirmation(destinationConfirmed: boolean): boolean {
  return !destinationConfirmed;
}
