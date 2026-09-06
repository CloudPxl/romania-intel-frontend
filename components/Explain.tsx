"use client";
import { Explainer } from "@/components/newsprint";
import { EXPLAINERS, type ExplainerKey } from "@/lib/explainers";

/**
 * `<Explain k="relevanceScore" />` — the `?` next to anything technical.
 *
 * Keyed rather than free-text so the same concept reads identically on
 * every page it appears on, and so the honest caveats (this is a
 * heuristic; we have no award data; verify the law before relying on it)
 * cannot be dropped on the one screen someone forgets to repeat them.
 */
export default function Explain({ k, className }: { k: ExplainerKey; className?: string }) {
  const entry = EXPLAINERS[k];
  return (
    <Explainer title={entry.title} className={className}>
      {entry.body}
    </Explainer>
  );
}
