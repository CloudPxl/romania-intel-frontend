export interface CommercialLead {
  id: string
  desk: 'Infrastructură' | 'Energie' | 'Apărare' | 'Sănătate'
  title: string
  summary: string
  county: string
  city: string
  value: number
  score: number
  stage: 'Pre-anunț' | 'Consultare' | 'Licitație' | 'Evaluare'
  buyer: string
  deadline: string
  published: string
  source: string
  tags: string[]
  battlecard: string[]
  verified: boolean
  claimedBy?: string
}

export interface TenantProfile {
  id: string
  name: string
  initials: string
  plan: 'Executive' | 'Strategic'
  desks: CommercialLead['desk'][]
}

export const tenants: TenantProfile[] = [
  { id: 't1', name: 'Northstar Advisory', initials: 'NA', plan: 'Executive', desks: ['Infrastructură', 'Energie', 'Sănătate'] },
  { id: 't2', name: 'Carpathia Partners', initials: 'CP', plan: 'Strategic', desks: ['Infrastructură', 'Energie', 'Apărare', 'Sănătate'] },
]

export const leads: CommercialLead[] = [
  { id:'RO-4821', desk:'Infrastructură', title:'Extinderea magistralei M6 — lotul de sisteme și automatizări', summary:'Metrorex pregătește documentația pentru sisteme, semnalizare și control trafic pe segmentul 1 Mai–Otopeni.', county:'București', city:'București', value:182000000, score:96, stage:'Pre-anunț', buyer:'Metrorex S.A.', deadline:'18 sep. 2026', published:'acum 12 min', source:'SICAP / plan anual actualizat', tags:['feroviar','automatizări','UE'], battlecard:['Poziționați expertiza EN 50126 înainte de publicare.','Solicitați întâlnire tehnică în următoarele 10 zile.','Mapare partener local cu certificare Metrorex.'], verified:true },
  { id:'RO-4819', desk:'Energie', title:'Parc fotovoltaic 120 MW și capacitate de stocare', summary:'Dezvoltator regional caută EPC și furnizori BESS pentru un proiect ready-to-build în sud-est.', county:'Constanța', city:'Medgidia', value:134000000, score:92, stage:'Consultare', buyer:'Energia Dobrogea S.A.', deadline:'02 oct. 2026', published:'acum 28 min', source:'Monitorul Oficial / consultare piață', tags:['solar','BESS','EPC'], battlecard:['Intrați cu ofertă comună EPC+BESS.','Validați capacitatea de racordare la stația Medgidia Sud.','Pregătiți modelul de finanțare merchant/PPA.'], verified:true },
  { id:'RO-4812', desk:'Sănătate', title:'Echiparea noului centru regional de oncologie', summary:'Pachet integrat de imagistică, radioterapie și software clinic, finanțat prin Programul Sănătate.', county:'Cluj', city:'Cluj-Napoca', value:76500000, score:89, stage:'Licitație', buyer:'Spitalul Clinic Județean Cluj', deadline:'29 aug. 2026', published:'acum 1 h', source:'SICAP CN1084421', tags:['medtech','oncologie','fonduri UE'], battlecard:['Accent pe interoperabilitate HL7/FHIR.','Includeți program de training multianual.','Contestațiile anterioare indică risc pe criteriul service.'], verified:true, claimedBy:'Andrei M.' },
  { id:'RO-4807', desk:'Infrastructură', title:'Modernizare drum expres Oradea–Arad, sector central', summary:'Studiul de fezabilitate indică patru loturi, cu lansare anticipată în trimestrul IV.', county:'Bihor', city:'Oradea', value:310000000, score:87, stage:'Pre-anunț', buyer:'CNAIR', deadline:'14 nov. 2026', published:'acum 2 h', source:'CNAIR / calendar investiții', tags:['rutier','proiectare','TEN-T'], battlecard:['Formați asocierea înainte de septembrie.','Prioritizați experiența pe noduri rutiere complexe.','Monitorizați acordul de mediu.'], verified:true },
  { id:'RO-4798', desk:'Apărare', title:'Sistem integrat de supraveghere a frontierei estice', summary:'Program multianual pentru senzori, comunicații securizate și centre de comandă mobile.', county:'Iași', city:'Iași', value:228000000, score:94, stage:'Consultare', buyer:'Ministerul Afacerilor Interne', deadline:'07 oct. 2026', published:'acum 3 h', source:'SEAP / consultare 7642', tags:['C4ISR','senzori','NATO'], battlecard:['Necesită autorizare ORNISS pentru echipa cheie.','Demonstrație tehnică recomandată în 30 zile.','Parteneriat cu integrator român obligatoriu.'], verified:true },
  { id:'RO-4784', desk:'Energie', title:'Reabilitarea hidrocentralei Lotru-Ciunget', summary:'Înlocuirea grupurilor și modernizarea controlului pentru extinderea duratei de viață cu 30 ani.', county:'Vâlcea', city:'Brezoi', value:98000000, score:84, stage:'Evaluare', buyer:'Hidroelectrica S.A.', deadline:'21 sep. 2026', published:'ieri, 16:40', source:'BVB / raport emitent', tags:['hidro','turbine','SCADA'], battlecard:['Urmăriți subcontractările post-atribuire.','Pregătiți oferta de mentenanță predictivă.','Identificați furnizorii OEM compatibili.'], verified:false },
]

export const countyAnalytics = [{name:'București',value:31},{name:'Constanța',value:22},{name:'Iași',value:18},{name:'Cluj',value:16},{name:'Bihor',value:13}]
export const spenders = [{name:'CNAIR',value:'€1,24 mld.'},{name:'Metrorex',value:'€684 mil.'},{name:'Hidroelectrica',value:'€426 mil.'},{name:'MAI',value:'€311 mil.'}]
