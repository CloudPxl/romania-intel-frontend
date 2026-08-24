const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ro-intel-engine.onrender.com";

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  avatar_url?: string;
  tenant_id: string;
  role: string;
  custom_ui_settings?: Record<string, any>;
  tenant?: {
    id: string;
    company_name: string;
    fiscal_code_cui?: string;
    tier: string;
  };
}

export async function syncBackendAuth(email: string, fullName?: string, phone?: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, full_name: fullName, phone, provider: "google" }),
  });
  if (!res.ok) throw new Error("Failed to sync auth with Render backend");
  return res.json();
}

export async function switchTenantWorkspace(userId: string, targetTenantId: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/switch-tenant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, target_tenant_id: targetTenantId }),
  });
  if (!res.ok) throw new Error("Failed to switch workspace");
  return res.json();
}

export async function fetchTenantFeed(tenantId: string) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/feed`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

export async function fetchTenantAnalytics(tenantId: string) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/analytics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}
