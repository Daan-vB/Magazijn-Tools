/* =====================================================================
   IVOL Warehouse 3.0 — kern: rekenwerk voor de schermen (zonder scherm, zonder netwerk, te testen)
   Alle bedrijfsregels zitten in de kern (database). Hier alleen: leeftijd, versheid, tegels,
   vloerlijst filteren en de namen van afwijkingen. Werkt in de browser (window.WHKM) en in Node (tests).
   ===================================================================== */
(function(g){
'use strict';
const minutenOud = (iso, nu) => { if(!iso) return null; const t = new Date(iso).getTime(); return isNaN(t) ? null : Math.max(0, Math.round(((nu ?? Date.now()) - t) / 60000)); };
// leeftijd als tekst via de taalfunctie: 5 min · 2 uur · 3 dagen
function leeftijd(min, tl, t){
  if(min === null || min === undefined) return '–';
  if(min < 90) return t(tl, 'min', { n:min });
  if(min < 48 * 60) return t(tl, 'uur', { n:Math.round(min / 60) });
  const d = Math.round(min / 1440); return t(tl, 'dag', { n:d });
}
// versheid van de Picqer-spiegel: ok tot 15 min, let op tot 60 min, daarna oud
function versheid(v, nu){
  const min = minutenOud(v && v.picqer, nu);
  const status = min === null ? 'geen' : min <= 15 ? 'ok' : min <= 60 ? 'let' : 'oud';
  return { min, status, fouten:(v && v.fouten) || [] };
}
const nf = (n, d = 0) => (n === null || n === undefined || isNaN(n)) ? '–' : Number(n).toLocaleString('nl-NL', { maximumFractionDigits:d });

function tegelsNu(d, nu){
  if(!d) return [];
  const ow = d.orders_wachten || {}, pl = d.picklijsten || {};
  const oudst = minutenOud(ow.oudste, nu);
  const wacht = ow.verplaatsing || 0, compleet = ow.compleet || 0;
  return [
    { k:'orders', label:'Orders wachten op een verplaatsing', waarde:wacht,
      sub:compleet + ' orders compleet (Verwerk backorders in Picqer)' + (oudst !== null && compleet ? ' · oudste ' + Math.round(oudst / 60) + ' uur' : ''),
      klasse:!wacht && !compleet ? 'ok' : oudst > 240 ? 'rood' : 'let' },
    { k:'ronde', label:'Aanvulronde', waarde:(d.ronde || []).length, sub:'producten onder hun niveau', klasse:(d.ronde || []).length > 40 ? 'let' : 'ok' },
    { k:'pick', label:'Picklijsten open', waarde:pl.open || 0, sub:(pl.ouder_24u || 0) + ' ouder dan 24 uur · ' + (pl.gepauzeerd || 0) + ' gepauzeerd',
      klasse:(pl.ouder_24u || 0) > 0 ? 'rood' : (pl.urgent || 0) > 0 ? 'let' : 'ok' },
    { k:'leeg', label:'Pick én bulk leeg', waarde:(d.bulk_leeg || []).length, sub:'terughalen uit VST of bestellen', klasse:(d.bulk_leeg || []).length ? 'let' : 'ok' }
  ];
}

// vloer: per gang, met filter op gang en zonder wat op dit apparaat al gedaan is
function vloerLijst(d, opties){
  const o = opties || {}, gedaan = o.gedaan || new Set();
  const gangen = ((d && d.gangen) || []).map(x => ({ gang:x.gang, regels:(x.regels || []).filter(r => !gedaan.has(r.id)) })).filter(x => x.regels.length);
  const gekozen = o.gang ? gangen.filter(x => x.gang === o.gang) : gangen;
  return { gangen:gekozen, alle:gangen.map(x => ({ gang:x.gang, n:x.regels.length, orders:x.regels.some(r => r.orders) })),
    totaal:gangen.reduce((s, x) => s + x.regels.length, 0) };
}

const WAT = {
  verdwenen:'Voorraad weg zonder boeking', negatief:'Boekingen kloppen niet', rommel:'Voorraad op een losse naam of map',
  loper_zonder_locatie:'Loper zonder picklocatie', loper_zonder_niveau:'Loper zonder aanvulniveau', structureel_backorder:'Structureel in backorder',
  locatieregel:'Locatie tegen de regel', vrijgeven:'Picklocatie vrijgeven', ruilen:'Ruilen', samen:'Samen gepickt, ver uit elkaar', bulk_dichterbij:'Bulk in andere gang',
  veld:'Gegeven ontbreekt', code:'Twijfel over productcode', dubbel:'Dubbel in palletlabels', import:'Picqer bijwerken', meten:'Opmeten'
};
const watNaam = w => WAT[w] || w;
function afwijkingTellers(obj){
  return Object.entries(obj || {}).map(([wat, n]) => ({ wat, n:Number(n), label:watNaam(wat) })).sort((a, b) => b.n - a.n);
}
// staafjes per uur: vandaag tegen het gemiddelde (laatste 20 werkdagen)
function staafjes(perUur){
  const l = perUur || [];
  const max = Math.max(1, ...l.map(x => Math.max(Number(x.regels) || 0, Number(x.gemiddeld) || 0)));
  return l.map(x => ({ uur:x.uur, vandaag:Number(x.regels) || 0, gem:Number(x.gemiddeld) || 0, pv:Math.round((Number(x.regels) || 0) / max * 100), pg:Math.round((Number(x.gemiddeld) || 0) / max * 100) }));
}
const api = { minutenOud, leeftijd, versheid, nf, tegelsNu, vloerLijst, afwijkingTellers, watNaam, staafjes, WAT };
if(typeof module !== 'undefined' && module.exports) module.exports = api; else g.WHKM = api;
})(typeof window !== 'undefined' ? window : globalThis);
