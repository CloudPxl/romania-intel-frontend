"use client";
import { useState } from "react";
import { X } from "lucide-react";
import type { ComplianceRow, DocumentSection, LegalIssue, LegalMetadata, StatutoryCitation } from "@/lib/api";
import { Badge, Button, Eyebrow, Notice } from "@/components/newsprint";
import { formatNumber } from "@/lib/format";

// Matches --duration-base in globals.css — same exit timing as
// LeadDossierPanel, whose slide-over this mirrors.
const CLOSE_ANIMATION_MS = 320;

const ACTION_BUTTON = "bg-[#006494] text-white hover:text-white";

function SectionTable({ table }: { table: NonNullable<DocumentSection["table"]> }) {
  return (
    <div className="scroll-x mt-3">
      {table.caption && <Eyebrow className="mb-1.5">{table.caption}</Eyebrow>}
      <table className="w-full min-w-[28rem] neu-pressed overflow-hidden rounded-2xl bg-paper text-left font-body text-xs">
        <thead>
          <tr className="border-b border-divider">
            {table.columns.map((c) => (
              <th key={c} className="px-3 py-2 font-sans text-[10px] font-semibold uppercase tracking-widest text-stock-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-divider align-top last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ section }: { section: DocumentSection }) {
  return (
    <section className="border-b border-divider py-4 last:border-b-0">
      {section.heading && (
        <h3 className="font-display flex items-center gap-2 text-sm font-semibold leading-snug">
          {section.heading}
          {section.ai_expanded && <Badge tone="accent">AI</Badge>}
        </h3>
      )}
      <div className="mt-1.5 space-y-1.5">
        {section.paragraphs.filter(Boolean).map((p, i) => (
          <p key={i} className="font-body whitespace-pre-wrap text-sm leading-relaxed text-stock-600">
            {p}
          </p>
        ))}
      </div>
      {section.table && <SectionTable table={section.table} />}
    </section>
  );
}

/**
 * Slide-over preview of a generated document — structured sections,
 * conformity matrix, declarations and the statutory basis — before the
 * .docx is downloaded. Counsel notes are shown apart from the document
 * itself: they are what the bidder must know (the challenge clock, the
 * cauțiune) and must not send to the authority.
 */
export default function DocumentPreviewPanel({
  eyebrow,
  title,
  subtitle,
  sections,
  complianceRows,
  declarations,
  legalBasis,
  counselNotes,
  legalMetadata,
  disclaimer,
  plainText,
  aiNotice,
  legalIssues,
  onExport,
  onClose,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  sections: DocumentSection[];
  complianceRows?: ComplianceRow[];
  declarations?: DocumentSection[];
  legalBasis?: StatutoryCitation[];
  counselNotes?: string[];
  legalMetadata?: LegalMetadata;
  disclaimer?: string;
  plainText: string;
  /** Why an AI pass that was asked for did not happen (a credit or budget limit). */
  aiNotice?: string | null;
  /** Citations the post-check found missing or repealed in the AI text. */
  legalIssues?: LegalIssue[];
  onExport: () => Promise<void>;
  onClose: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_ANIMATION_MS);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopyState("copied");
    } catch {
      // Denied outside a secure context and in some embedded webviews —
      // say so rather than showing a false "Copiat".
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2500);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      await onExport();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Exportul .docx a eșuat.");
    } finally {
      setExporting(false);
    }
  };

  const caietRows = complianceRows?.filter((r) => r.source === "caiet") ?? [];
  const otherRows = complianceRows?.filter((r) => r.source !== "caiet") ?? [];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={
          "absolute inset-0 bg-ink/50 backdrop-blur-sm " +
          (closing
            ? "animate-[fade-out_var(--duration-base)_var(--ease-glide)_both]"
            : "animate-[fade-in_var(--duration-base)_var(--ease-glide)_both]")
        }
        onClick={requestClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col bg-paper " +
          (closing
            ? "animate-[slide-over-right-out_var(--duration-base)_var(--ease-glide)_both]"
            : "animate-[slide-over-right_var(--duration-base)_var(--ease-glide)_both]")
        }
      >
        <div className="z-10 border-b border-divider bg-paper/95 p-4 backdrop-blur sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Eyebrow className="text-editorial">{eyebrow}</Eyebrow>
              <h2 className="font-display mt-2 text-xl font-semibold leading-tight tracking-tight">{title}</h2>
              {subtitle && <p className="font-body mt-1 text-sm text-stock-600">{subtitle}</p>}
            </div>
            <button
              onClick={requestClose}
              aria-label="Închide previzualizarea"
              className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-stock-500 transition-all duration-300 hover:neu-pressed-sm hover:text-ink"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button className={ACTION_BUTTON} onClick={handleExport} disabled={exporting}>
              {exporting ? "Se exportă…" : "Exportă .docx oficial"}
            </Button>
            <Button variant="outline" onClick={handleCopy}>
              {copyState === "copied" ? "Copiat" : copyState === "failed" ? "Copierea a eșuat" : "Copiază text"}
            </Button>
          </div>
          {exportError && (
            <div className="mt-3">
              <Notice tone="alert">{exportError}</Notice>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {legalMetadata?.procedure_name && (
            <div className="neu-pressed mb-5 flex flex-wrap gap-x-5 gap-y-1 rounded-2xl bg-paper px-4 py-3 font-mono text-[11px] text-stock-600">
              <span>{legalMetadata.applicable_law} · {legalMetadata.procedure_name}</span>
              <span>CNSC: {legalMetadata.cnsc_deadline_days} zile</span>
              {legalMetadata.cnsc_cautiune_ron != null && <span>Cauțiune: {formatNumber(legalMetadata.cnsc_cautiune_ron)} lei</span>}
            </div>
          )}

          {aiNotice && (
            <div className="mb-5">
              <Notice tone="warning" title="Fără extindere AI">
                {aiNotice}
              </Notice>
            </div>
          )}
          {legalIssues && legalIssues.length > 0 && (
            <div className="mb-5">
              <Notice tone="alert" title="Verificare automată a citărilor">
                Textul generat cu AI trimite la: {legalIssues.map((i) => i.message).join("; ")}. Corectați înainte de
                utilizare — restul documentului folosește doar texte legale verificate.
              </Notice>
            </div>
          )}

          {counselNotes && counselNotes.length > 0 && (
            <div className="mb-5 neu-pressed rounded-r-lg border-l-2 border-warning bg-paper px-4 py-3">
              <Eyebrow className="text-warning">De știut — nu se transmite autorității</Eyebrow>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {counselNotes.map((n) => (
                  <li key={n} className="font-body text-xs leading-relaxed text-stock-600">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            {sections.map((s, i) => (
              <Section key={i} section={s} />
            ))}
          </div>

          {caietRows.length > 0 && (
            <div className="mt-5">
              <Eyebrow className="mb-1.5">Tabel de corespondență caiet de sarcini → propunere tehnică</Eyebrow>
              <SectionTable
                table={{
                  columns: ["Cerință", "Mod de îndeplinire", "Referință"],
                  rows: caietRows.map((r) => [r.requirement, r.response, r.reference]),
                }}
              />
            </div>
          )}
          {otherRows.length > 0 && (
            <div className="mt-5">
              <Eyebrow className="mb-1.5">Matricea de conformitate — calificare</Eyebrow>
              <SectionTable
                table={{
                  columns: ["Cerință", "Răspuns", "Referință"],
                  rows: otherRows.map((r) => [r.requirement, r.response, r.reference]),
                }}
              />
            </div>
          )}

          {declarations && declarations.length > 0 && (
            <div className="mt-6">
              <Eyebrow className="mb-1">Declarații anexate · fiecare pe pagină separată în .docx</Eyebrow>
              {declarations.map((d, i) => (
                <details key={i} className="neu-flat-sm mt-2 rounded-2xl bg-paper px-4 py-2">
                  <summary className="cursor-pointer py-1.5 font-display text-sm font-semibold">{d.heading}</summary>
                  <Section section={{ ...d, heading: undefined }} />
                </details>
              ))}
            </div>
          )}

          {legalBasis && legalBasis.length > 0 && (
            <div className="mt-6">
              <Eyebrow className="mb-1">Temei legal citat · text consolidat legislatie.just.ro</Eyebrow>
              {legalBasis.map((c) => (
                <details key={c.key} className="border-b border-divider py-2 last:border-b-0">
                  <summary className="cursor-pointer font-mono text-[11px] text-stock-600">{c.citation}</summary>
                  <p className="font-body mt-1.5 text-xs leading-relaxed text-stock-500">„{c.text}”</p>
                  <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="font-mono mt-1 inline-block text-[10px] text-editorial">
                    Sursa oficială →
                  </a>
                </details>
              ))}
            </div>
          )}

          {disclaimer && <p className="font-mono mt-6 text-[11px] leading-relaxed text-stock-500">{disclaimer}</p>}
        </div>
      </div>
    </div>
  );
}
