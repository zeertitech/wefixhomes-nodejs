/**
 * Shared JWT payload type — used by both the authenticate middleware and jwt utils.
 * Defined here to avoid circular imports between authenticate.ts ↔ jwt.ts.
 */
export interface JwtPayload {
  userId: string;
  role: string;
  roleId: number;
  email: string;
}
