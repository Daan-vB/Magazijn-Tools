/* =====================================================================
   IVOL Warehouse 3.0 — kern: teksten voor de vloer in 4 talen (nl, en, es, el)
   Zelfde taalkeuze als Junior (localStorage 'junior-taal'). Picqer-namen blijven Nederlands.
   "a|b" = enkelvoud|meervoud, {n} {x} = invullen. Schermen voor Daan en Karin zijn alleen Nederlands.
   ===================================================================== */
(function(g){
'use strict';
const TALEN = ['nl', 'en', 'es', 'el'];
const NAAM = { nl:'Nederlands', en:'English', es:'Español', el:'Ελληνικά' };
const T = {
nl:{
  titel:'Aanvullen', ordersWacht:'order wacht|orders wachten', voorOrders:'Eerst: orders wachten', ronde:'Aanvulronde',
  gang:'Gang', alleGangen:'Alle gangen', van:'Van', naar:'Naar', geenLocatie:'geen specifieke locatie', stuks:'stuk|stuks',
  gedaan:'Gedaan', gedaanDoor:'Gedaan door {x}', leeg:'Niets aan te vullen. Goed bezig!', open:'{n} open',
  wie:'Wie ben je?', wieUitleg:'Eén keer kiezen op deze telefoon.', opslaan:'Opslaan',
  bijgewerkt:'Bijgewerkt {x} geleden', oud:'Let op: de stand is {x} oud.', nietLive:'De kern is nog niet live. Gebruik Junior.',
  koppel:'Koppelcode nodig: vraag Daan.', fout:'Lukt niet: {x}', ververs:'Vernieuwen', taal:'Taal', laden:'Laden…',
  uitleg:'Pak het aantal van de bulklocatie, zet het op de picklocatie, verwerk het in de Picqer-app en tik op Gedaan.',
  min:'{n} min', uur:'{n} uur', dag:'{n} dag|{n} dagen'
},
en:{
  titel:'Replenish', ordersWacht:'order waiting|orders waiting', voorOrders:'First: orders waiting', ronde:'Replenishment round',
  gang:'Aisle', alleGangen:'All aisles', van:'From', naar:'To', geenLocatie:'geen specifieke locatie (no location)', stuks:'piece|pieces',
  gedaan:'Done', gedaanDoor:'Done by {x}', leeg:'Nothing to replenish. Well done!', open:'{n} open',
  wie:'Who are you?', wieUitleg:'Choose once on this phone.', opslaan:'Save',
  bijgewerkt:'Updated {x} ago', oud:'Note: the data is {x} old.', nietLive:'The core is not live yet. Use Junior.',
  koppel:'Link code needed: ask Daan.', fout:'Failed: {x}', ververs:'Refresh', taal:'Language', laden:'Loading…',
  uitleg:'Take the quantity from the bulk location, put it on the pick location, process it in the Picqer app and tap Done.',
  min:'{n} min', uur:'{n} h', dag:'{n} day|{n} days'
},
es:{
  titel:'Reponer', ordersWacht:'pedido esperando|pedidos esperando', voorOrders:'Primero: pedidos esperando', ronde:'Ronda de reposición',
  gang:'Pasillo', alleGangen:'Todos los pasillos', van:'De', naar:'A', geenLocatie:'geen specifieke locatie (sin ubicación)', stuks:'unidad|unidades',
  gedaan:'Hecho', gedaanDoor:'Hecho por {x}', leeg:'Nada que reponer. ¡Bien hecho!', open:'{n} abiertos',
  wie:'¿Quién eres?', wieUitleg:'Elige una vez en este teléfono.', opslaan:'Guardar',
  bijgewerkt:'Actualizado hace {x}', oud:'Atención: los datos tienen {x}.', nietLive:'El núcleo aún no está activo. Usa Junior.',
  koppel:'Se necesita el código: pregunta a Daan.', fout:'Error: {x}', ververs:'Actualizar', taal:'Idioma', laden:'Cargando…',
  uitleg:'Coge la cantidad de la ubicación bulk, ponla en la ubicación de picking, regístralo en la app de Picqer y pulsa Hecho.',
  min:'{n} min', uur:'{n} h', dag:'{n} día|{n} días'
},
el:{
  titel:'Αναπλήρωση', ordersWacht:'παραγγελία σε αναμονή|παραγγελίες σε αναμονή', voorOrders:'Πρώτα: παραγγελίες σε αναμονή', ronde:'Γύρος αναπλήρωσης',
  gang:'Διάδρομος', alleGangen:'Όλοι οι διάδρομοι', van:'Από', naar:'Προς', geenLocatie:'geen specifieke locatie (χωρίς θέση)', stuks:'τεμάχιο|τεμάχια',
  gedaan:'Έγινε', gedaanDoor:'Έγινε από {x}', leeg:'Τίποτα για αναπλήρωση. Μπράβο!', open:'{n} ανοιχτά',
  wie:'Ποιος είσαι;', wieUitleg:'Διάλεξε μία φορά σε αυτό το τηλέφωνο.', opslaan:'Αποθήκευση',
  bijgewerkt:'Ενημερώθηκε πριν από {x}', oud:'Προσοχή: τα δεδομένα είναι {x} παλιά.', nietLive:'Ο πυρήνας δεν είναι ακόμη ενεργός. Χρησιμοποίησε το Junior.',
  koppel:'Χρειάζεται κωδικός σύνδεσης: ρώτα τον Daan.', fout:'Απέτυχε: {x}', ververs:'Ανανέωση', taal:'Γλώσσα', laden:'Φόρτωση…',
  uitleg:'Πάρε την ποσότητα από τη θέση bulk, βάλε την στη θέση picking, καταχώρισέ το στην εφαρμογή Picqer και πάτα Έγινε.',
  min:'{n} λεπτό|{n} λεπτά', uur:'{n} ώρα|{n} ώρες', dag:'{n} ημέρα|{n} ημέρες'
}};
function taal(){
  try{ const s = localStorage.getItem('junior-taal'); if(TALEN.includes(s)) return s; }catch(e){}
  const b = (typeof navigator !== 'undefined' && navigator.language || '').slice(0, 2);
  return TALEN.includes(b) ? b : 'nl';
}
function t(tl, k, v){
  let s = (T[tl] && T[tl][k]) ?? T.nl[k] ?? k;
  v = v || {};
  if(s.includes('|')){ const [een, meer] = s.split('|'); s = v.n === 1 ? een : meer; }
  return s.replace(/\{(\w+)\}/g, (m, x) => (v[x] ?? m));
}
const api = { TALEN, NAAM, T, taal, t };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else g.WHKT = api;
})(typeof window !== 'undefined' ? window : globalThis);
