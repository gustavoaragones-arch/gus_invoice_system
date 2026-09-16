/**
 * Identity established by authentication, before any business authorization
 * has been checked (Phase 0 SEC-AUTH-001; Phase 2 §13 Section 3).
 */
export interface AuthContext {
  userId: string;
  email: string;
}
