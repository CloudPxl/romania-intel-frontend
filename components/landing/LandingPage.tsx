"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { fetchPublicStats, type PublicStats } from "@/lib/api";
import { PLANS, PRICE_REASSURANCE, formatLei, type PlanInfo } from "@/lib/plans";
import "./landing.css";

/**
 * The public page a visitor sees at "/". Built from the landing mockup
 * (claude.ai design canvas "RO-INTEL — pagina de prezentare"), with every
 * demonstrative figure replaced by a real one:
 *
 *  - the counters read /api/v1/system/public-stats (aggregates, cached 5
 *    min); a figure the API cannot give is left out, never shown as 0;
 *  - "Vezi un dosar real" opens /sample-dossier.json — the production
 *    generators run on a live SEAP notice by
 *    romania-intel-engine/scripts/build_sample_dossier.py;
 *  - prices and limits come from lib/plans.ts (the engine's figures).
 *
 * One action throughout: create a free account (magic link by email, or
 * Google). Everything else either scrolls to that form or explains.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCENT = "#0B6B60";

const Check = ({ size = 14, w = 2.4 }: { size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5L20 7" />
  </svg>
);
const Arrow = ({ size = 16 }: { size?: number }) => (
  <svg className="arr" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);
const Dash = () => (
  <svg className="no" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

function n(v: number | null | undefined) {
  return typeof v === "number" ? formatLei(v) : null;
}

function minutesAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return "acum";
  if (m < 60) return `acum ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `acum ${h} h` : `acum ${Math.round(h / 24)} zile`;
}

/* ------------------------------------------------------------- signup */

function SignupForm({ id, dark, planNote }: { id: string; dark?: boolean; planNote?: string | null }) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!v) return setError("Introduceți adresa de email.");
    if (!EMAIL.test(v)) return setError("Adresa pare incompletă. Exemplu: nume@firma.ro");
    setBusy(true);
    const { error: err } = await signInWithEmail(v, "/");
    setBusy(false);
    if (err) return setError(err);
    setEmail(v);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="done" role="status">
        <span className="done-ic">
          <Check size={16} w={2.6} />
        </span>
        <div>
          <p className="t-h3">Verificați inbox-ul.</p>
          <p>
            Am trimis linkul de autentificare la <b>{email}</b>. Deschideți-l pe acest dispozitiv.
          </p>
          <p className="t-small" style={{ marginTop: 6, color: dark ? "var(--ink-text2)" : "var(--text2)" }}>
            Nu a sosit în 2 minute? Verificați Spam sau{" "}
            <button type="button" style={{ textDecoration: "underline", padding: "2px 0" }} onClick={() => setSent(false)}>
              folosiți altă adresă
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="signup" onSubmit={submit} noValidate aria-label="Creare cont gratuit">
      {planNote && (
        <p className="plan-note" style={dark ? { color: "#7FD6C9" } : undefined}>
          {planNote}
        </p>
      )}
      <label className="fld-label" htmlFor={id}>
        Email de serviciu
      </label>
      <div className="signup-row">
        <input
          id={id}
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nume@firma.ro"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={`${id}-err ${id}-micro`}
        />
        <button className="btn btn-p btn-lg" type="submit" disabled={busy}>
          {busy ? "Se trimite…" : "Creează cont gratuit"}
          <Arrow />
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="err" role="alert">
          {error}
        </p>
      )}
      <p id={`${id}-micro`} className="micro">
        <span>
          <Check />
          Gratuit, fără card
        </span>
        <span>
          <Check />
          Fără parolă: primiți un link pe email
        </span>
        <span>
          <Check />
          2 documente AI incluse
        </span>
      </p>
      {dark && (
        <p className="alt">
          Preferați fără email?{" "}
          <button type="button" onClick={() => signInWithGoogle("/")}>
            Continuați cu Google
          </button>
        </p>
      )}
    </form>
  );
}

/* ---------------------------------------------------------- hero demo */

interface SampleTender {
  source_id: string;
  title: string;
  authority: string;
  county: string;
  cpv: string;
  estimated_value_ron: number;
  deadline: string;
  url: string;
}

function daysUntil(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

function HeroDemo({ tender }: { tender: SampleTender | null }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (paused || reduced) return;
    const t = setInterval(() => setStep((s) => (s + 1) % 3), 4200);
    return () => clearInterval(t);
  }, [paused, reduced]);

  const est = tender?.estimated_value_ron ?? 0;
  const days = daysUntil(tender?.deadline);
  const offerPct = 82.4;
  const tabs = [
    ["Licitație", "RO-INTEL · Registru"],
    ["Caiet", "RO-INTEL · Scaner caiet"],
    ["Preț", "RO-INTEL · Strategie"],
  ] as const;

  return (
    <div className="demo on-ink" role="group" aria-roledescription="demonstrație" aria-label="Ce face RO-INTEL cu o licitație">
      <div className="demo-top">
        <span className="mark">R</span>
        <span>{tabs[step][1]}</span>
        <span className="demo-ex">{step === 1 ? "Exemplu" : "Licitație reală"}</span>
      </div>
      <div className="demo-body" aria-live="polite">
        {step === 0 && (
          <div className="fade">
            <p className="demo-k">
              <span className="live" aria-hidden="true" />
              Procedură deschisă · SEAP · <span className="m">{tender?.source_id.replace("ELICITATIE-", "") ?? "…"}</span>
            </p>
            <p className="demo-title">{tender?.title ?? "Se încarcă o licitație reală…"}</p>
            <p className="demo-sub">
              {tender ? `${tender.authority} · ${tender.county} · CPV ` : ""}
              {tender && <span className="m">{tender.cpv}</span>}
            </p>
            <div className="facts">
              <div>
                <span>Valoare estimată</span>
                <b className="m">{est ? `${formatLei(Math.round(est))} lei` : "—"}</b>
              </div>
              <div>
                <span>Termen depunere</span>
                <b className="m">{days === null ? "—" : days > 0 ? `în ${days} zile` : "expirat"}</b>
              </div>
              <div>
                <span>Prag 80%</span>
                <b className="m">{est ? `${formatLei(Math.round(est * 0.8))} lei` : "—"}</b>
              </div>
            </div>
            <p className="why">
              <Check />
              <span>Fiecare licitație arată sursa, CUI-ul autorității și de ce se potrivește profilului dvs.</span>
            </p>
          </div>
        )}
        {step === 1 && (
          <div className="fade">
            <p className="demo-k">Caiet de sarcini scanat · clauzele marcate cu citatul exact</p>
            <div className="trap">
              <div className="trap-h">
                <span className="sev bad">Ridicat</span>
                <span className="m">art. 155 alin. (6) · Legea 98/2016</span>
              </div>
              <p className="quote">„… compatibile exclusiv cu sistemul existent, producător X.”</p>
              <p className="demo-sub" style={{ marginTop: 6 }}>
                Producător impus fără „sau echivalent” — exemplu tipic de clauză restrictivă.
              </p>
              <Link className="btn-ink" href="/login">
                Generează clarificarea · art. 160 <Arrow size={13} />
              </Link>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="fade">
            <p className="demo-k">Verificare preț înainte de depunere · art. 210</p>
            <div className="verdict-ok">
              <Check size={16} />
              <span>
                O ofertă la <b className="m">{offerPct.toLocaleString("ro-RO")}%</b> din valoarea estimată trece de pragul de 80%. Nu se cere justificarea prețului.
              </span>
            </div>
            <div className="gauge" aria-hidden="true">
              <span className="gauge-thr" style={{ left: "50%" }}>
                <span className="m">prag 80%</span>
              </span>
              <span className="gauge-you" style={{ left: `${((offerPct - 60) / 40) * 100}%` }} />
              <span className="gauge-ticks m">
                <span>60%</span>
                <span>70%</span>
                <span>80%</span>
                <span>90%</span>
                <span>100%</span>
              </span>
            </div>
            <div>
              <div className="kv">
                <span>Valoare estimată</span>
                <b className="m">{est ? `${formatLei(Math.round(est))} lei` : "—"}</b>
              </div>
              <div className="kv">
                <span>Prag 80%</span>
                <b className="m">{est ? `${formatLei(Math.round(est * 0.8))} lei` : "—"}</b>
              </div>
              <div className="kv">
                <span>Oferta simulată ({offerPct.toLocaleString("ro-RO")}%)</span>
                <b className="m">{est ? `${formatLei(Math.round((est * offerPct) / 100))} lei` : "—"}</b>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="demo-tabs" role="tablist" aria-label="Pașii demonstrației">
        {tabs.map(([label], i) => (
          <button
            key={label}
            className={`demo-tab ${step === i ? "sel" : ""}`}
            role="tab"
            aria-selected={step === i}
            onClick={() => {
              setStep(i);
              setPaused(true);
            }}
          >
            <span className="m">{i + 1}</span>
            {label}
            <span className="prog" aria-hidden="true">
              <span className={`prog-fill ${step === i ? (paused || reduced ? "full" : "run") : ""}`} key={`${step}-${paused}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- sample dossier */

interface SampleDossier {
  generated_at: string;
  tender: SampleTender;
  proposal: {
    dossier_text: string;
    declarations: { id: string; heading: string }[];
  };
  letters: Record<"clarification" | "abnormally_low_price", { doc_title: string; generated_letter: string }>;
}

function DossierViewer({ sample }: { sample: SampleDossier | null }) {
  const [tab, setTab] = useState<"proposal" | "clarification" | "price">("proposal");
  if (!sample) {
    return (
      <div className="doc" aria-busy="true">
        <div className="doc-meta">Se încarcă dosarul…</div>
      </div>
    );
  }
  const t = sample.tender;
  const text =
    tab === "proposal"
      ? sample.proposal.dossier_text
      : tab === "clarification"
        ? sample.letters.clarification.generated_letter
        : sample.letters.abnormally_low_price.generated_letter;
  const generated = new Date(sample.generated_at).toLocaleDateString("ro-RO");
  return (
    <div className="doc">
      <div className="doc-tabs" role="tablist" aria-label="Documentele dosarului">
        {(
          [
            ["proposal", "Propunere tehnică + 7 declarații"],
            ["clarification", "Clarificare · art. 160"],
            ["price", "Justificare preț · art. 210"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "sel" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="doc-meta">
        <span>
          Licitație: <b>{t.title}</b>
        </span>
        <span>
          {t.authority} · {t.county}
        </span>
        <span>
          <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
            anunțul în SEAP <span className="m">{t.source_id.replace("ELICITATIE-", "")}</span>
          </a>
        </span>
      </div>
      <div className="doc-page" tabIndex={0} aria-label="Textul documentului generat">
        {text}
      </div>
      {tab === "proposal" && (
        <ul className="doc-decl" aria-label="Declarațiile anexate">
          {sample.proposal.declarations.map((d) => (
            <li key={d.id}>
              <Check size={13} />
              {d.heading}
            </li>
          ))}
        </ul>
      )}
      <p className="doc-foot">
        Generat de RO-INTEL pe {generated}, din anunțul public, cu șabloanele de producție (fără AI). Datele ofertantului rămân de completat — în cont se iau automat din profilul firmei.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- page */

const PROBLEMS = [
  {
    fig: "înainte de SEAP",
    title: "Aflați prea târziu.",
    text: "Anunțul apare în SEAP și termenul curge deja. Acordurile de mediu, consultările de piață și registrele publice — unde investiția se vede din timp — nu le citește nimeni zilnic.",
  },
  {
    fig: "clauză restrictivă",
    title: "Clauza ascunsă din caiet.",
    text: "Un producător impus, un termen de execuție imposibil, experiență similară disproporționată. O găsiți după ce ați pregătit oferta, când nu mai e timp de o clarificare.",
  },
  {
    fig: "art. 210 · 80%",
    title: "Prețul respins.",
    text: "Sub 80% din valoarea estimată, oferta devine „aparent neobișnuit de scăzută”. Fără o justificare solidă la timp, e respinsă — oricât de bună ar fi.",
  },
];

const STEPS = [
  { title: "Spuneți-ne ce faceți.", text: "Introduceți CUI-ul. Domeniul, codurile CPV, județele și valoarea minimă devin filtrele registrului; le ajustați oricând." },
  { title: "Primiți doar ce se potrivește.", text: "Licitațiile noi vin ordonate după potrivire, pe email. Fiecare arată de ce a fost aleasă, cu dovada din anunț." },
  { title: "Verificați caietul și prețul.", text: "Clauzele restrictive sunt marcate cu citatul exact. Vedeți pragul de 80% înainte să depuneți și generați documentele .docx." },
];

const COMPARE = [
  { need: "Timp până la un dosar de ofertă .docx", us: "≈ 50 de secunde, din anunțul publicat", agg: "Nu generează documente", aggNo: true, cons: "7–10 zile lucrătoare" },
  { need: "Cost pe dosar", us: "Inclus în abonament, de la 0 lei", agg: "Abonament doar pentru alerte", cons: "3.500–9.000 lei / dosar" },
  { need: "Licitații văzute înainte de SEAP", us: "Da: acorduri de mediu, CNAIR, registre județene", agg: "Rar", cons: "Depinde de consultant" },
  { need: "Citirea caietului de sarcini", us: "Clauze restrictive marcate, cu citat și articol", agg: "Nu", aggNo: true, cons: "Manual" },
  { need: "Verificarea prețului (art. 210)", us: "Verdict față de pragul de 80%, înainte de depunere", agg: "Nu", aggNo: true, cons: "Calcul manual" },
  { need: "Alerte", us: "După CUI, CPV, județe și valoare, cu scor", agg: "Email brut, după cuvinte-cheie", cons: "Nu" },
];

const FAQ = [
  {
    q: "Am nevoie de card ca să încep?",
    a: "Nu. Contul gratuit se creează doar cu adresa de email: primiți un link și intrați. Treceți la un plan plătit doar dacă vreți mai multe documente AI, mesaje Copilot sau firme.",
  },
  {
    q: "De unde vin datele și cât de actuale sunt?",
    a: "Din SEAP/SICAP (anunțuri de participare, simplificate, achiziții directe, atribuiri), TED, acordurile de mediu ANMAP, portalul de achiziții CNAIR și registrele județene. Registrul se actualizează continuu; data ultimei sincronizări e afișată pe pagină. Dacă o sursă nu răspunde, afișăm zero, nu o estimare.",
  },
  {
    q: "Înlocuiește un consultant în achiziții publice?",
    a: "Nu. Vă scutește de căutare și de prima citire a caietului și vă dă documentele cu temeiul legal citat. Decizia și semnătura rămân ale dvs. sau ale consultantului.",
  },
  {
    q: "Pot plăti prin transfer bancar, pe factură?",
    a: "Da. Emitem factură proformă și plătiți prin OP, lunar sau anual. Prețurile sunt în RON, fără TVA.",
  },
  {
    q: "Ce se întâmplă cu datele firmei mele?",
    a: "Folosim CUI-ul și preferințele doar ca să vă filtrăm licitațiile și să completăm documentele. Serverele sunt în Uniunea Europeană; datele dvs. nu sunt folosite la antrenarea modelelor AI. Vă puteți șterge contul oricând, din setări.",
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [sample, setSample] = useState<SampleDossier | null>(null);
  const [annual, setAnnual] = useState(false);
  const [faqOpen, setFaqOpen] = useState(0);
  const [step, setStep] = useState(0);
  const [planIntent, setPlanIntent] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      fetchPublicStats()
        .then(setStats)
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    fetch("/sample-dossier.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSample(d))
      .catch(() => {});
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const de = document.documentElement;
      setScrolled(y > 8);
      const mobile = window.innerWidth < 720;
      const nearEnd = de.scrollHeight - y - window.innerHeight < 1400;
      setShowBar(mobile && y > 640 && !nearEnd);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollTo = (id: string, focusId?: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = id === "hero" ? 0 : el.getBoundingClientRect().top + window.scrollY - 64;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
    if (focusId) setTimeout(() => document.getElementById(focusId)?.focus({ preventScroll: true }), reduced ? 0 : 450);
  };
  const goSignup = () => (window.scrollY < 360 ? scrollTo("hero", "hero-email") : scrollTo("start", "final-email"));

  const synced = minutesAgo(stats?.last_sync_at);
  const counters = useMemo(
    () =>
      [
        { v: n(stats?.open_procedures), l: "proceduri de achiziție deschise acum, monitorizate în registru", src: "SEAP/SICAP, TED, CNAIR" },
        { v: n(stats?.award_outcomes), l: "contracte atribuite în SEAP, analizate pentru prețuri și concurență", src: "anunțuri de atribuire SEAP" },
        {
          v: stats ? `${stats.legal_acts}` : null,
          l: `acte normative cu ${n(stats?.legal_articles) ?? "—"} articole, reverificate săptămânal pe portalul legislativ`,
          src: "legislatie.just.ro",
        },
        { v: n(stats?.pre_seap_signals), l: "semnale pre-SEAP: acorduri de mediu și investiții înainte de licitație", src: "ANMAP, registre județene" },
      ].filter((c) => c.v !== null),
    [stats]
  );

  const tender = sample?.tender ?? null;

  return (
    <div ref={rootRef} className="lp" style={{ ["--accent" as string]: ACCENT }}>
      <header className={`hdr ${scrolled ? "scrolled" : ""}`}>
        <div className="wrap hdr-in">
          <button className="brand" onClick={() => scrollTo("hero")} aria-label="RO-INTEL, începutul paginii">
            <span className="mark">R</span>
            <span>RO-INTEL</span>
          </button>
          <nav className="hdr-nav only-desk" aria-label="Secțiunile paginii">
            <button className="link" onClick={() => scrollTo("cum")}>
              Cum funcționează
            </button>
            <button className="link" onClick={() => scrollTo("preturi")}>
              Prețuri
            </button>
            <button className="link" onClick={() => scrollTo("intrebari")}>
              Întrebări
            </button>
          </nav>
          <div className="hdr-act">
            <Link className="link only-desk" href="/login">
              Autentificare
            </Link>
            <button className="btn btn-p btn-sm" onClick={goSignup}>
              <span className="only-desk">Creează cont gratuit</span>
              <span className="only-mob">Cont gratuit</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* 1. HERO */}
        <section className="hero" id="hero" aria-labelledby="h-hero">
          <div className="wrap hero-grid">
            <div className="rise">
              <p className="eyebrow">
                <span className="dot" aria-hidden="true" />
                {stats?.open_procedures != null ? (
                  <span>
                    <b className="m" style={{ fontWeight: 500 }}>
                      {n(stats.open_procedures)}
                    </b>{" "}
                    proceduri deschise acum{synced ? ` · sincronizat ${synced}` : ""}
                  </span>
                ) : (
                  <span>Pentru firmele care participă la licitații publice în România</span>
                )}
              </p>
              <h1 id="h-hero" className="t-display">
                Găsiți licitațiile potrivite înaintea concurenței.
              </h1>
              <p className="lead">
                RO-INTEL urmărește SEAP și registrele publice, vă citește caietul de sarcini, vă spune dacă prețul trece de pragul de 80% și vă redactează documentele ofertei — înainte să depuneți.
              </p>
              <SignupForm id="hero-email" planNote={planIntent ? `Plan ales: ${planIntent}. Începeți gratuit; îl activați din cont, când vreți.` : null} />
              <p className="sources">
                Surse: <b>SEAP/SICAP</b> · <b>TED</b> · <b>acorduri de mediu ANMAP</b> · <b>CNAIR</b> · registre județene · <b>portalul legislativ</b>
              </p>
            </div>
            <div className="rise d2">
              <HeroDemo tender={tender} />
            </div>
          </div>
        </section>

        {/* 2. PROBLEM */}
        <section className="sec" id="problema" aria-labelledby="h-prob">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Problema</p>
              <h2 id="h-prob" className="t-h1">
                Licitațiile nu se pierd la deschiderea ofertelor. Se pierd înainte.
              </h2>
            </div>
            <div className="grid3">
              {PROBLEMS.map((p) => (
                <article className="card" key={p.title}>
                  <span className="fig m">{p.fig}</span>
                  <h3 className="t-h3">{p.title}</h3>
                  <p>{p.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3. HOW */}
        <section className="sec" id="cum" aria-labelledby="h-how">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Cum funcționează</p>
              <h2 id="h-how" className="t-h1">
                De la CUI la oferta depusă, în trei pași.
              </h2>
            </div>
            <div className="steps">
              <div role="tablist" aria-label="Pașii" aria-orientation="vertical" className="only-desk">
                {STEPS.map((s, i) => (
                  <button key={s.title} className={`step ${step === i ? "sel" : ""}`} role="tab" aria-selected={step === i} onClick={() => setStep(i)}>
                    <span className="step-n m">{i + 1}</span>
                    <span>
                      <span className="t-h3" style={{ display: "block" }}>
                        {s.title}
                      </span>
                      <p>{s.text}</p>
                    </span>
                  </button>
                ))}
              </div>
              <div className="only-mob">
                <div className="seg" role="tablist" aria-label="Pașii">
                  {["Profil", "Alerte", "Documente"].map((label, i) => (
                    <button key={label} className={step === i ? "sel" : ""} role="tab" aria-selected={step === i} onClick={() => setStep(i)}>
                      <span className="m">{i + 1}</span>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="step-mob-text" style={{ marginTop: 18 }}>
                  <h3 className="t-h3">{STEPS[step].title}</h3>
                  <p>{STEPS[step].text}</p>
                </div>
              </div>
              <div className="pv" role="tabpanel" aria-label={STEPS[step].title}>
                {step === 0 && (
                  <div className="fade">
                    <div className="pv-head">
                      Profilul firmei<span className="demo-ex">Exemplu</span>
                    </div>
                    <div className="pv-body">
                      <div className="chips" aria-label="Filtre din profil">
                        {[
                          ["Domeniu", "Construcții & infrastructură"],
                          ["CPV", "45212300-9 +2"],
                          ["Județe", "Iași, Neamț, Suceava"],
                          ["Valoare", "peste 1.000.000 lei"],
                        ].map(([k, v]) => (
                          <span className="chip" key={k}>
                            <span className="k">{k}:</span>
                            <span className="v">{v}</span>
                          </span>
                        ))}
                      </div>
                      <div className="pv-result" aria-live="polite">
                        {stats?.open_procedures != null ? (
                          <>
                            <span className="m">{n(stats.open_procedures)}</span>
                            <span className="muted t-small">proceduri deschise acum în registru; filtrele le restrâng la ale dvs.</span>
                          </>
                        ) : (
                          <span className="muted t-small">Filtrele restrâng registrul la licitațiile firmei dvs.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {step === 1 && (
                  <div className="fade">
                    <div className="pv-head">
                      Alertă pe email<span className="demo-ex">{tender ? "Licitație reală" : "Exemplu"}</span>
                    </div>
                    <div>
                      <div className="arow" style={{ cursor: "default" }}>
                        <span>
                          <span className="arow-t" style={{ display: "block" }}>
                            {tender?.title ?? "Licitație nouă din profilul dvs."}
                          </span>
                          <span className="arow-s" style={{ display: "block" }}>
                            {tender ? `${tender.authority} · ${tender.county}` : "Autoritate · județ"}
                          </span>
                        </span>
                        <span className="arow-r">
                          <span className="m" style={{ display: "block" }}>
                            {tender ? `${formatLei(Math.round(tender.estimated_value_ron))} lei` : "—"}
                          </span>
                          <span className="arow-s m" style={{ display: "block" }}>
                            {(() => {
                              const d = daysUntil(tender?.deadline);
                              return d === null ? "" : d > 0 ? `în ${d} z` : "expirat";
                            })()}
                          </span>
                        </span>
                        <span className="arow-why">
                          <span>
                            <Check size={13} />
                            CPV {tender?.cpv ?? ""} din profilul firmei
                          </span>
                          <span>
                            <Check size={13} />
                            Județul {tender?.county ?? ""}, din profil
                          </span>
                          <span>
                            <Check size={13} />
                            Valoarea peste pragul dvs. minim
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div className="fade">
                    <div className="pv-head">
                      Documentele ofertei<span className="demo-ex">Generate de RO-INTEL</span>
                    </div>
                    <div className="pv-body">
                      <ul className="plan-f" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                        {[
                          "Propunere tehnică cu matricea de conformitate",
                          "Cele 7 declarații: mediu și social, conflict de interese, confidențialitate, excludere, art. 5k (sancțiuni UE), beneficiar real, DNSH",
                          "Solicitare de clarificări, art. 160 Legea 98/2016",
                          "Justificarea prețului, art. 210 și art. 136 HG 395/2016",
                          "Cerere de informații publice, Legea 544/2001",
                        ].map((f) => (
                          <li key={f}>
                            <Check size={16} w={2.2} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button className="btn btn-s btn-sm" style={{ marginTop: 16 }} onClick={() => scrollTo("dosar")}>
                        Vezi un dosar real generat
                        <Arrow size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="after-cta">
              <button className="btn btn-p btn-lg" onClick={goSignup}>
                Creează cont gratuit
                <Arrow />
              </button>
              <p className="micro">Setați profilul în 2 minute. Fără card.</p>
            </div>
          </div>
        </section>

        {/* 4. PROOF */}
        <section className="sec" id="dovezi" aria-labelledby="h-proof">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Dovezi verificabile</p>
              <h2 id="h-proof" className="t-h1">
                Cifre live din registru și un dosar real, nu promisiuni.
              </h2>
            </div>
            {counters.length > 0 && (
              <div className="grid4" aria-label="Cifre live din baza de date">
                {counters.map((c) => (
                  <div className="stat" key={c.l}>
                    <span className="m">{c.v}</span>
                    <p>{c.l}</p>
                    <span className="src">Sursa: {c.src}</span>
                  </div>
                ))}
              </div>
            )}
            {synced && (
              <p className="micro" style={{ marginTop: 10 }}>
                <span>
                  <span className="live" aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--ok)", display: "inline-block" }} />
                  Ultima sincronizare a registrului: {synced}
                </span>
              </p>
            )}

            <div className="proof-grid" id="dosar">
              <div>
                <h3 className="t-h3" style={{ marginBottom: 10 }}>
                  Vezi un dosar real generat
                </h3>
                <DossierViewer sample={sample} />
              </div>
              <div>
                <div className="founder">
                  <div>
                    <p className="seats">Programul Parteneri Fondatori · 10 locuri</p>
                    <h3 className="t-h3">14 zile de Ofertant Complet Pro, gratuit, pentru firmele care licitează activ în SEAP.</h3>
                    <p>În schimb vă cerem feedback direct: ce v-a ajutat, ce lipsește, ce ați schimba. Partenerii fondatori păstrează tariful anual Fondator.</p>
                  </div>
                  <a className="btn btn-p" href="mailto:cloudpxlsupport@gmail.com?subject=Program%20Parteneri%20Fondatori%20RO-INTEL">
                    Aplică pentru un loc
                  </a>
                </div>
                <ul className="attrib" aria-label="Despre RO-INTEL">
                  <li>
                    <span>
                      <Check />
                      Dezvoltat în Iași, România
                    </span>
                  </li>
                  <li>
                    <span>
                      <Check />
                      Conectat la SEAP, ANAF, ANAP și portalul legislativ
                    </span>
                  </li>
                  <li>
                    <span>
                      <Check />0 antrenare AI pe datele clientului
                    </span>
                  </li>
                </ul>
                <div className="card trust-card">
                  <span className="trust-ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="t-h3">Nicio cifră ghicită.</h3>
                    <p>
                      Fiecare clauză marcată în caiet are citatul exact. Fiecare document citează articolul din textul consolidat al legii. Dacă o sursă nu răspunde, afișăm zero — nu o estimare.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. COMPARISON */}
        <section className="sec" id="comparatie" aria-labelledby="h-cmp">
          <div className="wrap">
            <div className="sec-head">
              <p className="kicker">Comparație</p>
              <h2 id="h-cmp" className="t-h1">
                Comparat cu ce faceți azi.
              </h2>
            </div>
            <table className="cmp only-desk">
              <caption className="sr">Comparație între RO-INTEL, agregatoarele clasice de alerte și consultanța clasică</caption>
              <thead>
                <tr>
                  <th scope="col">Ce aveți nevoie</th>
                  <th scope="col" className="us">
                    RO-INTEL (≈ 50 sec)
                  </th>
                  <th scope="col">Agregatoare clasice de alerte</th>
                  <th scope="col">Consultanță clasică</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.need}>
                    <th scope="row">{r.need}</th>
                    <td className="us">
                      <span className="cell">
                        <span className="yes">
                          <Check w={2.6} />
                        </span>
                        {r.us}
                      </span>
                    </td>
                    <td>
                      <span className="cell">
                        {r.aggNo && <Dash />}
                        {r.agg}
                      </span>
                    </td>
                    <td>
                      <span className="cell">{r.cons}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="only-mob">
              {COMPARE.map((r) => (
                <article className="cmp-card" key={r.need}>
                  <h3>{r.need}</h3>
                  <div className="cmp-line us">
                    <span>RO-INTEL</span>
                    <span>{r.us}</span>
                  </div>
                  <div className="cmp-line">
                    <span>Agregatoare</span>
                    <span>{r.agg}</span>
                  </div>
                  <div className="cmp-line">
                    <span>Consultanță</span>
                    <span>{r.cons}</span>
                  </div>
                </article>
              ))}
            </div>
            <p className="micro" style={{ marginTop: 12 }}>
              Costurile și termenele consultanței sunt tarife uzuale de piață pentru un dosar de ofertă; variază după complexitate.
            </p>
          </div>
        </section>

        {/* 6. PRICING */}
        <section className="sec" id="preturi" aria-labelledby="h-price">
          <div className="wrap">
            <div className="price-top">
              <div className="sec-head">
                <p className="kicker">Prețuri</p>
                <h2 id="h-price" className="t-h1">
                  Prețuri clare. Începeți gratuit.
                </h2>
                <p className="lead">Fără contract pe termen lung. Treceți la un plan plătit doar când vă convine.</p>
              </div>
              <div className="toggle" role="group" aria-label="Perioada de facturare">
                <button className={annual ? "" : "sel"} aria-pressed={!annual} onClick={() => setAnnual(false)}>
                  Lunar
                </button>
                <button className={annual ? "sel" : ""} aria-pressed={annual} onClick={() => setAnnual(true)}>
                  Anual<span className="save">până la 33% mai ieftin</span>
                </button>
              </div>
            </div>
            <div className="grid3">
              {PLANS.map((p: PlanInfo) => {
                const free = p.monthly === 0;
                const featured = p.id === "plan_founder_vip";
                return (
                  <article className={`plan ${featured ? "feat" : ""}`} key={p.id} aria-label={p.name}>
                    <span className={`plan-badge ${featured ? "" : "q"}`}>{p.badge || (free ? "Pentru început" : "Echipă de ofertare")}</span>
                    <h3 className="t-h3">{p.name}</h3>
                    <p className="plan-d">{p.pitch}</p>
                    <p className="plan-price">
                      <span className="m">{free ? "0" : formatLei(annual ? p.annual : p.monthly)}</span>
                      <span>{free ? "lei, pentru totdeauna" : annual ? "lei / an" : "lei / lună"}</span>
                    </p>
                    <p className="plan-bill">
                      {free
                        ? "Fără card."
                        : annual
                          ? `≈ ${formatLei(Math.round(p.annual / 12))} lei / lună${p.annualNote ? " · " + p.annualNote : ""}`
                          : `Facturat lunar. Anual: ${formatLei(p.annual)} lei${p.annualNote ? " (" + p.annualNote + ")" : ""}.`}
                    </p>
                    <button
                      className={`btn ${free || featured ? "btn-p" : "btn-s"} btn-block`}
                      onClick={() => {
                        setPlanIntent(free ? null : p.name);
                        goSignup();
                      }}
                    >
                      {free ? "Creează cont gratuit" : "Începeți gratuit, treceți oricând"}
                    </button>
                    <ul className="plan-f">
                      {p.features.map((f) => (
                        <li key={f}>
                          <Check size={16} w={2.2} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
            <ul className="assure" aria-label="Garanții">
              {PRICE_REASSURANCE.map((a) => (
                <li key={a}>
                  <Check size={16} w={2.2} />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 7. FINAL CTA */}
        <section className="final on-ink" id="start" aria-labelledby="h-final">
          <div className="wrap final-grid">
            <div>
              <h2 id="h-final" className="t-h1">
                Vedeți licitațiile potrivite firmei dvs. în 2 minute.
              </h2>
              <p className="lead">Introduceți emailul de serviciu. Primiți un link de autentificare, adăugați CUI-ul, iar registrul se filtrează singur.</p>
            </div>
            <SignupForm id="final-email" dark planNote={planIntent ? `Plan ales: ${planIntent}. Începeți gratuit; îl activați din cont, când vreți.` : null} />
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="sec" id="intrebari" aria-labelledby="h-faq" style={{ borderTop: 0 }}>
          <div className="wrap faq-grid">
            <div>
              <p className="kicker">Întrebări</p>
              <h2 id="h-faq" className="t-h1">
                Întrebări frecvente
              </h2>
              <p className="muted" style={{ marginTop: 14 }}>
                Altă întrebare?{" "}
                <Link className="link" style={{ padding: "2px 0", textDecoration: "underline", fontSize: "inherit" }} href="/suport">
                  Scrieți-ne din pagina Suport
                </Link>
                .
              </p>
            </div>
            <div className="faq">
              {FAQ.map((f, i) => (
                <div className="faq-item" key={f.q}>
                  <h3>
                    <button className="faq-q" aria-expanded={faqOpen === i} aria-controls={`faq-a-${i}`} onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                      {f.q}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                  </h3>
                  {faqOpen === i && (
                    <div className="faq-a fade" id={`faq-a-${i}`} role="region">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="ftr">
        <div className="wrap ftr-in">
          <span className="brand">
            <span className="mark">R</span>
            <span>RO-INTEL</span>
          </span>
          <nav className="ftr-links" aria-label="Legal și contact">
            <Link className="link" href="/terms">
              Termeni
            </Link>
            <Link className="link" href="/privacy">
              Confidențialitate
            </Link>
            <Link className="link" href="/suport">
              Suport
            </Link>
            <Link className="link" href="/login">
              Autentificare
            </Link>
          </nav>
          <p className="ftr-copy">
            © {new Date().getFullYear()} RO-INTEL · Dezvoltat în Iași, România · Date publice din SEAP/SICAP, TED și registre oficiale. RO-INTEL nu este afiliat ANAP sau ADR.
          </p>
        </div>
      </footer>

      <div className="dock">
        {showBar && (
          <div className="mbar">
            <button className="btn btn-p btn-block" onClick={goSignup}>
              Creează cont gratuit
            </button>
            <p>Gratuit · fără card · 2 minute</p>
          </div>
        )}
      </div>
    </div>
  );
}
