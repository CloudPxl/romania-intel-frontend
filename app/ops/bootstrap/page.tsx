"use client";

import ClaimForm from "@/components/ops/ClaimForm";
import { claimOpsOwner } from "@/lib/api";

/** One-time owner claim. The token comes only from
 *  `scripts/ops_bootstrap.py issue` run on the server. */
export default function OpsBootstrapPage() {
  return (
    <ClaimForm
      kicker="RO-INTEL Operations"
      title="Activare proprietar"
      intro={<>Lipiți tokenul emis pe server de <code className="font-mono text-[13px]">scripts/ops_bootstrap.py issue</code>. Este valabil 30 de minute și o singură dată.</>}
      submitLabel="Activează rolul de proprietar"
      claim={claimOpsOwner}
      fromFragment={false}
    />
  );
}
