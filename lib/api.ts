const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "https://ro-intel-engine.onrender.com";

export async function syncUserWithAuth(email: string, fullName?: string, avatarUrl?: string, provider = "google") {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        provider
      })
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("[AuthSync] Backend cold start or offline, using client session:", err);
  }

  // Graceful fallback profile to prevent frontend runtime crashes
  return {
    status: "synced_offline",
    user: {
      email,
      full_name: fullName || email.split("@")[0],
      tenant_id: "t1_infra_transilvania",
      role: "Head Executive",
      avatar_url: avatarUrl
    }
  };
}

export async function fetchTenantFeed(tenantId: string) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/feed`);
  if (!res.ok) throw new Error("Failed to fetch tenant feed");
  return res.json();
}

export async function fetchTenantAnalytics(tenantId: string) {
  const res = await fetch(`${API_BASE}/api/v1/tenants/${tenantId}/analytics`);
  if (!res.ok) throw new Error("Failed to fetch tenant analytics");
  return res.json();
}
