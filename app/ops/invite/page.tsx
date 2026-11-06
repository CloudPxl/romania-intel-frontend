"use client";

import ClaimForm from "@/components/ops/ClaimForm";
import { acceptOpsInvitation } from "@/lib/api";

/** Accepts a console invitation. The link carries the token in its
 *  fragment (#t=…), which the browser never sends to a server. */
export default function OpsInvitePage() {
  return (
    <ClaimForm
      kicker="RO-INTEL Operations"
      title="Acceptați invitația"
      intro={<>Ați primit acces la consola de operare RO-INTEL. Dacă tokenul nu apare mai jos, deschideți din nou linkul primit, după ce v-ați autentificat.</>}
      submitLabel="Acceptă invitația"
      claim={acceptOpsInvitation}
      fromFragment
    />
  );
}
