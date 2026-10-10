/* =====================================================================
   IVOL Warehouse Ploeg — één scherm per rol, op de bestaande database en Picqer-koppeling.
   Rijder doet (verplaatsen), Kate/Salah coördineren en controleren, Karin administreert,
   pickers picken en melden alleen, Daan ziet de regie.
   Alleen lezen in Picqer. Eigen stand in catalog-rij `wh-ploeg`:
     v:<dag>:<nu|ronde>:<code>  verplaatsing gemeld door de rijder  { wie, op, aantal }
     m:<id>                     melding                                { wie, rol, op, code, loc, reden, noot, klaar:{wie,op,antw} }
     k:<dag>:<code>             controle door coördinator              { wie, op, uitkomst }
     c:<dag>:<rol>:<punt>       vinkje dagritme                        { wie, op }
   "Verwerk backorders gedaan" deelt de sleutel dg:<dag>:verwerk in `wh-taken` met Junior.
   ===================================================================== */
window.WHP = (function(){
'use strict';
const { $, esc, nf, D, vandaag, isoDag, toast } = WH;
const app = $('app');
const KEY = 'wh-ploeg';
const P = { d:{}, tijd:0, fout:null, geladen:false };
const UI = { rol:null, naam:'', open:null, taal:'nl', gang:'', meldOk:0 };

const ROLLEN = {
  valerii:{ naam:'Valerii', soort:'rijder', titel:'Rijder' },
  rijder:{ naam:'', soort:'rijder', titel:'Rijder' },
  kate:{ naam:'Kate', soort:'coord', titel:'Coördinator' },
  salah:{ naam:'Salah', soort:'coord', titel:'Coördinator' },
  karin:{ naam:'Karin', soort:'admin', titel:'Administratie' },
  picker:{ naam:'', soort:'picker', titel:'Picker' },
  daan:{ naam:'Daan', soort:'regie', titel:'Regie' }
};
const ls = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ if(v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} };
const rol = () => ROLLEN[UI.rol] || null;
const wie = () => { const r = rol(); return (r && r.naam) || UI.naam || (r ? r.titel : ''); };
const dag = () => vandaag();
const tijd = iso => iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' }) : '';
const dagTijd = iso => { if(!iso) return ''; const d = new Date(String(iso).replace(' ', 'T')); if(isNaN(d)) return String(iso); return isoDag(d) === dag() ? tijd(d) : d.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) + ' ' + tijd(d); };
const minOud = iso => iso ? (Date.now() - new Date(iso).getTime()) / 6e4 : 0;
const nieuwId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- eigen stand (wh-ploeg) ---------- */
async function laadPloeg(){
  try{
    const rows = window.WHC ? await WHC.catalog([KEY, 'wh-taken']) : await WH.api('GET', 'catalog?key=in.(%22' + KEY + '%22,%22wh-taken%22)&select=key,data,updated_at');
    (rows || []).forEach(r => { if(r.key === KEY) P.d = r.data || {}; if(r.key === 'wh-taken') D.TAKEN = r.data || {}; });
    P.tijd = Date.now(); P.fout = null; P.geladen = true;
  }catch(e){ P.fout = e; P.geladen = true; }
}
async function zet(patch){
  Object.entries(patch).forEach(([k, v]) => { if(v === null) delete P.d[k]; else P.d[k] = v; });
  teken(true);
  try{ P.d = await WH.catPatch(KEY, patch); P.tijd = Date.now(); }catch(e){ /* melding al getoond */ }
  teken(true);
}
const perVoorvoegsel = pre => Object.keys(P.d).filter(k => k.startsWith(pre)).map(k => Object.assign({ k }, P.d[k]));

/* ---------- live uit Picqer (bestaande modules) ---------- */
const LV = () => WHLIVE.status();
const isLive = () => { const s = LV(); return !!(s.code && s.klaar && !s.fout); };
const nuLijst = () => isLive() ? WHLIVE.nuLijst() : [];
const rondeLijst = () => (WHAL.S.st && WHAL.S.st.p ? WHAL.rondeLijst() : null) || [];
const vk = (soort, code) => 'v:' + dag() + ':' + soort + ':' + code;
const verwerkOp = () => { const x = (D.TAKEN || {})['dg:' + dag() + ':verwerk']; return x && x.op ? x.op : null; };
// status van een klant-wacht-regel die Picqer nog op bulk ziet
function nuStatus(code){
  const v = P.d[vk('nu', code)];
  if(!v) return 'open';
  const vw = verwerkOp();
  return vw && vw > v.op ? 'nogopen' : 'gemeld';
}
function rondeStatus(code){
  const v = P.d[vk('ronde', code)];
  if(!v) return 'open';
  return minOud(v.op) > 60 ? 'nogopen' : 'gemeld';
}
// alles wat de coördinatoren en Daan moeten zien
function stand(){
  const N = nuLijst(), R = rondeLijst();
  const nuCodes = new Set(N.map(m => m.code)), rCodes = new Set(R.map(r => r.code));
  const nu = { open:[], gemeld:[], nogopen:[] };
  N.forEach(m => nu[nuStatus(m.code)].push(m));
  const rd = { open:[], gemeld:[], nogopen:[] };
  R.forEach(r => rd[rondeStatus(r.code)].push(r));
  const vNu = perVoorvoegsel('v:' + dag() + ':nu:'), vRd = perVoorvoegsel('v:' + dag() + ':ronde:');
  const klaarNu = isLive() ? vNu.filter(v => !nuCodes.has(v.k.split(':').pop())) : [];
  const klaarRd = R.length || (WHAL.S.st && WHAL.S.st.p) ? vRd.filter(v => !rCodes.has(v.k.split(':').pop())) : [];
  const meld = perVoorvoegsel('m:').sort((a, b) => String(a.op).localeCompare(String(b.op)));
  const meldOpen = meld.filter(m => !m.klaar);
  const meldVandaag = meld.filter(m => isoDag(m.op) === dag());
  const ctrl = c => P.d['k:' + dag() + ':' + c];
  const nogOpen = nu.nogopen.filter(m => !ctrl(m.code)).concat(rd.nogopen.filter(r => !ctrl(r.code)).map(r => Object.assign({ ronde:true }, r)));
  const pl = LV().data ? WHLIVE.picklijstCijfers(LV().data.picklijsten) : null;
  const B = LV().data ? WHLIVE.backorderCijfers(LV().data.backorders) : null;
  return { N, R, nu, rd, klaarNu, klaarRd, meld, meldOpen, meldVandaag, nogOpen, pl, B };
}
function containers(dagen){
  const tot = new Date(); tot.setDate(tot.getDate() + dagen);
  const t = isoDag(tot), v = dag();
  return (D.CONT || []).filter(c => c.status !== 'afgerond').map(c => Object.assign({ dat:c.losdatum || '' }, c))
    .filter(c => c.dat && c.dat >= v && c.dat <= t).sort((a, b) => String(a.dat).localeCompare(String(b.dat)));
}

/* ---------- bouwstenen ---------- */
const locs = (arr, soort) => (arr || []).length ? arr.map(l => `<span class="loc ${soort}">${esc(l)}</span>`).join(' ') : '';
const leeg = t => `<div class="leeg">${esc(t)}</div>`;
const kaart = (titel, inhoud, extra) => `<section class="kaart ${extra || ''}"><h2>${titel}</h2>${inhoud}</section>`;
const tegel = (n, lbl, cls) => `<div class="tegel ${cls || ''}"><b>${n == null ? '–' : nf(n)}</b><span>${esc(lbl)}</span></div>`;
function liveRegel(){
  const s = LV();
  if(!s.code) return '';
  if(s.fout) return `<div class="melding fout">Picqer: ${esc(s.fout.message)}</div>`;
  const st = WHAL.S.st && WHAL.S.st.bijgewerkt;
  return `<div class="bron">Picqer live${s.data ? ' · ' + esc(tijd(s.data.binnen)) : ''}${s.laden || s.prodLaden ? ' · ophalen…' : ''}${st ? ' · aanvulstand ' + esc(dagTijd(st)) : ''}${WHAL.S.bezig ? ' · aanvulstand bijwerken…' : ''}</div>`;
}
function koppelKaart(){
  if(LV().code) return '';
  return kaart('Koppelen met Picqer', `<p class="muted">Eén keer per apparaat. De koppelcode heeft Daan.</p>
    <div class="rij mt"><input id="p-code" type="password" autocomplete="off" placeholder="koppelcode"><button class="knop pri" data-a="koppel">Koppelen</button></div>`);
}

/* ---------- kies je rol ---------- */
function viewKies(){
  const k = (id, sub) => `<button class="rolknop" data-a="rol" data-r="${id}"><b>${esc(ROLLEN[id].naam || ROLLEN[id].titel)}</b><span>${esc(sub)}</span></button>`;
  return `<section class="kaart"><h2>Wie ben je?</h2><p class="muted">Dit apparaat onthoudt je keuze. Wisselen kan rechtsboven.</p>
    <div class="rollen mt">
      ${k('valerii', 'Rijder · verplaatsen en aanvullen')}
      ${k('rijder', 'Andere rijder')}
      ${k('kate', 'Coördinator · orders eruit')}
      ${k('salah', 'Coördinator · orders eruit')}
      ${k('karin', 'Administratie · ontvangsten en VST')}
      ${k('picker', 'Picker · iets melden')}
      ${k('daan', 'Regie · alles in één oogopslag')}
    </div></section>`;
}

/* ---------- RIJDER: doen ---------- */
const REDEN_RIJ = ['Bulk is leeg', 'Te weinig op bulk', 'Past niet op de picklocatie', 'Product niet gevonden', 'Andere reden'];
function luktNiet(key, code, loc){
  if(UI.open !== key) return '';
  return `<div class="lukt" data-lukt="${esc(key)}">
    <div class="keuzes">${REDEN_RIJ.map((r, i) => `<label><input type="radio" name="r-${esc(key)}" value="${i}"> ${esc(r)}</label>`).join('')}</div>
    <input class="noot" placeholder="Toelichting (mag leeg)">
    <div class="rij"><button class="knop pri" data-a="lukt-op" data-k="${esc(key)}" data-c="${esc(code)}" data-l="${esc(loc || '')}">Melden aan Kate en Salah</button><button class="knop" data-a="sluit">Annuleren</button></div></div>`;
}
function taakRij(soort, code, naam, van, naar, aantal, meta){
  const st = soort === 'nu' ? nuStatus(code) : rondeStatus(code);
  const v = P.d[vk(soort, code)];
  const key = soort + ':' + code;
  const naarTxt = naar && naar.length ? locs(naar, 'pick') : `<span class="geenloc">geen picklocatie · naar geen specifieke locatie</span>`;
  let knoppen;
  if(st === 'open') knoppen = `<button class="knop pri groot" data-a="verpl" data-s="${soort}" data-c="${esc(code)}" data-n="${aantal}">Verplaatst</button><button class="knop" data-a="lukt" data-k="${esc(key)}">Lukt niet</button>`;
  else if(st === 'gemeld') knoppen = `<span class="st gemeld">Verplaatst om ${esc(tijd(v.op))}${soort === 'nu' ? ' · wacht op Verwerk backorders' : ''}</span><button class="knop klein" data-a="verpl-uit" data-s="${soort}" data-c="${esc(code)}">Ongedaan</button>`;
  else knoppen = `<span class="st rood">Picqer ziet het nog op bulk. Kate of Salah kijkt mee.</span>`;
  return `<div class="taak st-${st}">
    <div class="t-hoofd"><div><b class="code">${esc(code)}</b> <span class="naam">${esc(naam || '')}</span></div><div class="aantal">${nf(aantal)}<small>stuks</small></div></div>
    <div class="route"><span class="lbl">van</span> ${locs(van, 'bulk') || '<span class="geenloc">?</span>'} <span class="pijl">→</span> <span class="lbl">naar</span> ${naarTxt}</div>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
    <div class="rij acties">${knoppen}</div>
    ${luktNiet(key, code, (van || [])[0])}
  </div>`;
}
function viewRijder(){
  const S = stand();
  let h = rol().naam ? '' : `<section class="kaart"><label class="naamveld">Je naam<input id="p-naam" value="${esc(UI.naam)}" autocomplete="name"></label></section>`;
  h += koppelKaart();
  if(!LV().code) return h;
  if(!isLive() && !LV().fout) h += `<section class="kaart">${leeg('Ophalen uit Picqer…')}</section>`;
  const nuRegels = S.nu.open.concat(S.nu.gemeld, S.nu.nogopen);
  h += kaart(`Klant wacht <span class="nr ${S.nu.open.length ? 'hot' : ''}">${S.nu.open.length}</span>`,
    `<p class="muted">Deze orders zijn verder compleet. Alleen deze verplaatsing houdt ze tegen. Oudste eerst.</p>` +
    (nuRegels.length ? nuRegels.map(m => taakRij('nu', m.code, m.naam, m.van, m.naar, m.verpl,
      `${m.orders.length} ${m.orders.length === 1 ? 'order' : 'orders'} · oudste ${esc(dagTijd(m.datum))} · op pick nu ${nf(m.pickst)}`)).join('') : leeg(isLive() ? 'Niets. Geen order wacht op een verplaatsing.' : '')));
  const R = S.rd.open.concat(S.rd.gemeld, S.rd.nogopen);
  const gangen = [...new Set(R.map(r => r.gang).filter(Boolean))].sort();
  const RG = UI.gang ? R.filter(r => r.gang === UI.gang) : R;
  h += kaart(`Aanvulronde <span class="nr">${S.rd.open.length}</span>`,
    `<p class="muted">Pick onder het niveau. Per gang, in looproute. Pas na Klant wacht.</p>
     ${gangen.length > 1 ? `<div class="chips"><button class="chip ${UI.gang ? '' : 'aan'}" data-a="gang" data-g="">Alle</button>${gangen.map(g => `<button class="chip ${UI.gang === g ? 'aan' : ''}" data-a="gang" data-g="${esc(g)}">${esc(g)} <small>${R.filter(r => r.gang === g && rondeStatus(r.code) === 'open').length}</small></button>`).join('')}</div>` : ''}` +
    (RG.length ? RG.map(r => taakRij('ronde', r.code, r.naam, r.bulk, r.pick, r.aantal, `op pick nu ${nf(r.pickst)} · aanvullen onder ${nf(r.lvl)} · tot ${nf(r.tot)}`)).join('')
      : leeg(WHAL.S.st ? 'Niets onder het niveau.' : 'Aanvulstand wordt opgehaald…')));
  const klaar = S.klaarNu.length + S.klaarRd.length;
  if(klaar) h += kaart('Vandaag klaar', `<p class="muted">${nf(klaar)} verplaatsingen gemeld en door Picqer bevestigd.</p>`, 'stil');
  return h;
}

/* ---------- COÖRDINATOR: orders eruit, controleren ---------- */
const UITKOMST = ['Klopt nu', 'Voorraad klopt niet: tellen', 'Doorgezet naar Daan'];
function meldRij(m, voorCoord){
  const oud = minOud(m.op) > 120 && !m.klaar;
  const open = UI.open === m.k;
  return `<div class="taak ${m.klaar ? 'st-klaar' : oud ? 'st-nogopen' : 'st-open'}">
    <div class="t-hoofd"><div><b>${esc(m.reden || 'Melding')}</b> <span class="naam">${esc(m.wie || '')} · ${esc(m.rol || '')} · ${esc(dagTijd(m.op))}</span></div>${oud ? '<span class="badge rood">langer dan 2 uur</span>' : ''}</div>
    <div class="route">${m.code ? `<b class="code">${esc(m.code)}</b> <span class="naam">${esc((D.P[m.code] || {}).naam || '')}</span>` : ''} ${m.loc ? locs([m.loc], '') : ''}</div>
    ${m.noot ? `<div class="meta">“${esc(m.noot)}”</div>` : ''}
    ${m.klaar ? `<div class="meta">Opgelost door ${esc(m.klaar.wie)} om ${esc(tijd(m.klaar.op))}${m.klaar.antw ? ': ' + esc(m.klaar.antw) : ''}</div>`
      : voorCoord ? (open ? `<div class="lukt"><input class="noot" id="antw-${esc(m.k)}" placeholder="Wat heb je gedaan? (mag leeg)"><div class="rij"><button class="knop pri" data-a="meld-klaar" data-k="${esc(m.k)}">Opgelost</button><button class="knop" data-a="sluit">Annuleren</button></div></div>`
        : `<div class="rij acties"><button class="knop" data-a="open" data-k="${esc(m.k)}">Oplossen</button></div>`) : ''}
  </div>`;
}
function viewCoord(){
  const S = stand();
  let h = koppelKaart();
  const pl = S.pl;
  h += `<div class="tegels">
    ${tegel(pl && pl.open, 'picklijsten open')}
    ${tegel(pl && pl.urgent, 'urgent', pl && pl.urgent ? 'warn' : '')}
    ${tegel(pl && pl.o12, 'ouder dan 12 uur', pl && pl.o12 ? 'rood' : '')}
    ${tegel(pl && pl.gepauzeerd, 'gepauzeerd', pl && pl.gepauzeerd ? 'warn' : '')}
    ${tegel(S.nu.open.length + S.nu.gemeld.length, 'orders wachten op verplaatsen', S.nu.open.length ? 'warn' : '')}
    ${tegel(S.meldOpen.length, 'meldingen open', S.meldOpen.length ? 'rood' : '')}
  </div>`;
  // 1. verwerk backorders
  const vw = verwerkOp();
  const gemeld = S.nu.gemeld;
  h += kaart('1 · Verwerk backorders',
    gemeld.length
      ? `<p><b>${nf(gemeld.length)}</b> verplaatsingen gemeld door de rijder${vw ? ' sinds ' + esc(tijd(vw)) : ''}: ${gemeld.slice(0, 8).map(m => `<span class="code">${esc(m.code)}</span>`).join(', ')}${gemeld.length > 8 ? ' …' : ''}</p>
         <p class="muted">Picqer → Backorders → Verwerk backorders. Tik daarna hieronder.</p>
         <div class="rij mt"><button class="knop pri groot" data-a="verwerk">Verwerk backorders gedaan</button></div>`
      : `<p class="muted">${vw ? 'Laatst verwerkt om ' + esc(tijd(vw)) + '. ' : ''}Niets nieuws van de rijder.</p>${vw ? '' : `<div class="rij mt"><button class="knop" data-a="verwerk">Verwerk backorders gedaan</button></div>`}`,
    gemeld.length ? 'actie' : '');
  // 2. nog open na verplaatsen
  h += kaart(`2 · Klopt niet na verplaatsen <span class="nr ${S.nogOpen.length ? 'hot' : ''}">${S.nogOpen.length}</span>`,
    S.nogOpen.length ? `<p class="muted">De rijder meldde verplaatst, maar Picqer ziet het nog op bulk of onder het niveau. Ga kijken.</p>` + S.nogOpen.map(m => {
      const v = P.d[vk(m.ronde ? 'ronde' : 'nu', m.code)] || {};
      const open = UI.open === 'k:' + m.code;
      return `<div class="taak st-nogopen"><div class="t-hoofd"><div><b class="code">${esc(m.code)}</b> <span class="naam">${esc(m.naam || '')}</span></div><span class="badge">${m.ronde ? 'aanvulronde' : 'klant wacht'}</span></div>
        <div class="route"><span class="lbl">van</span> ${locs(m.ronde ? m.bulk : m.van, 'bulk')} <span class="pijl">→</span> ${locs(m.ronde ? m.pick : m.naar, 'pick') || '<span class="geenloc">geen picklocatie</span>'}</div>
        <div class="meta">Gemeld door ${esc(v.wie || '?')} om ${esc(tijd(v.op))}</div>
        ${open ? `<div class="lukt"><div class="keuzes">${UITKOMST.map((u, i) => `<button class="knop" data-a="ctrl" data-c="${esc(m.code)}" data-u="${i}">${esc(u)}</button>`).join('')}</div><button class="knop klein" data-a="sluit">Annuleren</button></div>`
          : `<div class="rij acties"><button class="knop" data-a="open" data-k="k:${esc(m.code)}">Gecontroleerd</button></div>`}</div>`;
    }).join('') : leeg('Alles wat de rijder meldde, klopt in Picqer.'), S.nogOpen.length ? 'actie' : '');
  // 3. meldingen
  h += kaart(`3 · Meldingen <span class="nr ${S.meldOpen.length ? 'hot' : ''}">${S.meldOpen.length}</span>`,
    S.meldOpen.length ? S.meldOpen.map(m => meldRij(m, true)).join('') : leeg('Geen open meldingen.'), S.meldOpen.length ? 'actie' : '');
  // rijder in één oogopslag
  const perGang = {};
  S.rd.open.forEach(r => perGang[r.gang || '?'] = (perGang[r.gang || '?'] || 0) + 1);
  h += kaart('Rijder', `<div class="tegels klein">${tegel(S.nu.open.length, 'klant wacht open', S.nu.open.length ? 'warn' : '')}${tegel(S.nu.gemeld.length, 'gemeld, nog verwerken')}${tegel(S.klaarNu.length, 'klant wacht klaar', 'ok')}${tegel(S.rd.open.length, 'aanvulronde open')}</div>
    ${Object.keys(perGang).length ? `<div class="chips mt">${Object.keys(perGang).sort().map(g => `<span class="chip">${esc(g)} <small>${perGang[g]}</small></span>`).join('')}</div>` : ''}`);
  // gepauzeerde picklijsten
  const pauze = LV().data ? LV().data.picklijsten.filter(p => p.s === 'paused') : [];
  if(pauze.length) h += kaart(`Gepauzeerde picklijsten <span class="nr">${pauze.length}</span>`,
    `<div class="tabel"><table><thead><tr><th>Picklijst</th><th>Reden</th><th>Wie</th><th>Sinds</th></tr></thead><tbody>${pauze.slice(0, 40).map(p => `<tr><td><a href="https://ivol.picqer.com/picklists/${p.id}" target="_blank" rel="noopener">${esc(p.nr)}</a></td><td>${esc(p.pauze || '–')}</td><td>${esc(p.wie || '')}</td><td>${esc(dagTijd(p.c))}</td></tr>`).join('')}</tbody></table></div>`);
  h += containerKaart(7, 'coord');
  const klaarM = S.meldVandaag.filter(m => m.klaar);
  if(klaarM.length) h += kaart('Vandaag opgelost', klaarM.map(m => meldRij(m, false)).join(''), 'stil');
  return h;
}
function containerKaart(dagen, voor){
  const C = containers(dagen);
  const uitleg = voor === 'admin' ? 'Opboeken door Jim, Stockmove op de losdag, VST-stickers naar Kate.' : 'Plan, werkbon en palletlabels staan in Containers.';
  return kaart(`Containers komende ${dagen} dagen <span class="nr">${C.length}</span>`,
    C.length ? `<p class="muted">${esc(uitleg)}</p><div class="tabel"><table><thead><tr><th>Datum</th><th>Leverancier</th><th>Container</th><th>Status</th></tr></thead><tbody>${C.map(c => `<tr><td>${esc(dagTijd(c.dat + 'T12:00'))}${c.verwacht ? ' <span class="badge">verwacht</span>' : c.lostijd ? ' ' + esc(String(c.lostijd).slice(0, 5)) : ''}</td><td>${esc(c.leverancier || '')}</td><td class="code">${esc(c.containernummer || c.pakbon_ref || '')}</td><td>${esc(c.status || '')}</td></tr>`).join('')}</tbody></table></div><div class="rij mt"><a class="knop" href="containerplanning.html" target="_blank" rel="noopener">Containers openen ↗</a></div>`
      : leeg('Geen containers in deze periode.'));
}

/* ---------- KARIN: administratie ---------- */
const KARIN_PUNTEN = [
  ['bevest', 'Orderbevestigingen nagelopen, levertijden bijgewerkt'],
  ['ontv', 'Ontvangsten van vandaag opgeboekt op geen specifieke locatie'],
  ['verwerk', 'Na het opboeken: Verwerk backorders in Picqer'],
  ['vst', 'VST-terughaalmail naar Edwin verstuurd (lijst hieronder)']
];
function vinkLijst(soort, punten){
  return `<div class="vinken">${punten.map(([id, t]) => {
    const k = 'c:' + dag() + ':' + soort + ':' + id, v = P.d[k];
    return `<button class="vink ${v ? 'aan' : ''}" data-a="vink" data-k="${esc(k)}"><span class="box">${v ? '✓' : ''}</span><span>${esc(t)}${v ? ` <small>${esc(v.wie)} · ${esc(tijd(v.op))}</small>` : ''}</span></button>`;
  }).join('')}</div>`;
}
function vstMail(V){
  const regels = V.producten.map(p => `${p.code}\t${p.nodig}\t${p.naam}`).join('\n');
  return `Hoi Edwin,\n\nGraag de volgende producten terug naar IVOL Veldhoven:\n\nProductcode\tAantal\tOmschrijving\n${regels}\n\nAlvast bedankt.\n\nMet vriendelijke groet,\n${wie() || 'Karin'}\nIVOL`;
}
function viewKarin(){
  let h = koppelKaart();
  h += kaart('Vandaag', vinkLijst('karin', KARIN_PUNTEN));
  const V = WHAL.vanVst();
  h += kaart(`Terughalen van VST <span class="nr ${V && V.producten.length ? 'hot' : ''}">${V ? V.producten.length : '–'}</span>`,
    !V ? leeg(LV().code ? 'Wordt opgehaald…' : 'Eerst koppelen met Picqer.')
      : V.producten.length ? `<p class="muted">Deze orders worden compleet met voorraad die op VST staat (${nf(V.orders.length)} orders).</p>
        <div class="tabel"><table><thead><tr><th>Product</th><th class="n">Nodig</th><th class="n">Op VST</th><th class="n">Orders</th><th>Oudste</th></tr></thead><tbody>${V.producten.map(p => `<tr><td><b class="code">${esc(p.code)}</b><br><span class="naam">${esc(p.naam)}</span></td><td class="n">${nf(p.nodig)}</td><td class="n">${nf(p.vst)}</td><td class="n">${p.orders.length}</td><td>${esc(dagTijd(p.oudste))}</td></tr>`).join('')}</tbody></table></div>
        <textarea id="vst-mail" class="mail" readonly>${esc(vstMail(V))}</textarea>
        <div class="rij mt"><button class="knop pri" data-a="kopieer" data-id="vst-mail">Mail kopiëren</button></div>`
      : leeg('Niets terug te halen: geen order wacht op VST-voorraad.'));
  h += containerKaart(7, 'admin');
  return h;
}

/* ---------- PICKER: alleen melden (4 talen) ---------- */
const PT = {
  nl:{ titel:'Iets melden', uitleg:'Klopt er iets niet bij het picken? Meld het hier. Kate of Salah lost het op.', naam:'Je naam', code:'Productcode of barcode', loc:'Locatie', wat:'Wat is er?',
    r:['Locatie leeg', 'Te weinig voor de picklijst', 'Ander product op de locatie', 'Kapot', 'Anders'], noot:'Toelichting (mag leeg)', knop:'Melden', ok:'Gemeld. Ga door met picken.',
    mist:'Vul een productcode of locatie in en kies wat er is.', vandaag:'Jouw meldingen vandaag', open:'open', klaar:'opgelost' },
  en:{ titel:'Report a problem', uitleg:'Something wrong while picking? Report it here. Kate or Salah will fix it.', naam:'Your name', code:'Product code or barcode', loc:'Location', wat:'What is wrong?',
    r:['Location empty', 'Not enough for the picklist', 'Wrong product on the location', 'Damaged', 'Other'], noot:'Note (optional)', knop:'Report', ok:'Reported. Carry on picking.',
    mist:'Fill in a product code or location and choose what is wrong.', vandaag:'Your reports today', open:'open', klaar:'solved' },
  es:{ titel:'Avisar de un problema', uitleg:'¿Algo no está bien al preparar pedidos? Avisa aquí. Kate o Salah lo resolverán.', naam:'Tu nombre', code:'Código de producto o código de barras', loc:'Ubicación', wat:'¿Qué pasa?',
    r:['Ubicación vacía', 'No hay suficiente para la lista', 'Otro producto en la ubicación', 'Dañado', 'Otro'], noot:'Nota (opcional)', knop:'Avisar', ok:'Aviso enviado. Sigue preparando.',
    mist:'Rellena un código o una ubicación y elige qué pasa.', vandaag:'Tus avisos de hoy', open:'abierto', klaar:'resuelto' },
  el:{ titel:'Αναφορά προβλήματος', uitleg:'Κάτι δεν πάει καλά στη συλλογή; Αναφέρετέ το εδώ. Η Kate ή ο Salah θα το λύσουν.', naam:'Το όνομά σας', code:'Κωδικός προϊόντος ή barcode', loc:'Θέση', wat:'Τι συμβαίνει;',
    r:['Άδεια θέση', 'Δεν φτάνει για τη λίστα', 'Άλλο προϊόν στη θέση', 'Χαλασμένο', 'Άλλο'], noot:'Σημείωση (προαιρετικό)', knop:'Αποστολή', ok:'Στάλθηκε. Συνεχίστε τη συλλογή.',
    mist:'Συμπληρώστε κωδικό ή θέση και επιλέξτε τι συμβαίνει.', vandaag:'Οι αναφορές σας σήμερα', open:'ανοιχτό', klaar:'λύθηκε' }
};
function viewPicker(){
  const t = PT[UI.taal] || PT.nl;
  const mijn = (ls('ploeg-mijn') || '').split(',').filter(Boolean);
  const mijnM = mijn.map(id => P.d['m:' + id] ? Object.assign({ k:id }, P.d['m:' + id]) : null).filter(m => m && isoDag(m.op) === dag());
  return `<div class="talen">${['nl', 'en', 'es', 'el'].map(l => `<button class="${UI.taal === l ? 'aan' : ''}" data-a="taal" data-t="${l}">${l.toUpperCase()}</button>`).join('')}</div>
  <section class="kaart"><h2>${esc(t.titel)}</h2><p class="muted">${esc(t.uitleg)}</p>
    ${UI.meldOk && Date.now() - UI.meldOk < 8000 ? `<div class="melding ok">${esc(t.ok)}</div>` : ''}
    <div class="form mt">
      <label>${esc(t.naam)}<input id="pk-naam" value="${esc(UI.naam)}" autocomplete="name"></label>
      <label>${esc(t.code)}<input id="pk-code" autocomplete="off" autocapitalize="characters"></label>
      <label>${esc(t.loc)}<input id="pk-loc" autocomplete="off" autocapitalize="characters"></label>
      <fieldset><legend>${esc(t.wat)}</legend>${t.r.map((r, i) => `<label class="radio"><input type="radio" name="pk-r" value="${i}"> ${esc(r)}</label>`).join('')}</fieldset>
      <label>${esc(t.noot)}<input id="pk-noot" autocomplete="off"></label>
      <button class="knop pri groot" data-a="pick-meld">${esc(t.knop)}</button>
    </div></section>
  ${mijnM.length ? `<section class="kaart"><h2>${esc(t.vandaag)}</h2>${mijnM.map(m => `<div class="taak ${m.klaar ? 'st-klaar' : 'st-open'}"><div class="t-hoofd"><div><b>${esc(m.code || m.loc || '')}</b> <span class="naam">${esc(tijd(m.op))}</span></div><span class="badge ${m.klaar ? 'groen' : ''}">${esc(m.klaar ? t.klaar : t.open)}</span></div></div>`).join('')}</section>` : ''}`;
}

/* ---------- DAAN: regie ---------- */
function viewRegie(){
  const S = stand();
  let h = koppelKaart();
  const vw = verwerkOp();
  const karinV = KARIN_PUNTEN.filter(([id]) => P.d['c:' + dag() + ':karin:' + id]).length;
  const afw = [];
  S.nogOpen.forEach(m => afw.push({ wie:'Kate / Salah', t:`${m.code}: rijder meldde verplaatst, Picqer ziet het nog op bulk`, cls:'rood' }));
  S.meldOpen.filter(m => minOud(m.op) > 120).forEach(m => afw.push({ wie:'Kate / Salah', t:`Melding ${m.reden || ''} ${m.code || m.loc || ''} van ${m.wie || '?'} staat al sinds ${dagTijd(m.op)} open`, cls:'rood' }));
  if(S.nu.gemeld.length && S.nu.gemeld.some(m => minOud((P.d[vk('nu', m.code)] || {}).op) > 30)) afw.push({ wie:'Kate / Salah', t:`${S.nu.gemeld.length} verplaatsingen wachten langer dan 30 minuten op Verwerk backorders`, cls:'warn' });
  if(S.pl && S.pl.o24) afw.push({ wie:'Kate / Salah', t:`${S.pl.o24} picklijsten zijn ouder dan 24 uur`, cls:'rood' });
  if(S.nu.open.length && S.nu.open.some(m => minOud(m.datum) > 240)) afw.push({ wie:'Rijder', t:`Klant wacht: ${S.nu.open.filter(m => minOud(m.datum) > 240).length} producten houden orders langer dan 4 uur tegen`, cls:'warn' });
  h += `<div class="tegels">
    ${tegel(S.nu.open.length, 'klant wacht, nog niet verplaatst', S.nu.open.length ? 'warn' : 'ok')}
    ${tegel(S.nogOpen.length, 'klopt niet na verplaatsen', S.nogOpen.length ? 'rood' : 'ok')}
    ${tegel(S.meldOpen.length, 'meldingen open', S.meldOpen.length ? 'rood' : 'ok')}
    ${tegel(S.pl && S.pl.o12, 'picklijsten ouder dan 12 uur', S.pl && S.pl.o12 ? 'rood' : 'ok')}
  </div>`;
  h += kaart(`Afwijkingen <span class="nr ${afw.length ? 'hot' : ''}">${afw.length}</span>`,
    afw.length ? `<div class="afw">${afw.map(a => `<div class="afwrij ${a.cls}"><span>${esc(a.t)}</span><b>${esc(a.wie)}</b></div>`).join('')}</div>` : leeg('Niets wijkt af. Alles loopt.'), afw.length ? 'actie' : '');
  h += kaart('Per rol', `<div class="tabel"><table><thead><tr><th>Wie</th><th>Doet</th><th>Stand nu</th></tr></thead><tbody>
    <tr><td><b>Rijder</b></td><td>Klant wacht, aanvulronde</td><td>${nf(S.nu.open.length)} klant wacht open · ${nf(S.rd.open.length)} aanvulronde open · ${nf(S.klaarNu.length + S.klaarRd.length)} klaar</td></tr>
    <tr><td><b>Kate · Salah</b></td><td>Verwerk backorders, controle, meldingen, picklijsten</td><td>${vw ? 'verwerkt ' + esc(tijd(vw)) : 'nog niet verwerkt'} · ${nf(S.nu.gemeld.length)} wachten op verwerken · ${nf(S.meldOpen.length)} meldingen open</td></tr>
    <tr><td><b>Karin</b></td><td>Bevestigingen, ontvangsten, VST</td><td>${karinV} van ${KARIN_PUNTEN.length} afgevinkt</td></tr>
    <tr><td><b>Pickers</b></td><td>Picken, melden</td><td>${nf(S.meldVandaag.length)} meldingen vandaag</td></tr>
  </tbody></table></div>`);
  if(S.B) h += kaart('Backorders', `<div class="tegels klein">${tegel(S.B.orders, 'orders in backorder')}${tegel(S.B.vol, 'compleet zodra verplaatst', S.B.vol ? 'warn' : 'ok')}${tegel(S.B.wacht, 'wachten op inkoop of meer')}</div>`);
  h += containerKaart(14, 'coord');
  return h;
}

/* ---------- tekenen ---------- */
function bezigMetTypen(){ const e = document.activeElement; return !!(e && /INPUT|TEXTAREA|SELECT/.test(e.tagName) && e.closest && e.closest('#app') && !e.readOnly); }
let uitgesteld = false;
function teken(forceer){
  if(!forceer && bezigMetTypen()){ uitgesteld = true; return; }
  uitgesteld = false;
  const r = rol();
  const knop = $('wie');
  if(knop) knop.textContent = r ? (wie() + ' · ' + r.titel) : 'Kies je rol';
  const y = window.scrollY;
  let h;
  try{
    if(!r) h = viewKies();
    else if(D.fout) h = kaart('Geen verbinding met de database', `<p class="muted">${esc(D.fout.message || '')}</p>`);
    else {
      const dagNaam = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });
      h = r.soort === 'picker' ? '' : `<div class="dagkop"><h1>${esc(dagNaam.charAt(0).toUpperCase() + dagNaam.slice(1))}</h1>${liveRegel()}</div>`;
      if(P.fout) h += `<div class="melding fout">Stand ophalen mislukt: ${esc(P.fout.message)}</div>`;
      h += r.soort === 'rijder' ? viewRijder() : r.soort === 'coord' ? viewCoord() : r.soort === 'admin' ? viewKarin() : r.soort === 'picker' ? viewPicker() : viewRegie();
    }
  }catch(e){ console.error(e); h = kaart('Er ging iets mis', `<pre>${esc(e.stack || e.message)}</pre>`); }
  app.innerHTML = h;
  window.scrollTo(0, y);
}
document.addEventListener('focusout', () => setTimeout(() => { if(uitgesteld && !bezigMetTypen()) teken(); }, 200));

/* ---------- acties ---------- */
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-a]'); if(!b) return;
  const a = b.dataset.a;
  if(a === 'rol'){
    UI.rol = b.dataset.r; lsZet('ploeg-rol', UI.rol);
    UI.open = null; teken(true); window.scrollTo(0, 0); return;
  }
  if(a === 'wissel'){ UI.rol = null; lsZet('ploeg-rol', null); teken(true); window.scrollTo(0, 0); return; }
  if(a === 'ververs'){ await vernieuw(true); return; }
  if(a === 'koppel'){ const v = (($('p-code') || {}).value || '').trim(); if(!v) return; WHLIVE.zetCode(v); WHLIVE.laad(true); WHAL.ververs(10); teken(true); return; }
  if(a === 'gang'){ UI.gang = b.dataset.g || ''; teken(true); return; }
  if(a === 'sluit'){ UI.open = null; teken(true); return; }
  if(a === 'open' || a === 'lukt'){ UI.open = b.dataset.k; teken(true); return; }
  if(a === 'verpl'){
    const k = vk(b.dataset.s, b.dataset.c);
    await zet({ [k]:{ wie:wie(), op:new Date().toISOString(), aantal:Number(b.dataset.n) || null } });
    toast('Verplaatst gemeld'); return;
  }
  if(a === 'verpl-uit'){ await zet({ [vk(b.dataset.s, b.dataset.c)]:null }); return; }
  if(a === 'lukt-op'){
    const box = b.closest('.lukt'); const keuze = box.querySelector('input[type=radio]:checked');
    if(!keuze){ toast('Kies wat er is'); return; }
    const id = nieuwId();
    UI.open = null;
    await zet({ ['m:' + id]:{ wie:wie(), rol:'rijder', op:new Date().toISOString(), code:b.dataset.c, loc:b.dataset.l, reden:REDEN_RIJ[Number(keuze.value)], noot:box.querySelector('.noot').value.trim() } });
    toast('Gemeld aan Kate en Salah'); return;
  }
  if(a === 'meld-klaar'){
    const k = b.dataset.k, m = P.d[k]; if(!m) return;
    const antw = (($('antw-' + k) || {}).value || '').trim();
    UI.open = null;
    await zet({ [k]:Object.assign({}, m, { klaar:{ wie:wie(), op:new Date().toISOString(), antw } }) });
    return;
  }
  if(a === 'ctrl'){
    UI.open = null;
    await zet({ ['k:' + dag() + ':' + b.dataset.c]:{ wie:wie(), op:new Date().toISOString(), uitkomst:UITKOMST[Number(b.dataset.u)] } });
    return;
  }
  if(a === 'verwerk'){
    const k = 'dg:' + dag() + ':verwerk', v = { op:new Date().toISOString(), via:'ploeg', wie:wie() };
    D.TAKEN[k] = v; teken(true);
    try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){}
    toast('Verwerkt. Over een halve minuut haal ik Picqer opnieuw op.');
    setTimeout(() => WHLIVE.laad(true), 30000); return;
  }
  if(a === 'vink'){
    const k = b.dataset.k;
    await zet({ [k]:P.d[k] ? null : { wie:wie(), op:new Date().toISOString() } }); return;
  }
  if(a === 'kopieer'){
    const el = $(b.dataset.id); if(!el) return;
    try{ await navigator.clipboard.writeText(el.value); toast('Gekopieerd'); }
    catch(e){ el.focus(); el.select(); toast('Geselecteerd: kopieer met Cmd+C of Ctrl+C'); }
    return;
  }
  if(a === 'taal'){ UI.taal = b.dataset.t; lsZet('ploeg-taal', UI.taal); teken(true); return; }
  if(a === 'pick-meld'){
    const t = PT[UI.taal] || PT.nl;
    const naam = ($('pk-naam').value || '').trim(), code = ($('pk-code').value || '').trim(), loc = ($('pk-loc').value || '').trim().toUpperCase();
    const keuze = document.querySelector('input[name="pk-r"]:checked');
    if((!code && !loc) || !keuze){ toast(t.mist, 4000); return; }
    if(naam !== UI.naam){ UI.naam = naam; lsZet('ploeg-naam', naam); }
    const echt = WH.D.PLOW[code.toLowerCase()] || code;
    const id = nieuwId();
    const mijn = (ls('ploeg-mijn') || '').split(',').filter(Boolean).slice(-30); mijn.push(id); lsZet('ploeg-mijn', mijn.join(','));
    UI.meldOk = Date.now();
    await zet({ ['m:' + id]:{ wie:naam || 'picker', rol:'picker', op:new Date().toISOString(), code:echt, loc, reden:PT.nl.r[Number(keuze.value)], noot:($('pk-noot').value || '').trim() } });
    window.scrollTo(0, 0); return;
  }
});
document.addEventListener('change', ev => {
  if(ev.target && ev.target.id === 'p-naam'){ UI.naam = ev.target.value.trim(); lsZet('ploeg-naam', UI.naam); teken(true); }
});

/* ---------- vers houden ---------- */
async function vernieuw(alles){
  if(alles) await WH.load();
  await laadPloeg();
  if(LV().code){ WHLIVE.laad(true); WHAL.ververs(alles ? 1 : 10); }
  teken();
}
setInterval(() => {
  if(document.visibilityState !== 'visible') return;
  if(Date.now() - P.tijd > 90000) laadPloeg().then(() => teken());
  const s = LV();
  if(s.code && !s.laden && (!s.data || Date.now() - s.data.binnen > 120000)) WHLIVE.laad();
}, 30000);
setInterval(() => { if(document.visibilityState === 'visible' && LV().code && !WHAL.S.bezig) WHAL.ververs(10); }, 300000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && Date.now() - P.tijd > 60000) vernieuw(false); });
WHLIVE.opNieuw(() => teken());
WHAL.opNieuw(() => teken());

/* ---------- start ---------- */
async function start(){
  UI.rol = ROLLEN[ls('ploeg-rol')] ? ls('ploeg-rol') : null;
  UI.naam = ls('ploeg-naam') || '';
  UI.taal = ls('ploeg-taal') || 'nl';
  teken(true);
  await WH.load();
  await laadPloeg();
  teken(true);
  if(LV().code) WHLIVE.laad(true);
  await WHAL.laadOpslag();
  teken();
  if(LV().code) WHAL.ververs(10);
}
start();
return { P, UI, stand, teken };
})();
