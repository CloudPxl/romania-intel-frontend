/**
 * Public copy shared by the landing page and its structured data (FAQPage
 * JSON-LD): one text, so what answer engines quote is exactly what the
 * page says. Every legal statement here is grounded in legal_kb (L98/2016,
 * HG 395/2016) — no article is cited that the product does not quote.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Am nevoie de card ca să încep?",
    a: "Nu. Contul gratuit se creează doar cu adresa de email: primiți un link și intrați. Treceți la un plan plătit doar dacă vreți mai multe documente AI, mesaje Copilot sau firme.",
  },
  {
    q: "De unde vin datele și cât de actuale sunt?",
    a: "Din SEAP/SICAP (anunțuri de participare, simplificate, achiziții directe, atribuiri), TED, acordurile de mediu ANMAP, portalul de achiziții CNAIR și registrele județene. Registrul se actualizează la câteva minute; data ultimei sincronizări reușite a fiecărei surse e afișată în cont. Dacă o sursă nu răspunde, nu afișăm o cifră estimată.",
  },
  {
    q: "Înlocuiește un consultant în achiziții publice?",
    a: "Nu. Vă scutește de căutare și de prima citire a caietului și vă dă documentele cu temeiul legal citat. Decizia și semnătura rămân ale dvs. sau ale consultantului.",
  },
  {
    q: "Pot plăti prin transfer bancar, pe factură?",
    a: "Da. Emitem factură proformă și plătiți prin OP, lunar sau anual. Prețurile sunt în RON, fără TVA.",
  },
  {
    q: "Ce se întâmplă cu datele firmei mele?",
    a: "Folosim CUI-ul și preferințele doar ca să vă filtrăm licitațiile și să completăm documentele. Serverele sunt în Uniunea Europeană; datele dvs. nu sunt folosite la antrenarea modelelor AI. Vă puteți șterge contul oricând, din setări.",
  },
  {
    q: "Ce înseamnă pragul de 80% și articolul 210 din Legea 98/2016?",
    a: "Conform art. 136 alin. (4) din HG 395/2016, o ofertă al cărei preț este sub 80% din valoarea estimată a contractului, fără TVA, este prezumată a avea un preț aparent neobișnuit de scăzut. În acest caz, autoritatea contractantă este obligată de art. 210 din Legea 98/2016 să ceară ofertantului justificări ale prețului. RO-INTEL calculează pragul pentru fiecare procedură și redactează justificarea.",
  },
  {
    q: "Cum găsește RO-INTEL clauzele restrictive din caietul de sarcini?",
    a: "Încărcați caietul de sarcini (PDF sau DOCX). Scanarea gratuită caută tiparele uzuale de restricționare: mărci sau producători impuși, experiență similară disproporționată, termene nerealiste. În planul Ofertant Complet Pro, o a doua citire cu AI găsește și clauzele pe care tiparele le ratează. Fiecare citat e verificat în textul documentului, iar temeiul legal vine din textul consolidat al legii, nu din model.",
  },
  {
    q: "Cât costă RO-INTEL?",
    a: "Gratuit: 0 lei, cu 2 documente AI și 15 mesaje Copilot pe lună. Strategie & Monitorizare: 490 lei pe lună sau 4.900 lei pe an. Ofertant Complet Pro: 990 lei pe lună sau 7.900 lei pe an, la tariful Fondator. Prețurile sunt în RON, fără TVA.",
  },
];
