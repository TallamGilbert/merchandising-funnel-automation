/**
 * Staff roles (D-16, D-17). Directory owns who has which role; every other
 * service only reads the role out of the signed session token. MANAGER and
 * OWNER are also Procurement's PO approver roles (D-1).
 */
export enum Role {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  BUYER = "BUYER",
  ACCOUNTANT = "ACCOUNTANT",
  CASHIER = "CASHIER",
  WAREHOUSE_STAFF = "WAREHOUSE_STAFF",
}

/**
 * The principal a service uses when it calls another service over REST
 * (e.g. Procurement → Vendor Management). It passes every role check: the
 * caller already enforced the end user's role at its own edge.
 */
export const SERVICE_ROLE = "SERVICE" as const;

export type PrincipalRole = Role | typeof SERVICE_ROLE;
