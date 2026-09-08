"use client";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, Mail, Wrench } from "lucide-react";
import { ApiError, askSupportBot, type CopilotTurn } from "@/lib/api";
import { Button, Eyebrow, Input, PageHeader, Panel, SectionTitle } from "@/components/newsprint";

const SUPPORT_EMAIL = "cloudpxlsupport@gmail.com";

/* -------------------------------------------------------------------- FAQ */

type FaqBlock =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: { label?: string; text: string }[] };

interface FaqItem {
  question: string;
  blocks: FaqBlock[];
}

const FAQS: FaqItem[] = [
  {
    question: "Cum detectează RO-INTEL proiectele de achiziții înainte de publicarea în SEAP/SICAP?",
    blocks: [
      {
        kind: "p",
        text:
          "RO-INTEL monitorizează continuu 26 de surse instituționale primare: Hotărârile de Consiliu Local (HCL) și Județean privind aprobarea indicatorilor tehnico-economici, consultările de piață active din SEAP (MC), Planurile Anuale de Achiziții Publice (PAAP), bazele de date de investiții CNI, CNAIR, CFR și apelurile europene din TED/JOUE. Proiectele sunt detectate în stadiul de studiu de fezabilitate sau avizare bugetară, cu săptămâni sau luni înainte de lansarea procedurii de licitație deschisă (CN) sau simplificată (SC).",
      },
    ],
  },
  {
    question: "Ce reprezintă Scorul de Oportunitate (0–10) și cum este determinat?",
    blocks: [
      {
        kind: "p",
        text:
          "Scorul este calculat deterministic de motorul `ai_refinery` pe baza dovezilor extrase direct din sursa oficială:",
      },
      {
        kind: "ul",
        items: [
          {
            label: "Stadiul procedurii:",
            text:
              "Aprobările de indicatori tehnico-economici și consultările prealabile primesc cel mai mare punctaj (+1.6), deoarece caietul de sarcini poate fi încă influențat legal; procedurile deja atribuite sau anulate sunt penalizate automat (-1.0).",
          },
          { label: "Valoarea estimată:", text: "Contractele de anvergură (>100M RON) primesc până la +2.0 puncte." },
          { label: "Urgența:", text: "Termenele de consultare sau depunere sub 7 zile adaugă până la +1.5 puncte." },
        ],
      },
      {
        kind: "p",
        text: "Sistemul nu folosește scoruri artificiale: fără dovezi concrete în text, scorul rămâne la un nivel de bază neutru.",
      },
    ],
  },
  {
    question: "Cum funcționează „Soft Filter”-ul și de ce văd proiecte din afara criteriilor mele?",
    blocks: [
      {
        kind: "p",
        text:
          "Algoritmul nostru sortează piața printr-o ierarhizare strictă în SQL (`ORDER BY is_match DESC, relevance DESC`). Toate oportunitățile care se potrivesc cu domeniul dvs., județele selectate și cuvintele-cheie declarate sunt plasate la începutul fluxului, marcate cu o insignă vizuală distinctă („Potrivire”) și justificarea exactă a potrivirii. Sub acestea, aveți acces complet la restul pieței naționale, prevenind blocajele artificiale și asigurându-vă că nu ratați contracte mari interdisciplinare.",
      },
    ],
  },
  {
    question: "Cum depistează scannerul de Caiet de Sarcini clauzele restrictive sau abuzive?",
    blocks: [
      {
        kind: "p",
        text:
          "Modulul `caiet_analyzer` aplică o suită de filtre euristice și juridice bazate pe jurisprudența Consiliului Național de Soluționare a Contestațiilor (CNSC):",
      },
      {
        kind: "ul",
        items: [
          {
            text:
              "Identifică cerințe de cifră de afaceri disproporționate ce depășesc plafonul legal de 2× valoarea estimată (Art. 175 alin. 2 din Legea 98/2016).",
          },
          {
            text:
              "Semnalează blocajele de marcă (brand lock-in) sau specificațiile tehnice restrictive care omit sintagma obligatorie „sau echivalent” (Art. 156 alin. 3).",
          },
          {
            text: "Evidențiază termene de depunere nejustificat de scurte sau cerințe disproporționate de certificări ISO și personal cheie.",
          },
        ],
      },
    ],
  },
  {
    question: "Ce documente pot genera automat și care este baza lor legală?",
    blocks: [
      { kind: "p", text: "RO-INTEL generează direct documente `.docx` gata de semnare:" },
      {
        kind: "ul",
        items: [
          {
            label: "Propuneri Tehnice Structurate:",
            text:
              "Întocmite în conformitate cu Legea 98/2016, incluzând metodologie de execuție, grafic de activități, matrice de riscuri și plan de asigurare a calității.",
          },
          {
            label: "Solicitări de Clarificări & L544:",
            text:
              "Adrese oficiale pentru solicitarea de clarificări tehnice la autorități contractante și cereri de acces la informații de interes public în baza Legii 544/2001.",
          },
        ],
      },
    ],
  },
  {
    question: "Cum funcționează verificarea eligibilității și a scenariilor de participare (Lider / Terț / Subcontractant)?",
    blocks: [
      {
        kind: "p",
        text:
          "Interogăm în timp real baza de date fiscală ANAF pe baza CUI-ului introdus, verificând starea de înregistrare, regimul TVA și bilanțul financiar. Modulul de calificare simulează automat conformitatea companiei pentru proceduri de orice valoare și calculează necesarul de susținere prin terț susținător financiar (Art. 182) sau asociere/subcontractare (Art. 172) pentru a acoperi cerințele de capacitate tehnică și cifră de afaceri.",
      },
    ],
  },
  {
    question: "De ce unele dosare au valoare estimată „0 RON” sau „Nepublicată”?",
    blocks: [
      {
        kind: "p",
        text:
          "Politica RO-INTEL este de zero date fabricate. Dacă o primărie, un consiliu județean sau un anunț de consultare nu publică o estimare financiară precisă în documentul sursă, sistemul afișează valoarea ca „Nepublicată” (0.0 RON) și marchează acest lucru explicit. Nu aproximăm și nu inventăm niciodată bugete pe care autoritatea contractantă nu le-a aprobat oficial.",
      },
    ],
  },
  {
    question: "Cum configurez alerte instantanee prin Telegram și Email?",
    blocks: [
      {
        kind: "p",
        text:
          "În meniul de setări de profil (`Bara laterală -> Setări cont` sau direct în onboarding), puteți seta pragul minim de relevanță (`min_alert_score`, implicit 7.5/10), adresa de email pentru notificări și ID-ul numeric de chat Telegram. Când un scraper detectează o oportunitate nouă ce corespunde criteriilor dvs. și trece pragul de alertă, notificarea este trimisă în timp real.",
      },
    ],
  },
  {
    question: "Ce înseamnă eticheta „Potrivire SEAP: posibilă” la dosarele din Jurnalul European (TED)?",
    blocks: [
      {
        kind: "p",
        text:
          "Pentru contractele internaționale de mare valoare publicate în Jurnalul Oficial al UE (TED), motorul rulează un algoritm de corelare probabilistică bazat pe prefixul codului CPV, toleranța de buget (±10%) și denumirea autorității contractante pentru a identifica dacă procedura are deja corespondent în sistemul național SEAP/SICAP. Eticheta indică o potrivire probabilă cu grad ridicat de certitudine, dar care nu constituie o identitate 1:1 verificată până la confirmarea procedurii naționale.",
      },
    ],
  },
  {
    question: "Cum solicit un plan Enterprise, acoperire pe comune/orașe specifice sau suport pentru consorții?",
    blocks: [
      {
        kind: "p",
        text:
          `Pentru companii cu volume mari de ofertare, furnizăm planuri Enterprise dedicate: lărgirea frecvenței de scraping la cerere, construirea de adaptoare personalizate pentru UAT-uri de interes specific, acces la webhook-uri și asistență strategică la ofertare. Contactați direct echipa tehnică la \`${SUPPORT_EMAIL}\` sau discutați mai jos cu Consilierul Strategic RO-INTEL.`,
      },
    ],
  },
];

/** Splits on `` `code` `` and **bold** spans and returns styled inline nodes. */
function renderInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded-md bg-stock-200 px-1.5 py-0.5 font-mono text-[12px] text-ink">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function FaqAnswer({ blocks, faqId }: { blocks: FaqBlock[]; faqId: number }) {
  return (
    <div className="font-body space-y-3 text-sm leading-relaxed text-stock-600">
      {blocks.map((block, i) =>
        block.kind === "p" ? (
          <p key={i}>{renderInline(block.text, `faq-${faqId}-p-${i}`)}</p>
        ) : (
          <ul key={i} className="space-y-2 pl-1">
            {block.items.map((item, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-editorial" />
                <span>
                  {item.label && <strong className="font-semibold text-ink">{item.label} </strong>}
                  {renderInline(item.text, `faq-${faqId}-li-${j}`)}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2.5">
      {FAQS.map((faq, i) => {
        const open = openIndex === i;
        return (
          <div key={i} className={open ? "neu-pressed rounded-2xl bg-paper" : "neu-flat-sm rounded-2xl bg-paper"}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="font-display text-[15px] font-semibold leading-snug text-ink">{faq.question}</span>
              <ChevronDown
                size={18}
                className={
                  "shrink-0 text-stock-500 transition-transform duration-[var(--duration-base)] ease-[var(--ease-glide)] " +
                  (open ? "rotate-180" : "")
                }
              />
            </button>
            {open && (
              <div className="border-t border-divider px-4 pb-4 pt-3">
                <FaqAnswer blocks={faq.blocks} faqId={i} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- support chat */

function SupportChat() {
  const [messages, setMessages] = useState<{ sender: "user" | "ai"; text: string; degraded?: boolean }[]>([
    {
      sender: "ai",
      text:
        "Bună ziua. Sunt consilierul strategic RO-INTEL. Vă pot ajuta cu întrebări despre achiziții publice, funcționarea platformei sau planurile Enterprise. Cu ce vă pot fi de folos?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;
    setInput("");
    const history: CopilotTurn[] = messages
      .slice(1)
      .map((m) => ({ role: m.sender === "user" ? ("user" as const) : ("assistant" as const), content: m.text }));
    setMessages((prev) => [...prev, { sender: "user", text: question }]);
    setLoading(true);
    try {
      const data = await askSupportBot(question, history);
      setMessages((prev) => [...prev, { sender: "ai", text: data.reply, degraded: data.degraded }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: e instanceof ApiError ? e.detail : `Consilierul nu a putut răspunde. Scrieți-ne la ${SUPPORT_EMAIL}.`,
          degraded: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="flex h-[60vh] min-h-[26rem] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={"flex " + (m.sender === "user" ? "justify-end" : "justify-start")}>
            <div
              className={
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 font-body text-sm leading-relaxed " +
                (m.sender === "user"
                  ? "neu-flat-sm bg-editorial text-white"
                  : m.degraded
                    ? "neu-pressed border-l-[3px] border-warning bg-paper"
                    : "neu-flat-sm bg-paper")
              }
            >
              {m.sender === "ai" && (
                <span className="label-eyebrow mb-1 block text-stock-500">
                  {m.degraded ? "Răspuns indisponibil" : "Consilier Strategic"}
                </span>
              )}
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span className="h-2 w-2 animate-pulse rounded-full bg-editorial" aria-hidden="true" />
            <span className="label-eyebrow text-stock-500">Consilierul redactează răspunsul…</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-divider p-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Întrebați despre legislație, scor de oportunitate sau planuri Enterprise…"
          aria-label="Întrebare pentru consilierul strategic"
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          Trimite
        </Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------- contact */

function ContactCard() {
  return (
    <Panel className="p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="flex items-start gap-3">
          <span className="neu-flat-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-editorial-soft text-editorial">
            <Mail size={18} />
          </span>
          <div>
            <Eyebrow className="text-stock-500">Email principal</Eyebrow>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-1 block break-all font-display text-[15px] font-bold text-ink hover:text-editorial"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="neu-flat-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-editorial-soft text-editorial">
            <Clock size={18} />
          </span>
          <div>
            <Eyebrow className="text-stock-500">Program asistență</Eyebrow>
            <p className="mt-1 font-body text-sm leading-relaxed text-ink">Luni – Vineri, 08:30 – 18:00</p>
            <p className="font-body text-[13px] leading-relaxed text-stock-500">
              Răspuns garantat sub 2 ore pentru conturile active.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="neu-flat-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-editorial-soft text-editorial">
            <Wrench size={18} />
          </span>
          <div>
            <Eyebrow className="text-stock-500">Servicii dedicate</Eyebrow>
            <ul className="mt-1 space-y-1 font-body text-[13px] leading-relaxed text-ink">
              <li>Configurare scraper-e dedicate pe UAT-uri/județe specifice</li>
              <li>Integrări API/ERP personalizate</li>
              <li>Onboarding pentru consorții de ofertare</li>
              <li>Solicitări proforme/facturare</li>
            </ul>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- page */

export default function SupportPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 py-8 sm:py-10">
      <PageHeader
        eyebrow="Asistență RO-INTEL"
        title="Suport & Consiliere Strategică"
        standfirst="Răspunsuri la cele mai frecvente întrebări despre platformă și legislația achizițiilor publice, un consilier strategic disponibil non-stop și o linie directă către echipa tehnică."
      />

      <section className="mb-10">
        <ContactCard />
      </section>

      <section className="mb-10">
        <SectionTitle note={`${FAQS.length} întrebări`}>FAQ Interactiv</SectionTitle>
        <FaqAccordion />
      </section>

      <section>
        <SectionTitle>Consilier Strategic RO-INTEL</SectionTitle>
        <SupportChat />
      </section>
    </div>
  );
}
