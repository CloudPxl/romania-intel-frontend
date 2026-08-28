"use client";
import React, { useState } from "react";
import { generateProformaInvoice } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function PricingModal({ isOpen, onClose, tenantId }: { isOpen: boolean; onClose: () => void; tenantId: string }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>("plan_founder_vip");
  const [companyName, setCompanyName] = useState("SC Infra Construct Transilvania SRL");
  const [cui, setCui] = useState("RO12345678");
  const [email, setEmail] = useState("financiar@infraconstruct.ro");
  const [address, setAddress] = useState("Str. Memorandumului 21, Cluj-Napoca");
  const [proformaData, setProformaData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGenerateProforma = async () => {
    if (!selectedPlan) return;
    setLoading(true);
    try {
      const data = await generateProformaInvoice({
        tenant_id: tenantId,
        plan_id: selectedPlan,
        company_name: companyName,
        cui_fiscal: cui,
        billing_email: email,
        billing_address: address
      });
      setProformaData(data);
    } catch (e: any) {
      alert("Eroare: " + (e?.message || "Nu s-a putut genera factura proforma."));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!proformaData?.proforma_html) return;
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(proformaData.proforma_html);
      printWin.document.close();
      printWin.focus();
      printWin.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Activare Abonament & Factura Proforma</h2>
            <p className="text-xs text-slate-500">Generare instantanee Factura Proforma pentru plata prin Ordin de Plata (OP) sau Card.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        {!proformaData ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div
                onClick={() => setSelectedPlan("plan_acces_complet")}
                className={"cursor-pointer flex flex-col justify-between rounded-xl border p-5 transition " + (selectedPlan === "plan_acces_complet" ? "border-brand-500 bg-brand-50/50" : "border-slate-200 bg-white hover:border-slate-300")}
              >
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <h3 className="text-base font-bold text-slate-900">Acces Complet Desk</h3>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">STANDARD</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mb-3">499 <span className="text-xs font-normal text-slate-500">RON / luna</span></p>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li>- Acces la toate cele 25 de registre active</li>
                    <li>- Sinteze Executive AI</li>
                    <li>- Export CSV date calificate</li>
                    <li>- 1 Workspace & 2 Utilizatori</li>
                  </ul>
                </div>
                <button className="mt-4 w-full rounded-lg bg-slate-100 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200">
                  {selectedPlan === "plan_acces_complet" ? "Plan Selectat" : "Selecteaza 499 RON"}
                </button>
              </div>

              <div
                onClick={() => setSelectedPlan("plan_founder_vip")}
                className={"cursor-pointer flex flex-col justify-between rounded-xl border-2 p-5 relative transition " + (selectedPlan === "plan_founder_vip" ? "border-brand-600 bg-brand-50/50" : "border-slate-300 bg-white hover:border-slate-400")}
              >
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <h3 className="text-base font-bold text-slate-900">VIP Multi-Divizie</h3>
                    <span className="rounded bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-800">ENTERPRISE</span>
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900 mb-3">1499 <span className="text-xs font-normal text-slate-500">RON / luna</span></p>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    <li>- Tot ce include pachetul Acces Complet</li>
                    <li>- Scanner Caiet de Sarcini (Upload PDF/DOCX)</li>
                    <li>- Simulator Sanse de Castig & Marje</li>
                    <li>- Generator Adrese Legea 544</li>
                    <li>- Radar Concurenta & Schita Propunere Tehnica</li>
                    <li>- Pana la 10 Utilizatori</li>
                  </ul>
                </div>
                <button className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800">
                  {selectedPlan === "plan_founder_vip" ? "Plan Selectat" : "Selecteaza 1499 RON"}
                </button>
              </div>
            </div>

            {selectedPlan && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-3">
                <span className="font-bold text-slate-700 block uppercase text-[11px]">Date Facturare Companie:</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Denumire Companie</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">CUI / CIF</label>
                    <input
                      type="text"
                      value={cui}
                      onChange={(e) => setCui(e.target.value)}
                      className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Email Facturare</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Adresa Sediu Social</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-lg bg-white border border-slate-300 p-2 text-slate-900"
                    />
                  </div>
                </div>

                <button
                  onClick={handleGenerateProforma}
                  disabled={loading}
                  className="mt-3 w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition"
                >
                  {loading ? "Se emite proforma..." : (selectedPlan === "plan_founder_vip" ? "Genereaza Factura Proforma (1499 RON)" : "Genereaza Factura Proforma (499 RON)")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <span className="text-emerald-800 font-bold block text-sm">Factura Proforma {proformaData.invoice_number} a fost emisa.</span>
              <p className="text-slate-600 text-xs mt-1">Total de plata: <b>{proformaData.total_ron} RON</b> pentru {proformaData.plan_name}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <span className="font-bold text-slate-800 block">Date Transfer Bancar (Ordin de Plata - OP):</span>
              <p className="text-slate-700">Banca: <b>{proformaData.bank_details.bank_name}</b></p>
              <p className="text-slate-700">IBAN: <b className="font-mono text-slate-900">{proformaData.bank_details.iban_ron}</b></p>
              <p className="text-slate-700">Beneficiar: <b>{proformaData.bank_details.beneficiary}</b></p>
              <p className="text-slate-700">Detalii Plata: <b>{proformaData.bank_details.payment_details_prefix}{proformaData.invoice_number} ({proformaData.cui_fiscal})</b></p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800 transition"
              >
                Descarca / Printeaza Factura Proforma (PDF)
              </button>
              <button
                onClick={() => setProformaData(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Modifica Datele
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountSettingsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, preferences, updatePreferences, signInWithGoogle, signInWithEmail, signOut } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [alertEmail, setAlertEmail] = useState(preferences?.notification_email || user?.email || "");
  const [scoreThreshold, setScoreThreshold] = useState(preferences?.auto_alert_score || 9.0);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    updatePreferences({
      notification_email: alertEmail,
      auto_alert_score: Number(scoreThreshold)
    });
    alert("Setarile au fost salvate.");
    onClose();
  };

  const handleSendMagicLink = async () => {
    if (!emailInput) return;
    setAuthLoading(true);
    const { error } = await signInWithEmail(emailInput);
    setAuthLoading(false);
    if (!error) setMagicLinkSent(true);
    else alert("Eroare: " + error);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Setari Cont & Alerte Email</h3>
            <p className="text-xs text-slate-500">Personalizare flux notificari automate si autentificare.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="space-y-4 text-xs">
          {!user ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <span className="font-bold text-slate-900 block text-sm">Autentificare Operator Economic</span>
              <p className="text-slate-600">Conectati-va pentru a salva dosare in pipeline si a primi alerte automate:</p>
              
              <button
                onClick={signInWithGoogle}
                className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800 transition shadow-sm"
              >
                Conectare cu Google
              </button>

              <div className="flex items-center gap-2 text-slate-400 my-2">
                <div className="flex-1 border-b border-slate-200"></div>
                <span className="text-[10px] uppercase font-bold">Sau Email Magic Link</span>
                <div className="flex-1 border-b border-slate-200"></div>
              </div>

              {!magicLinkSent ? (
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="introduceti email-ul companiei..."
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  />
                  <button
                    onClick={handleSendMagicLink}
                    disabled={authLoading}
                    className="rounded-xl bg-slate-800 px-4 py-2 font-bold text-white hover:bg-slate-700"
                  >
                    {authLoading ? "Se trimite..." : "Trimite Link"}
                  </button>
                </div>
              ) : (
                <p className="text-emerald-700 font-bold text-center">Link de autentificare expediat. Verificati casuta de email.</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Cont Conectat:</span>
                <span className="font-bold text-emerald-700">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Rol Platforma:</span>
                <span className="font-semibold text-slate-800">{user.role}</span>
              </div>
              <button onClick={signOut} className="mt-2 w-full rounded-lg bg-rose-50 border border-rose-200 py-1.5 text-center text-rose-700 hover:bg-rose-100 transition font-medium">
                Deconectare Cont
              </button>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <span className="font-bold text-slate-700 block uppercase text-[11px]">Canal Trimitere Alerte Email</span>
            <div>
              <label className="block text-slate-600 mb-1">Email Destinatar Notificari</label>
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="ex: director@infraconstruct.ro"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Prag Minim Scor Oportunitate pentru Alerta Automata</label>
              <select
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 p-2.5 text-slate-900"
              >
                <option value={9.5}>Scor &ge; 9.5 (Doar Proiecte Strategice Critice)</option>
                <option value={9.0}>Scor &ge; 9.0 (Toate Oportunitatile Calificate)</option>
                <option value={8.5}>Scor &ge; 8.5 (Toate Semnalele Active)</option>
              </select>
            </div>
          </div>

          <button onClick={handleSave} className="w-full rounded-xl bg-slate-900 py-2.5 font-bold text-white text-xs hover:bg-slate-800 transition mt-2">
            Salveaza Preferintele
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceDeskModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { desks, activeDesk, createDesk, deleteDesk, switchDesk } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [cui, setCui] = useState("");
  const [domain, setDomain] = useState("infrastructura");
  const [counties, setCounties] = useState("Iasi, Cluj, Bucuresti");
  const [minBudget, setMinBudget] = useState(5000000);
  const [keywords, setKeywords] = useState("drum, pod, asfalt, metrou");
  const [divisionName, setDivisionName] = useState("Divizia Principala");

  if (!isOpen) return null;

  const handleCreate = () => {
    if (!name.trim() || !cui.trim()) {
      alert("Completati numele companiei si codul fiscal (CUI).");
      return;
    }
    const countyList = counties.split(",").map(c => c.trim()).filter(Boolean);
    const keywordList = keywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);

    createDesk({
      name,
      cui,
      primary_domain: domain,
      target_counties: countyList.length > 0 ? countyList : ["Toate"],
      min_budget_ron: Number(minBudget) || 1000000,
      keywords: keywordList,
      divisions: [
        {
          id: "div_" + Date.now(),
          name: divisionName || "Divizia Principala",
          keywords: keywordList
        }
      ]
    });

    setIsCreating(false);
    setName("");
    setCui("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Administrare Companii & Desk-uri</h3>
            <p className="text-xs text-slate-500">Configurati companiile din portofoliu, domeniile de activitate si cuvintele-cheie monitorizate.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        {!isCreating ? (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-700 uppercase text-[11px]">Companii & Desk-uri Active ({desks.length})</span>
              <button
                onClick={() => setIsCreating(true)}
                className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800 transition"
              >
                + Adauga Companie Noua
              </button>
            </div>

            <div className="space-y-2">
              {desks.map(d => (
                <div
                  key={d.id}
                  className={"rounded-xl border p-4 transition flex justify-between items-center " + (d.id === activeDesk?.id ? "border-brand-500 bg-brand-50/40" : "border-slate-200 bg-slate-50")}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{d.name}</h4>
                      {d.id === activeDesk?.id && (
                        <span className="rounded bg-brand-100 px-2 py-0.5 font-bold text-brand-800 text-[10px]">Activ</span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">CUI: {d.cui} &bull; Domeniu: <span className="capitalize">{d.primary_domain}</span></p>
                    <p className="text-slate-600 text-[11px] mt-1">Judete: {d.target_counties?.join(", ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.id !== activeDesk?.id && (
                      <button
                        onClick={() => switchDesk(d.id)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Comuta
                      </button>
                    )}
                    {desks.length > 1 && (
                      <button
                        onClick={() => deleteDesk(d.id)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Sterge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-900 uppercase text-[11px]">Configurare Desk Nou</span>
              <button onClick={() => setIsCreating(false)} className="text-slate-500 hover:underline">Inapoi</button>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Denumire Companie</label>
              <input
                type="text"
                placeholder="ex: SC Terra Construct SRL"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Cod Fiscal (CUI)</label>
                <input
                  type="text"
                  placeholder="ex: RO34567890"
                  value={cui}
                  onChange={(e) => setCui(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Domeniu Strategic Principal</label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
                >
                  <option value="infrastructura">Infrastructura & Transporturi</option>
                  <option value="sanatate">Sanatate & Echipamente Medicale</option>
                  <option value="energie">Energie & Utilitati Verzi</option>
                  <option value="aparare">Aparare & Securitate Speciala</option>
                  <option value="digitalizare">Digitalizare, IT & Smart City</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Judete Vizate (separate prin virgula)</label>
              <input
                type="text"
                placeholder="ex: Cluj, Iasi, Timis, Bucuresti"
                value={counties}
                onChange={(e) => setCounties(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Cuvinte-cheie Monitorizate (separate prin virgula)</label>
              <input
                type="text"
                placeholder="ex: pod, asfalt, consolidare, statie tratare"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1">Nume Divizie Principala</label>
                <input
                  type="text"
                  placeholder="ex: Divizia Lucrari Civile"
                  value={divisionName}
                  onChange={(e) => setDivisionName(e.target.value)}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Buget Minim Proiect (RON)</label>
                <input
                  type="number"
                  value={minBudget}
                  onChange={(e) => setMinBudget(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-50 border border-slate-300 p-2 text-slate-900 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 font-bold text-white hover:bg-slate-800 transition"
              >
                Salveaza si Activeaza Desk
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-200"
              >
                Anuleaza
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
