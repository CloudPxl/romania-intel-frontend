"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { fetchTenantPipeline } from "@/lib/api";

export default function PipelinePage() {
  const { activeDesk } = useAuth();
  const tenantId = activeDesk?.id || "desk_default";
  const [pipelineData, setPipelineData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const data = await fetchTenantPipeline(tenantId);
      setPipelineData(data);
    } catch (e) {
      console.warn("Pipeline load note:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, [tenantId]);

  return (
    <main className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Pipeline Bidding & Management Dosare Pre-SEAP</h1>
            <p className="text-xs text-slate-500">Monitorizare stadiu intern: evaluare tehnica, adrese clarificari si marje estimate.</p>
          </div>
          <button
            onClick={() => loadPipeline()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            {loading ? "Se actualizeaza..." : "Reincarca"}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-xs text-slate-500">Se incarca pipeline-ul companiei...</div>
          ) : !pipelineData?.deals?.length ? (
            <div className="flex h-48 flex-col items-center justify-center text-xs text-slate-500 space-y-2">
              <span>Nu aveti dosare salvate in pipeline-ul curent.</span>
              <span className="text-[11px] text-brand-700">Deschideti orice dosar din Newsletter si apasati "Salveaza in Pipeline".</span>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelineData.deals.map((d: any) => (
                <div key={d.deal_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800 uppercase">
                        {d.stage ? d.stage.replace("_", " ") : "Nou"}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{d.project_title}</h4>
                      <p className="text-slate-600 text-xs">{d.entity_name}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900">{(d.financial_value_ron / 1000000).toFixed(2)} Mil. RON</span>
                      <span className="block text-[10px] text-emerald-700 font-bold">Marja Tinta: {d.target_margin_pct}%</span>
                    </div>
                  </div>
                  <div className="rounded bg-white p-2 text-slate-700 text-[11px] border border-slate-200">
                    <b>Notite Bidding:</b> {d.notes}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
