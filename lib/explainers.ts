/**
 * Plain-language explanations for everything technical in the product.
 *
 * One place, for two reasons. The same concept appears on several pages
 * (the relevance score is on the feed, the front page and the copilot
 * panel), and a second hand-written copy drifts into contradicting the
 * first. And the honest caveats — that a figure is a heuristic, that the
 * system has no award data, that a legal citation is a starting point and
 * not advice — have to be stated the same way everywhere, or the one page
 * that omits them is the one the user believes.
 *
 * Written for someone who runs a construction firm, not for a lawyer and
 * not for a developer: what the number means, where it comes from, and
 * what it does NOT tell you.
 */
export const EXPLAINERS = {
  /* ------------------------------------------------------ feed & scoring */
  relevanceScore: {
    title: "Scorul de potrivire",
    body:
      "Cât de bine se potrivește un dosar cu criteriile dvs. Se calculează din cuvintele-cheie găsite în titlu și descriere, județ, domeniu și valoare. " +
      "Nu ascundem nimic: dosarele care nu se potrivesc coboară în listă, dar rămân vizibile. Un scor mic înseamnă „probabil nu pentru dvs.”, nu „nu există”.",
  },
  opportunityScore: {
    title: "Scorul dosarului (0-10)",
    body:
      "O notă calculată automat din dovezi concrete: în ce fază este procedura, dacă are valoare publicată, cât de aproape e termenul și cât de complet e anunțul. " +
      "Procedurile deja atribuite primesc scor negativ, ca să nu apară înaintea celor la care mai puteți participa. Nu este o predicție că veți câștiga.",
  },
  matchReasons: {
    title: "De ce apare acest dosar",
    body:
      "Lista motivelor pentru care dosarul s-a potrivit: ce cuvânt-cheie a fost găsit, dacă județul sau domeniul coincid. " +
      "Cuvântul-cheie este dovada obligatorie — județul și domeniul întăresc potrivirea, dar nu o pot crea singure.",
  },
  procurementStage: {
    title: "Faza procedurii",
    body:
      "Unde se află achiziția: consultare de piață (specificațiile se pot încă influența legal), documentație în pregătire, licitație publicată sau contract atribuit. " +
      "Fazele timpurii valorează mai mult pentru dvs. — acolo mai puteți cere clarificări care schimbă caietul de sarcini.",
  },
  seapCrossReference: {
    title: "Potrivire SEAP: posibilă",
    body:
      "Anunțul european (TED) pare să corespundă unei proceduri din SEAP, pe baza a cel puțin două semnale care coincid: codul CPV, valoarea și numele autorității. " +
      "TED nu publică numărul procedurii naționale, deci legătura nu poate fi confirmată automat — verificați în SEAP înainte de a trata cele două ca fiind același dosar.",
  },
  estimatedValue: {
    title: "Valoarea estimată",
    body:
      "Bugetul anunțat de autoritatea contractantă. Când scrie „nepublicat”, chiar nu a fost publicat — nu îl estimăm și nu îl completăm noi. " +
      "Confirmați-l la autoritate înainte de a construi oferta pe el.",
  },

  /* --------------------------------------------------------- pipeline */
  weightedPipeline: {
    title: "Valoarea ponderată",
    body:
      "Suma dosarelor active, fiecare înmulțit cu o probabilitate standard de câștig pentru etapa în care se află (10% la descoperire, 70% la ofertă depusă). " +
      "Este o convenție de vânzări transparentă, nu un model antrenat pe rezultate reale — sistemul vă arată exact ce coeficient a folosit.",
  },
  stageProbability: {
    title: "Probabilitatea pe etapă",
    body:
      "Coeficientul folosit la calculul valorii ponderate. Crește pe măsură ce dosarul avansează. " +
      "Este o euristică fixă, aceeași pentru toți — nu ține cont de concurență sau de istoricul dvs.",
  },
  daysInStage: {
    title: "Timp mediu pe etapă",
    body:
      "Măsurat real, din momentele în care ați mutat efectiv dosarele dintr-o etapă în alta. Nu este o estimare. " +
      "Un timp mare într-o etapă arată unde se blochează dosarele dvs.",
  },
  conversionRate: {
    title: "Rata de conversie",
    body:
      "Din câte dosare au ajuns într-o etapă, câte au ajuns și în următoarea. Calculat din istoricul propriu de tranziții. " +
      "Cu puține dosare, cifra este volatilă — devine utilă după câteva zeci de proceduri.",
  },
  proposedPrice: {
    title: "Prețul ofertat",
    body:
      "Prețul cu care ați depus efectiv oferta. Odată completat, înlocuiește valoarea estimată în toate calculele de pipeline, " +
      "pentru că valoarea reală a dosarului pentru dvs. este cât ați ofertat, nu cât a estimat autoritatea.",
  },

  /* ------------------------------------------------------ market analysis */
  marketProfile: {
    title: "Ce este profilul de piață",
    body:
      "O radiografie a unui sector într-un județ, calculată exclusiv din anunțurile pe care acest sistem le-a colectat: " +
      "câte proceduri comparabile există, cât valorează de obicei și care autorități le lansează. Vă spune dacă piața pe care intrați e activă și cine cumpără.",
  },
  medianValue: {
    title: "Valoarea mediană",
    body:
      "Valoarea din mijloc: jumătate dintre proceduri sunt sub ea, jumătate peste. " +
      "Preferabilă mediei, pentru că un singur contract de 280 de milioane ar trage media în sus și v-ar da o imagine falsă despre contractele obișnuite din sector.",
  },
  priceReferences: {
    title: "Reperele de preț",
    body:
      "Pur și simplu valoarea estimată minus 5%, 10% și 15% — o riglă pentru discuția internă despre marjă. " +
      "NU sunt prețuri câștigătoare și nu sunt prognoze. Sunt procente aplicate la o singură cifră, cea publicată de autoritate.",
  },
  competitivePressure: {
    title: "Presiunea concurențială",
    body:
      "O etichetă calculată din atribuirile reale pe care le-am colectat: cât de concentrat este câștigătorul și cât de mult a scăzut prețul față de estimare. " +
      "„Monopolizat” înseamnă că o singură firmă ia majoritatea, cu discount mic. „Concurență agresivă” înseamnă marjă strânsă. " +
      "Pragurile sunt fixe și declarate, iar dovezile sunt afișate — nu este un model statistic.",
  },
  winningDiscount: {
    title: "Discountul câștigător",
    body:
      "Cu cât sub valoarea estimată a ofertat firma care a câștigat efectiv. Calculat din anunțuri de atribuire reale, nu estimat. " +
      "Acoperim deocamdată doar achizițiile directe (anunțuri SEAP de tip CAN), deci eșantionul este mic — verificați câte atribuiri stau în spatele cifrei.",
  },
  analysisScope: {
    title: "Ce acoperă cifrele",
    body:
      "Când există suficiente proceduri în județul cerut, toate cifrele sunt calculate doar din acelea. " +
      "Când nu există, trecem pe date naționale și scriem asta explicit — ca să nu citiți o medie pe țară drept o realitate locală.",
  },
  awardDataGap: {
    title: "De ce nu vedeți concurenții",
    body:
      "Ca să spunem „firma X câștigă de obicei cu 12% sub estimare” ne-ar trebui anunțurile de atribuire — cine a câștigat, cu ce preț, câți au ofertat. " +
      "Afișăm doar ce am colectat efectiv; nu completăm golul cu presupuneri.",
  },

  /* ------------------------------------------------------------- legal */
  abnormallyLowPrice: {
    title: "Prețul neobișnuit de scăzut",
    body:
      "Dacă prețul dvs. pare neobișnuit de mic față de prețurile pieței, comisia este obligată să vă ceară explicații (art. 210 din Legea 98/2016, art. 136 din normele HG 395/2016) " +
      "și vă respinge oferta doar dacă nu le puteți susține cu dovezi. Practic: puteți oferta sub estimare, dar trebuie să demonstrați din ce se compune prețul.",
  },
  eightyPercentMyth: {
    title: "Pragul de 80% nu mai există",
    body:
      "Regula „sub 80% din valoarea estimată oferta e automat neobișnuit de scăzută” provine din OUG 34/2006, abrogată. " +
      "Nici Legea 98/2016 (art. 210), nici normele HG 395/2016 (art. 136) nu conțin vreun procent — testul actual este calitativ, prin raportare la prețurile pieței. " +
      "Noi folosim 80% doar ca semnal intern de risc, ca să vă pregătiți justificarea din timp. Nu este un prag legal.",
  },
  clarificationRequest: {
    title: "Solicitarea de clarificări",
    body:
      "O adresă oficială către autoritate prin care cereți lămuriri sau contestați o cerință din caietul de sarcini, înainte de termenul de depunere (art. 160-161 din Legea 98/2016). " +
      "Este instrumentul ieftin: rezolvă problema fără contestație și fără taxe.",
  },
  cnscDeadline: {
    title: "Termenul de contestare",
    body:
      "Contestația la CNSC se depune în 10 zile de la data la care ați aflat de actul autorității, pentru procedurile peste pragurile europene, " +
      "și în 7 zile sub aceste praguri (art. 8 din Legea 101/2016). Termenele curg din ziua următoare și nu se pot prelungi.",
  },
  restrictiveClause: {
    title: "Clauza restrictivă",
    body:
      "O cerință din caietul de sarcini care limitează concurența fără justificare: o marcă anume fără „sau echivalent”, o cifră de afaceri disproporționată " +
      "față de valoarea contractului, un termen imposibil. Scanerul le semnalează și vă arată articolul pe care vă puteți sprijini.",
  },
  legalCitation: {
    title: "Citatele legale",
    body:
      "Textele sunt preluate din forma consolidată publicată pe legislatie.just.ro, nu scrise din memorie de un model AI. " +
      "Verificați întotdeauna forma în vigoare la data procedurii — și pentru contestații consultați un specialist înainte de depunere.",
  },
  caenCode: {
    title: "Codul CAEN",
    body:
      "Codul care descrie oficial ce activități are voie firma dvs. să desfășoare. Autoritatea îl verifică: dacă obiectul contractului nu se încadrează " +
      "în CAEN-urile dvs. autorizate, oferta poate fi respinsă indiferent cât de bună este.",
  },
  cpvCode: {
    title: "Codul CPV",
    body:
      "Vocabularul european comun pentru achiziții — codul care spune ce se cumpără. Este cel mai sigur mod de a compara două proceduri între ele, " +
      "pentru că titlurile sunt scrise diferit de fiecare autoritate.",
  },
  cui: {
    title: "CUI-ul",
    body:
      "Codul unic de înregistrare al firmei. Îl folosim ca să interogăm registrele publice ANAF și să completăm automat datele reale ale companiei, " +
      "în loc să vă bazăm raportul de eligibilitate pe ce ați declarat dvs.",
  },

  /* ---------------------------------------------------------- documents */
  ocr: {
    title: "OCR",
    body:
      "Citirea automată a textului dintr-un PDF scanat (o poză a unui document, nu text propriu-zis). " +
      "Multe anexe de la primării sunt scanate; fără OCR nu se poate căuta nimic în ele.",
  },
  aiExpansion: {
    title: "Extinderea AI",
    body:
      "Dezvoltă secțiunile de metodologie și riscuri din documentul generat, folosind un model AI. " +
      "Este întotdeauna un plus: dacă modelul nu răspunde, documentul rămâne complet din șablon.",
  },
} as const;

export type ExplainerKey = keyof typeof EXPLAINERS;
