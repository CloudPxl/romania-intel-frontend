"use client";
import React from "react";
import Link from "next/link";
import type { MarketTrends } from "@/lib/api";
import { formatRon } from "@/lib/format";
import { ButtonLink, Eyebrow, Panel, SectionTitle } from "@/components/newsprint";

/**
 * The county/category/funding-source/top-opportunities breakdown, shared by
 * `/analysis` (the whole market, every row, full detail) and Prima Pagina's
 * personalized view (a trimmed slice of the same shape, scoped to one
 * user's own matches). One component so the two cannot drift the way two
 * hand-copied implementations eventually do — this codebase already hit
 * that exact bug once with a duplicated domain list.
 *
 * Every row is a real link to Căutare Avansată, pre-filtered to that row's
 * value — clicking "Hunedoara" here is the start of a search, not a dead
 * end. The hover treatment (`hover:neu-pressed-sm` + a trailing arrow)
 * deliberately mirrors Căutare Avansată's own lead-list rows rather than a
 * card-lift: these are rows in a divided list, not cards in a grid, and the
 * "whole row presses in on hover" cue is the one this app already uses for
 * "this row opens something."
 */

function RowLink({
  href,
  label,
  count,
  value,
  maxValue,
}: {
  href: string;
  label: string;
  count: number;
  value: number;
  maxValue: number;
}) {
  const pct = maxValue > 0 ? Math.max(2, Math.round((value / maxValue) * 100)) : 0;
  return (
    <Link
      href={href}
      className="group -mx-2 flex flex-col gap-1.5 rounded-xl px-2 py-3 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-pressed-sm active:scale-[0.99]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-body flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{label}</span>
          <span
            aria-hidden="true"
            className="shrink-0 text-editorial opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            →
          </span>
        </span>
        <span className="tabular font-mono shrink-0 text-[11px] text-stock-500">
          {count} · {formatRon(value)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stock-200">
        <div className="h-full rounded-full bg-editorial" style={{ width: `${pct}%` }} role="presentation" />
      </div>
    </Link>
  );
}

function cautareAvansataHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString();
  return `/cautare-avansata${qs ? `?${qs}` : ""}`;
}

function TopOpportunityRow({
  rank,
  opportunity,
}: {
  rank: number;
  opportunity: MarketTrends["top_opportunities"][number];
}) {
  const content = (
    <>
      <span className="tabular font-mono w-6 shrink-0 pt-0.5 text-sm text-stock-400">
        {String(rank).padStart(2, "0")}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body flex items-center gap-1.5 truncate text-sm font-semibold">
          <span className="truncate">{opportunity.project_title}</span>
          <span
            aria-hidden="true"
            className="shrink-0 text-editorial opacity-0 transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            →
          </span>
        </p>
        <p className="font-mono truncate text-[11px] text-stock-500">
          {opportunity.entity_name} · {opportunity.county}
        </p>
      </div>
      <span className="tabular font-display shrink-0 text-sm font-semibold">
        {formatRon(opportunity.financial_value_ron)}
      </span>
    </>
  );

  // A row with no source_id (shouldn't happen from the current backend, but
  // this component has no control over what a caller hands it) degrades to
  // plain text rather than linking to a broken "?openLead=undefined".
  if (!opportunity.source_id) {
    return <li className="flex gap-4 py-3">{content}</li>;
  }
  return (
    <li>
      <Link
        href={cautareAvansataHref({ openLead: opportunity.source_id })}
        className="group -mx-2 flex gap-4 rounded-xl px-2 py-3 transition-all duration-[var(--duration-base)] ease-[var(--ease-glide)] hover:neu-pressed-sm active:scale-[0.99]"
      >
        {content}
      </Link>
    </li>
  );
}

export default function MarketTrendsView({
  data,
  variant,
}: {
  data: MarketTrends;
  variant: "full" | "compact";
}) {
  const topOpportunities = variant === "full" ? data.top_opportunities : data.top_opportunities.slice(0, 5);
  const maxCategory = Math.max(0, ...data.by_category.map((c) => c.value_ron));
  const maxCounty = Math.max(0, ...data.by_county.map((c) => c.value_ron));
  const maxFunding = Math.max(0, ...data.by_funding_source.map((f) => f.value_ron));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <Panel as="section" className="p-4 sm:p-5">
        <SectionTitle note={`${data.by_category.length} domenii`}>Distribuție pe domeniu</SectionTitle>
        <div>
          {data.by_category.map((c) => (
            <RowLink
              key={c.category}
              href={cautareAvansataHref({ category: c.category })}
              label={c.category}
              count={c.count}
              value={c.value_ron}
              maxValue={maxCategory}
            />
          ))}
        </div>
      </Panel>

      {variant === "full" && (
        <Panel as="section" className="p-4 sm:p-5">
          <SectionTitle note={`${data.by_county.length} județe`}>Județe după valoare</SectionTitle>
          {/* Every county, not a top-10 cut — a small county's single
              project used to be invisible here. Scrollable rather than
              letting 40+ rows stretch the page, mirroring how ChipSelect
              already scrolls a long, complete list elsewhere. */}
          <div className="max-h-[28rem] overflow-y-auto pr-1">
            {data.by_county.map((c) => (
              <RowLink
                key={c.county}
                href={cautareAvansataHref({ county: c.county })}
                label={c.county}
                count={c.count}
                value={c.value_ron}
                maxValue={maxCounty}
              />
            ))}
          </div>
        </Panel>
      )}

      {variant === "full" && (
        <Panel as="section" className="p-4 sm:p-5">
          <SectionTitle note={`${data.by_funding_source.length} surse`}>Surse de finanțare</SectionTitle>
          <div>
            {data.by_funding_source.map((f) => (
              <RowLink
                key={f.funding_source}
                href={cautareAvansataHref({ fundingSource: f.funding_source })}
                label={f.funding_source}
                count={f.count}
                value={f.value_ron}
                maxValue={maxFunding}
              />
            ))}
          </div>
        </Panel>
      )}

      <Panel as="section" className="p-4 sm:p-5">
        <SectionTitle note={data.is_authenticated ? undefined : "restricționat"}>
          Cele mai mari poziții
        </SectionTitle>
        {data.is_authenticated ? (
          topOpportunities.length > 0 ? (
            <ol className="divide-y divide-divider">
              {topOpportunities.map((o, i) => (
                <TopOpportunityRow key={`${o.source_id ?? o.project_title}-${i}`} rank={i + 1} opportunity={o} />
              ))}
            </ol>
          ) : (
            <p className="font-body text-sm text-stock-500">Nicio poziție în această selecție.</p>
          )
        ) : (
          <div className="neu-pressed rounded-3xl p-6">
            <Eyebrow className="text-editorial">Necesită autentificare</Eyebrow>
            <p className="font-body mt-2 text-sm leading-relaxed text-stock-600">
              Cifrele agregate sunt publice. Pozițiile identificate nominal — autoritate, titlu de proiect, valoare —
              sunt vizibile doar conturilor autentificate.
            </p>
            <ButtonLink href="/login" variant="outline" fullWidth className="mt-5">
              Autentificare
            </ButtonLink>
          </div>
        )}
      </Panel>
    </div>
  );
}
