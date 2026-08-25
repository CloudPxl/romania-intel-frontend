function getApiBase(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return "https://api.ro-intel.xyz";
  }
  return process.env.NEXT_PUBLIC_API_BASE || "https://api.ro-intel.xyz";
}

export async function syncBackendAuth(email: string, fullName?: string, avatarUrl?: string) {
  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName, avatar_url: avatarUrl })
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("[AuthSync] Offline fallback:", err);
  }
  return {
    status: "synced_offline",
    user: {
      email,
      full_name: fullName || email.split("@")[0],
      tenant_id: "t1_infra_transilvania",
      role: "Director Bidding & Strategie",
      avatar_url: avatarUrl
    }
  };
}

export const syncUserWithAuth = syncBackendAuth;

export async function switchTenantWorkspace(tenantId: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("ro_intel_active_tenant", tenantId);
  }
  return { tenant_id: tenantId, status: "switched" };
}

export async function fetchTenantFeed(tenantId: string, productId?: string, category?: string, forceRefresh = false) {
  let url = `${getApiBase()}/api/v1/tenants/${tenantId}/feed?force_refresh=${forceRefresh}`;
  if (productId) url += `&product_id=${productId}`;
  if (category && category !== "all") url += `&category=${category}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Eroare la preluarea fluxului pre-SEAP");
  return res.json();
}

export async function fetchTenantProducts(tenantId: string) {
  const res = await fetch(`${getApiBase()}/api/v1/tenants/${tenantId}/products`);
  if (!res.ok) throw new Error("Eroare la preluarea liniilor de produse");
  return res.json();
}

export async function fetchTenantPipeline(tenantId: string, stage?: string) {
  let url = `${getApiBase()}/api/v1/tenants/${tenantId}/pipeline`;
  if (stage && stage !== "all") url += `?stage=${stage}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Eroare la preluarea pipeline-ului");
  return res.json();
}

export async function addLeadToPipeline(tenantId: string, leadData: any) {
  const res = await fetch(`${getApiBase()}/api/v1/tenants/${tenantId}/pipeline/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_data: leadData })
  });
  if (!res.ok) throw new Error("Eroare la salvarea în pipeline");
  return res.json();
}

export async function updatePipelineDeal(tenantId: string, payload: { deal_id: string; new_stage: string; notes?: string; proposed_price?: number }) {
  const res = await fetch(`${getApiBase()}/api/v1/tenants/${tenantId}/pipeline/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Eroare la actualizarea stadiului");
  return res.json();
}

export async function triggerEmailAlert(leadData: any, recipientEmail: string) {
  const res = await fetch(`${getApiBase()}/api/v1/notifications/send-email-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_data: leadData, recipient_email: recipientEmail })
  });
  if (!res.ok) throw new Error("Eroare la expedierea alertei pe email");
  return res.json();
}

export async function fetch72hMarketReport(tenantId: string) {
  const res = await fetch(`${getApiBase()}/api/v1/analytics/market-report-72h?tenant_id=${tenantId}`);
  if (!res.ok) throw new Error("Eroare la raportul macro");
  return res.json();
}

export async function askCopilotChat(query: string, tenantId: string) {
  const res = await fetch(`${getApiBase()}/api/v1/copilot/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, tenant_id: tenantId })
  });
  if (!res.ok) throw new Error("Copilot chat failed");
  return res.json();
}

export async function generateProformaInvoice(payload: {
  tenant_id: string;
  plan_id: string;
  company_name: string;
  cui_fiscal: string;
  billing_email: string;
  billing_address?: string;
}) {
  const res = await fetch(`${getApiBase()}/api/v1/tenants/${payload.tenant_id}/billing/proforma`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Eroare la generarea facturii proforme");
  return res.json();
}

export async function uploadCaietFile(file: File, projectTitle: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_title", projectTitle);

  const res = await fetch(`${getApiBase()}/api/v1/addons/upload-caiet`, {
    method: "POST",
    body: formData
  });
  if (!res.ok) throw new Error("Eroare la analizarea fișierului");
  return res.json();
}

export async function evaluateBusinessEligibility(payload: {
  company_name: string;
  cui_fiscal: string;
  caen_code: string;
  turnover_ron: number;
  employee_count: number;
  county: string;
}) {
  const res = await fetch(`${getApiBase()}/api/v1/business-eligibility/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Eroare la scanarea eligibilității");
  return res.json();
}

export async function analyzeCaietSarcini(projectTitle: string, specificationText: string) {
  const res = await fetch(`${getApiBase()}/api/v1/addons/analyze-caiet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_title: projectTitle, specification_text: specificationText })
  });
  if (!res.ok) throw new Error("Eroare la analiza specificației");
  return res.json();
}

export async function predictWinRate(estimatedBudget: number, proposedPrice: number, hasLocalPartner = false) {
  const res = await fetch(`${getApiBase()}/api/v1/addons/predict-win-rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      estimated_budget_ron: estimatedBudget,
      proposed_price_ron: proposedPrice,
      has_local_partnership: hasLocalPartner
    })
  });
  if (!res.ok) throw new Error("Eroare la calcularea șanselor");
  return res.json();
}

export async function generateLegalClarification(payload: {
  authority_name: string;
  project_title: string;
  source_id: string;
  company_name: string;
  cui_fiscal: string;
  clarification_points: string;
}) {
  const res = await fetch(`${getApiBase()}/api/v1/addons/generate-clarification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Eroare la generarea adresei oficiale");
  return res.json();
}
