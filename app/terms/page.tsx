import Link from "next/link";
import { PageHeader, Panel, SectionTitle, Notice } from "@/components/newsprint";

export const metadata = { title: "Termeni și Condiții — RO-INTEL" };

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Document legal"
        title="Termeni și Condiții"
        standfirst="Regulile de utilizare a platformei RO-INTEL. Ultima actualizare: 1 septembrie 2026."
      />

      <div className="mb-6">
        <Notice tone="warning" title="Document-cadru">
          Acest text este un model funcțional, redactat pentru a reflecta exact ce face platforma astăzi —
          nu constituie consultanță juridică. Înainte de a-l considera definitiv, recomandăm verificarea lui de
          către un avocat specializat în protecția datelor și dreptul consumatorului din România.
        </Notice>
      </div>

      <Panel className="p-5 sm:p-8">
        <div className="font-body space-y-8 text-sm leading-relaxed text-stock-700">
          <section>
            <SectionTitle>1. Cine suntem și ce este RO-INTEL</SectionTitle>
            <p>
              RO-INTEL („Platforma&rdquo;, „Serviciul&rdquo;) este un serviciu de monitorizare și analiză a
              oportunităților de achiziții publice din România, operat de RO-INTEL Procurement Intelligence
              (&bdquo;Operatorul&rdquo;, &bdquo;noi&rdquo;). Platforma agregă informații publice din surse
              precum SEAP/SICAP, Tenders Electronic Daily (TED), portaluri instituționale ale autorităților
              contractante și registre publice ale unităților administrativ-teritoriale, și le pune la
              dispoziția utilizatorilor sub formă de flux filtrat, analize și instrumente de redactare.
            </p>
          </section>

          <section>
            <SectionTitle>2. Contul dumneavoastră</SectionTitle>
            <p>
              Accesul la Platformă necesită crearea unui cont individual, autentificat prin Google OAuth sau
              printr-un link de acces trimis pe email (magic link), prin intermediul furnizorului nostru de
              autentificare, Supabase. Fiecare cont este destinat utilizării de către o singură persoană
              fizică sau, dacă monitorizează în numele unei firme, de către reprezentantul desemnat al
              acesteia. Sunteți responsabil pentru păstrarea confidențialității accesului la contul dvs. de
              email/Google folosit pentru autentificare.
            </p>
            <p className="mt-3">
              La prima autentificare, configurați propriul profil de căutare (domeniu de interes, județe,
              cuvinte-cheie, prag minim de valoare) — acesta determină ce oportunități vi se afișează și
              pentru ce sunteți alertat automat. Puteți modifica aceste criterii oricând din contul dvs.
            </p>
          </section>

          <section>
            <SectionTitle>3. Natura informațiilor furnizate</SectionTitle>
            <p>
              Oportunitățile afișate provin din surse publice și sunt procesate automat (extragere, clasificare
              pe domenii, scor de relevanță). Scorurile, analizele de piață, evaluările de eligibilitate și
              textele generate de instrumentele de redactare (dosare tehnice, solicitări de clarificare) sunt
              produse asistat de algoritmi și, opțional, de modele lingvistice (AI) — au caracter orientativ și
              nu înlocuiesc verificarea documentației oficiale a fiecărei proceduri, consultanța juridică de
              specialitate sau o evaluare independentă a eligibilității companiei dvs. Instrumentul de scanare
              a clauzelor restrictive dintr-un caiet de sarcini identifică tipare uzuale de formulare, nu
              constituie o expertiză juridică completă a documentației.
            </p>
          </section>

          <section>
            <SectionTitle>4. Plata serviciului</SectionTitle>
            <p>
              Accesul la anumite funcționalități poate fi condiționat de un abonament plătit. Facturarea se
              face pe bază de proformă, cu plata prin transfer bancar; nu procesăm plăți cu cardul direct pe
              Platformă. Detaliile de facturare (denumire/nume, CUI sau alt identificator fiscal aplicabil) se
              colectează separat, la momentul generării facturii.
            </p>
          </section>

          <section>
            <SectionTitle>5. Utilizare acceptabilă</SectionTitle>
            <p>Este interzisă:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>crearea automată/repetată de conturi (script-uri, conturi de unică folosință) în scopul ocolirii limitelor Platformei;</li>
              <li>extragerea sistematică (scraping) a conținutului Platformei în scopuri comerciale proprii;</li>
              <li>utilizarea Platformei pentru a transmite comunicări nesolicitate unor terți;</li>
              <li>orice încercare de a compromite securitatea sau disponibilitatea Serviciului.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>6. Limitarea răspunderii</SectionTitle>
            <p>
              Platforma este furnizată „ca atare&rdquo;. Nu garantăm exhaustivitatea, acuratețea absolută sau
              actualizarea în timp real a oportunităților afișate — sursele publice pot fi indisponibile
              temporar sau pot modifica formatul datelor. Nu răspundem pentru decizii comerciale luate exclusiv
              pe baza informațiilor din Platformă, fără verificare independentă a documentației oficiale a
              procedurii de achiziție.
            </p>
          </section>

          <section>
            <SectionTitle>7. Încetarea contului</SectionTitle>
            <p>
              Puteți solicita oricând ștergerea contului dvs. din secțiunea &bdquo;Cont &amp; alerte&rdquo; a
              aplicației. Ștergerea este ireversibilă și elimină profilul, criteriile de căutare și istoricul
              asociat contului dvs. — vezi{" "}
              <Link href="/privacy" className="text-editorial underline underline-offset-2">
                Politica de Confidențialitate
              </Link>{" "}
              pentru detalii despre ce date sunt păstrate sau șterse.
            </p>
          </section>

          <section>
            <SectionTitle>8. Modificări</SectionTitle>
            <p>
              Putem actualiza acești Termeni pentru a reflecta schimbări ale Serviciului sau ale cerințelor
              legale. Continuarea utilizării Platformei după o astfel de modificare constituie acceptarea
              noilor termeni.
            </p>
          </section>

          <section>
            <SectionTitle>9. Contact</SectionTitle>
            <p>
              Pentru întrebări legate de acești Termeni, scrieți la adresa de contact afișată în Platformă sau
              în factura proformă primită.
            </p>
          </section>
        </div>
      </Panel>
    </main>
  );
}
