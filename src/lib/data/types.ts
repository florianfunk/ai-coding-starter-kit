// Shared domain types for the auth & multi-tenant foundation (PROJ-1).

export type Role = "admin" | "analyst" | "viewer";
export type MemberStatus = "active" | "deactivated";
export type InviteStatus = "pending" | "expired" | "revoked";

export interface Organization {
  id: string;
  name: string;
}

export interface Membership {
  orgId: string;
  orgName: string;
  role: Role;
}

export interface Member {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: MemberStatus;
  isSelf?: boolean;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: InviteStatus;
  invitedAt: string; // ISO date
}

export const ROLES: Role[] = ["admin", "analyst", "viewer"];
