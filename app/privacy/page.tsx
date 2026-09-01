import Link from "next/link";
import { PageHeader, Panel, SectionTitle, Notice } from "@/components/newsprint";

export const metadata = { title: "Politica de Confidențialitate — RO-INTEL" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:py-8">
      <PageHeader
        eyebrow="Document legal"
        title="Politica de Confidențialitate"
        standfirst="Ce date colectăm, de ce, și cum vă puteți exercita drepturile GDPR. Ultima actualizare: 1 septembrie 2026."
      />

      <div className="mb-6">
        <Notice tone="warning" title="Document-cadru">
          Acest text este un model funcțional, redactat pe baza fluxurilor reale de date din platformă — nu
          constituie consultanță juridică. Recomandăm revizuirea lui de către un avocat specializat în
          protecția datelor (GDPR/ANSPDCP) înainte de a-l considera definitiv.
        </Notice>
      </div>

      <Panel className="p-5 sm:p-8">
        <div className="font-body space-y-8 text-sm leading-relaxed text-stock-700">
          <section>
            <SectionTitle>1. Operatorul de date</SectionTitle>
            <p>
              RO-INTEL Procurement Intelligence este operatorul datelor cu caracter personal colectate prin
              intermediul acestei platforme, în sensul Regulamentului (UE) 2016/679 (GDPR).
            </p>
          </section>

          <section>
            <SectionTitle>2. Ce date colectăm</SectionTitle>
            <ul className="mt-1 list-disc space-y-2 pl-5">
              <li>
                <b>Date de identificare a contului</b> — adresa de email și, dacă vă autentificați prin Google,
                numele și fotografia de profil asociate contului Google. Autentificarea este gestionată integral
                de furnizorul nostru, Supabase Auth; nu stocăm și nu avem acces la parola contului dvs. Google.
              </li>
              <li>
                <b>Profilul dvs. de căutare</b> — domeniul de interes, județele urmărite, cuvintele-cheie,
                cuvintele de excludere și pragul minim de valoare pe care le configurați la înregistrare sau
                ulterior. Acestea determină ce oportunități vi se afișează.
              </li>
              <li>
                <b>Preferințe de alertă</b> — adresa de email la care trimitem notificări automate și pragul de
                scor de la care se declanșează o alertă.
              </li>
              <li>
                <b>Adresa IP</b> — reținută temporar (nu persistă în baza de date) pentru limitarea numărului de
                cereri către server, ca măsură de securitate împotriva utilizării abuzive.
              </li>
              <li>
                <b>Conținut încărcat de dvs.</b> — dacă folosiți instrumentul de analiză a caietelor de sarcini,
                fișierul încărcat (PDF/DOCX) este procesat pentru a extrage text; textul poate fi păstrat temporar
                pentru a permite reluarea analizei fără reîncărcare.
              </li>
              <li>
                <b>Interacțiuni cu funcțiile de inteligență artificială</b> — dacă folosiți asistentul
                conversațional sau opțiunea de extindere AI a documentelor generate, întrebarea/textul dvs. este
                transmis unui furnizor terț de modele lingvistice (vezi secțiunea 4) pentru a genera un răspuns.
              </li>
            </ul>
            <p className="mt-3">
              <b>Nu colectăm</b> date de plată direct pe Platformă (facturarea se face prin proformă și transfer
              bancar, în afara aplicației) și nu solicităm alte categorii de date decât cele de mai sus.
            </p>
          </section>

          <section>
            <SectionTitle>3. De ce prelucrăm aceste date (temei legal)</SectionTitle>
            <ul className="mt-1 list-disc space-y-2 pl-5">
              <li><b>Executarea contractului</b> — pentru a vă oferi accesul la fluxul de oportunități și instrumentele aferente, conform Termenilor și Condițiilor.</li>
              <li><b>Interesul legitim</b> — pentru limitarea abuzului (rate-limiting pe adresă IP) și pentru a fi notificați, ca operator al platformei, când se creează un cont nou, în scopuri de facturare și suport.</li>
              <li><b>Consimțământul dvs.</b> — exprimat explicit la crearea contului, pentru prelucrarea descrisă în această politică.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>4. Cu cine partajăm datele</SectionTitle>
            <p>Nu vindem datele dvs. Le partajăm strict cu furnizorii tehnici necesari funcționării serviciului:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><b>Supabase</b> (autentificare și bază de date) — găzduiește contul dvs. și datele de profil.</li>
              <li><b>Render</b> (găzduirea aplicației backend).</li>
              <li>
                <b>Furnizori de modele lingvistice</b> (Groq, Google Gemini, OpenAI sau xAI, în funcție de
                configurația activă) — primesc doar conținutul specific al cererii dvs. către funcțiile AI
                (întrebarea din chat sau textul documentului de extins), nu întregul dvs. profil.
              </li>
              <li><b>Telegram</b> — dacă operatorul are configurat un canal de alerte, notificările automate pot tranzita API-ul Telegram.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>5. Cât timp păstrăm datele</SectionTitle>
            <p>
              Păstrăm datele contului dvs. cât timp acesta este activ. La ștergerea contului (secțiunea 7),
              profilul de căutare, criteriile de monitorizare și istoricul de dosare urmărite asociate contului
              dvs. sunt șterse din baza de date, ca parte a aceleiași cereri. Identificatorul de autentificare
              (contul Supabase Auth propriu-zis) este eliminat automat prin aceeași cerere ori de câte ori este
              posibil din punct de vedere tehnic; dacă acest pas nu reușește, operatorul este notificat automat
              și îl elimină manual în cel mai scurt timp.
            </p>
          </section>

          <section>
            <SectionTitle>6. Drepturile dvs. (GDPR)</SectionTitle>
            <p>Aveți dreptul de a:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>accesa datele pe care le deținem despre dvs. (vizibile direct în secțiunea &bdquo;Cont &amp; alerte&rdquo;);</li>
              <li>rectifica orice informație inexactă din profilul dvs.;</li>
              <li>solicita ștergerea contului și a datelor asociate — self-service, din aplicație (secțiunea 7);</li>
              <li>vă retrage consimțământul în orice moment, prin ștergerea contului;</li>
              <li>depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), dacă considerați că prelucrarea datelor dvs. încalcă legislația aplicabilă.</li>
            </ul>
          </section>

          <section>
            <SectionTitle>7. Cum vă ștergeți contul</SectionTitle>
            <p>
              Din aplicație: deschideți <b>Cont &amp; alerte</b> din meniul lateral și alegeți opțiunea de
              ștergere a contului. Acțiunea este ireversibilă și este confirmată explicit înainte de execuție.
              Vedeți și{" "}
              <Link href="/terms" className="text-editorial underline underline-offset-2">
                Termenii și Condițiile
              </Link>
              , secțiunea 7.
            </p>
          </section>

          <section>
            <SectionTitle>8. Securitate</SectionTitle>
            <p>
              Sesiunile sunt autentificate prin tokenuri JWT semnate criptografic, verificate la fiecare cerere.
              Comunicarea cu Platforma se face exclusiv prin conexiuni criptate (HTTPS). Accesul la datele unui
              cont este restricționat astfel încât un utilizator autentificat nu poate accesa datele altui cont.
            </p>
          </section>

          <section>
            <SectionTitle>9. Contact</SectionTitle>
            <p>
              Pentru exercitarea oricărui drept descris mai sus sau întrebări privind această politică, scrieți
              la adresa de contact afișată în Platformă.
            </p>
          </section>
        </div>
      </Panel>
    </main>
  );
}
