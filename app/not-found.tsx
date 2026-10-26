import Link from "next/link";

/**
 * A page that does not exist — usually an old link (a renamed route, a
 * dossier link from an old e-mail) or a typo. Says so, and offers the four
 * places someone arriving here most likely wanted.
 */
export default function NotFound() {
  const exits = [
    { href: "/cautare-avansata", title: "Licitații", text: "Registrul complet, cu filtre și dosarul fiecărei licitații." },
    { href: "/analysis", title: "Analiza pieței", text: "Unde se concentrează bugetul public, pe județe și domenii." },
    { href: "/drafting", title: "Redactare", text: "Propunere tehnică, declarații, clarificări și justificări de preț." },
    { href: "/suport", title: "Suport", text: "Întrebări frecvente și o linie directă către echipă." },
  ];
  return (
    <main className="mx-auto w-full max-w-[1264px] flex-1 px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
      <p className="label-eyebrow tabular text-accent">Eroare 404</p>
      <h1 className="mt-3 max-w-2xl text-[38px] font-semibold leading-[42px] tracking-[-0.025em] text-ink sm:text-[44px] sm:leading-[48px]">
        Pagina nu există sau a fost mutată.
      </h1>
      <p className="mt-4 max-w-xl text-[17px] leading-[28px] text-stock-500">
        Dacă ați ajuns aici dintr-un email cu un dosar, licitația poate fi închisă sau retrasă din SEAP. Căutați-o în registru după titlu sau CPV.
      </p>
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-lg bg-editorial px-4 text-[15px] font-semibold text-white hover:bg-editorial-light">
          Înapoi la prima pagină
        </Link>
        <Link href="/cautare-avansata" className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-paper px-4 text-[15px] font-semibold text-ink hover:border-stock-400">
          Caută în registru
        </Link>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {exits.map((e) => (
          <Link key={e.href} href={e.href} className="rounded-xl border border-line-strong bg-paper p-5 transition-colors hover:border-line-strong">
            <span className="block text-[17px] font-semibold text-ink">{e.title} →</span>
            <span className="mt-1.5 block text-[15px] leading-6 text-stock-500">{e.text}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
