// PREVIEW-ONLY mock data. Used while no Supabase project is configured so the
// full UI is reviewable. /backend (PROJ-1) replaces all real-mode data access
// with RLS-scoped Supabase queries; this file is only consulted in preview mode.
import type { Member, Membership, Invitation } from "./types";

export const MOCK_MEMBERSHIPS: Membership[] = [
  { orgId: "demo-aldi", orgName: "Demo Retail GmbH", role: "admin" },
  { orgId: "demo-second", orgName: "Zweite Organisation", role: "analyst" },
];

export const MOCK_MEMBERS: Member[] = [
  { id: "u1", name: "Florian Funk", email: "florian@demo-retail.de", role: "admin", status: "active", isSelf: true },
  { id: "u2", name: "Mara Schneider", email: "mara@demo-retail.de", role: "analyst", status: "active" },
  { id: "u3", name: "Tobias Weber", email: "tobias@demo-retail.de", role: "viewer", status: "active" },
  { id: "u4", name: null, email: "deaktiviert@demo-retail.de", role: "analyst", status: "deactivated" },
];

export const MOCK_INVITES: Invitation[] = [
  { id: "i1", email: "neue.kollegin@demo-retail.de", role: "analyst", status: "pending", invitedAt: "2026-06-06" },
];
