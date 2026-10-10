/* =====================================================================
   IVOL Warehouse Ploeg — Daan legt één keer vast wie welke taak heeft, wie vervangt en in welke volgorde.
   Iedereen kiest alleen zijn naam; de app laat zien wat diegene vandaag moet doen.
   Pickers picken en melden alleen. Daan ziet de regie en beheert de indeling.
   Alleen lezen in Picqer. Eigen stand in catalog-rij `wh-ploeg`:
     cfg                        indeling { personen:[{id,naam}], taken:{ <taak>:{ eig, v1, v2 } }, volgorde:[taak…], door, op }
     a:<dag>                    afwezig vandaag { <persoon>:true }
     v:<dag>:<nu|ronde>:<code>  verplaatsing gemeld                  { wie, op, aantal }
     m:<id>                     melding                              { wie, rol, op, code, loc, reden, noot, klaar:{wie,op,antw} }
     k:<dag>:<code>             controle na verplaatsen              { wie, op, uitkomst }
     c:<dag>:<taak>             taak van vandaag afgevinkt           { wie, op }
   "Verwerk backorders gedaan" deelt de sleutel dg:<dag>:verwerk in `wh-taken` met Junior.
   ===================================================================== */
window.WHP = (function(){
'use strict';
const { $, esc, nf, D, vandaag, isoDag, toast } = WH;
const app = $('app');
const KEY = 'wh-ploeg';
const P = { d:{}, tijd:0, fout:null, geladen:false };
const UI = { ik:null, naam:'', open:null, taal:'nl', gang:'', meldOk:0, tab:'mijn', concept:null };

/* ---------- taken: wat er is (de indeling bepaalt bij wie) ---------- */
const TAKEN = {
  aanwezig:{ titel:'Wie is er vandaag', uit:'Afwezigen aanzetten. Hun taken gaan naar de vervanger.' },
  nu:{ titel:'Klant wacht: verplaatsen', uit:'Orders die verder compleet zijn. Alleen deze verplaatsing houdt ze tegen.' },
  verwerk:{ titel:'Verwerk backorders', uit:'Na elke gemelde verplaatsing: Picqer → Backorders → Verwerk backorders.' },
  ontv:{ titel:'Ontvangsten opboeken', uit:'Ontvangsten van vandaag op geen specifieke locatie, daarna Verwerk backorders.' },
  controle:{ titel:'Controle na verplaatsen', uit:'Gemeld als verplaatst, maar Picqer ziet het nog op bulk.' },
  meld:{ titel:'Meldingen oplossen', uit:'Wat pickers en rijders melden.' },
  pick:{ titel:'Picklijsten bewaken', uit:'Open, urgent, oud en gepauzeerd.' },
  ronde:{ titel:'Aanvulronde', uit:'Pick onder het niveau, per gang.' },
  vst:{ titel:'Terughalen van VST', uit:'Orders die compleet worden met VST-voorraad. Mail naar Edwin.' },
  bevest:{ titel:'Orderbevestigingen', uit:'Bevestigingen nalopen, levertijden bijwerken.' },
  cont:{ titel:'Containers komende 7 dagen', uit:'Plan, werkbon, labels, Stockmove op de losdag.' }
};
const STANDAARD = {
  personen:[{ id:'daan', naam:'Daan' }, { id:'kate', naam:'Kate' }, { id:'salah', naam:'Salah' }, { id:'karin', naam:'Karin' }, { id:'valerii', naam:'Valerii' }],
  taken:{
    aanwezig:{ eig:'kate', v1:'salah', v2:'daan' },
    nu:{ eig:'valerii', v1:'salah', v2:'kate' },
    verwerk:{ eig:'kate', v1:'salah', v2:'karin' },
    ontv:{ eig:'karin', v1:'kate', v2:'daan' },
    controle:{ eig:'salah', v1:'kate', v2:'daan' },
    meld:{ eig:'kate', v1:'salah', v2:'daan' },
    pick:{ eig:'salah', v1:'kate', v2:'daan' },
    ronde:{ eig:'valerii', v1:'salah', v2:'' },
    vst:{ eig:'karin', v1:'kate', v2:'daan' },
    bevest:{ eig:'karin', v1:'daan', v2:'' },
    cont:{ eig:'kate', v1:'salah', v2:'daan' }
  },
  volgorde:['aanwezig', 'nu', 'verwerk', 'ontv', 'controle', 'meld', 'pick', 'ronde', 'vst', 'bevest', 'cont']
};
const cfg = () => {
  const c = P.d.cfg;
  if(!c || !c.personen) return STANDAARD;
  const volg = (c.volgorde || []).filter(t => TAKEN[t]);
  Object.keys(TAKEN).forEach(t => { if(!volg.includes(t)) volg.push(t); });
  return { personen:c.personen, taken:Object.assign({}, STANDAARD.taken, c.taken || {}), volgorde:volg, door:c.door, op:c.op };
};
const persoon = id => cfg().personen.find(p => p.id === id) || null;
const naamVan = id => id === 'picker' ? 'Picker' : (persoon(id) || {}).naam || '';
const afwezig = id => !!((P.d['a:' + dag()] || {})[id]);
// wie doet deze taak vandaag: eigenaar, anders vervanger 1, anders vervanger 2, anders Daan
function bij(taak){
  const t = cfg().taken[taak] || {};
  const k = [t.eig, t.v1, t.v2].filter(id => id && persoon(id));
  const nu = k.find(id => !afwezig(id));
  return { id:nu || 'daan', eig:t.eig, vervangt:nu && nu !== t.eig ? t.eig : (!nu ? t.eig : null) };
}
const mijnTaken = id => cfg().volgorde.filter(t => bij(t).id === id);

/* ---------- hulpjes ---------- */
const ls = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsZet = (k, v) => { try{ if(v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} };
const wie = () => UI.ik === 'picker' ? (UI.naam || 'picker') : naamVan(UI.ik);
const dag = () => vandaag();
const tijd = iso => iso ? new Date(iso).toLocaleTimeString('nl-NL', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' }) : '';
const dagTijd = iso => { if(!iso) return ''; const d = new Date(String(iso).replace(' ', 'T')); if(isNaN(d)) return String(iso); return isoDag(d) === dag() ? tijd(d) : d.toLocaleDateString('nl-NL', { weekday:'short', day:'numeric', month:'short' }) + ' ' + tijd(d); };
const minOud = iso => iso ? (Date.now() - new Date(String(iso).replace(' ', 'T')).getTime()) / 6e4 : 0;
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
function stand(){
  const N = nuLijst(), R = rondeLijst();
  const nuCodes = new Set(N.map(m => m.code)), rCodes = new Set(R.map(r => r.code));
  const nu = { open:[], gemeld:[], nogopen:[] };
  N.forEach(m => nu[nuStatus(m.code)].push(m));
  const rd = { open:[], gemeld:[], nogopen:[] };
  R.forEach(r => rd[rondeStatus(r.code)].push(r));
  const vNu = perVoorvoegsel('v:' + dag() + ':nu:'), vRd = perVoorvoegsel('v:' + dag() + ':ronde:');
  const klaarNu = isLive() ? vNu.filter(v => !nuCodes.has(v.k.split(':').pop())) : [];
  const klaarRd = (WHAL.S.st && WHAL.S.st.p) ? vRd.filter(v => !rCodes.has(v.k.split(':').pop())) : [];
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
  return (D.CONT || []).filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum >= v && c.losdatum <= t)
    .sort((a, b) => String(a.losdatum).localeCompare(String(b.losdatum)));
}

/* ---------- bouwstenen ---------- */
const locs = (arr, soort) => (arr || []).length ? arr.map(l => `<span class="loc ${soort}">${esc(l)}</span>`).join(' ') : '';
const leeg = t => `<div class="leeg">${esc(t)}</div>`;
const kaart = (titel, inhoud, extra) => `<section class="kaart ${extra || ''}"><h2>${titel}</h2>${inhoud}</section>`;
const tegel = (n, lbl, cls) => `<div class="tegel ${cls || ''}"><b>${n == null ? '–' : nf(n)}</b><span>${esc(lbl)}</span></div>`;
const nr = (n, hot) => `<span class="nr ${hot ? 'hot' : ''}">${n == null ? '–' : nf(n)}</span>`;
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
const vinkKnop = (taak, tekst) => {
  const k = 'c:' + dag() + ':' + taak, v = P.d[k];
  return `<button class="vink ${v ? 'aan' : ''}" data-a="vink" data-k="${esc(k)}"><span class="box">${v ? '✓' : ''}</span><span>${esc(tekst)}${v ? ` <small>${esc(v.wie)} · ${esc(tijd(v.op))}</small>` : ''}</span></button>`;
};

/* ---------- per taak: de inhoud ---------- */
const REDEN_RIJ = ['Bulk is leeg', 'Te weinig op bulk', 'Past niet op de picklocatie', 'Product niet gevonden', 'Andere reden'];
const UITKOMST = ['Klopt nu', 'Voorraad klopt niet: tellen', 'Doorgezet naar Daan'];
function luktNiet(key, code, loc){
  if(UI.open !== key) return '';
  return `<div class="lukt">
    <div class="keuzes">${REDEN_RIJ.map((r, i) => `<label><input type="radio" name="r-${esc(key)}" value="${i}"> ${esc(r)}</label>`).join('')}</div>
    <input class="noot" placeholder="Toelichting (mag leeg)">
    <div class="rij"><button class="knop pri" data-a="lukt-op" data-c="${esc(code)}" data-l="${esc(loc || '')}">Melden</button><button class="knop" data-a="sluit">Annuleren</button></div></div>`;
}
function taakRij(soort, code, naam, van, naar, aantal, meta){
  const st = soort === 'nu' ? nuStatus(code) : rondeStatus(code);
  const v = P.d[vk(soort, code)];
  const key = soort + ':' + code;
  const naarTxt = naar && naar.length ? locs(naar, 'pick') : `<span class="geenloc">geen picklocatie · naar geen specifieke locatie</span>`;
  const verwerker = naamVan(bij('verwerk').id);
  let knoppen;
  if(st === 'open') knoppen = `<button class="knop pri groot" data-a="verpl" data-s="${soort}" data-c="${esc(code)}" data-n="${aantal}">Verplaatst</button><button class="knop" data-a="open" data-k="${esc(key)}">Lukt niet</button>`;
  else if(st === 'gemeld') knoppen = `<span class="st gemeld">Verplaatst om ${esc(tijd(v.op))}${soort === 'nu' ? ' · ' + esc(verwerker) + ' verwerkt de backorders' : ''}</span><button class="knop klein" data-a="verpl-uit" data-s="${soort}" data-c="${esc(code)}">Ongedaan</button>`;
  else knoppen = `<span class="st rood">Picqer ziet het nog op bulk. ${esc(naamVan(bij('controle').id))} kijkt mee.</span>`;
  return `<div class="taak st-${st}">
    <div class="t-hoofd"><div><b class="code">${esc(code)}</b> <span class="naam">${esc(naam || '')}</span></div><div class="aantal">${nf(aantal)}<small>stuks</small></div></div>
    <div class="route"><span class="lbl">van</span> ${locs(van, 'bulk') || '<span class="geenloc">?</span>'} <span class="pijl">→</span> <span class="lbl">naar</span> ${naarTxt}</div>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
    <div class="rij acties">${knoppen}</div>
    ${luktNiet(key, code, (van || [])[0])}
  </div>`;
}
function meldRij(m, magOplossen){
  const oud = minOud(m.op) > 120 && !m.klaar;
  const open = UI.open === m.k;
  return `<div class="taak ${m.klaar ? 'st-klaar' : oud ? 'st-nogopen' : 'st-open'}">
    <div class="t-hoofd"><div><b>${esc(m.reden || 'Melding')}</b> <span class="naam">${esc(m.wie || '')} · ${esc(dagTijd(m.op))}</span></div>${oud ? '<span class="badge rood">langer dan 2 uur</span>' : ''}</div>
    <div class="route">${m.code ? `<b class="code">${esc(m.code)}</b> <span class="naam">${esc((D.P[m.code] || {}).naam || '')}</span>` : ''} ${m.loc ? locs([m.loc], '') : ''}</div>
    ${m.noot ? `<div class="meta">“${esc(m.noot)}”</div>` : ''}
    ${m.klaar ? `<div class="meta">Opgelost door ${esc(m.klaar.wie)} om ${esc(tijd(m.klaar.op))}${m.klaar.antw ? ': ' + esc(m.klaar.antw) : ''}</div>`
      : magOplossen ? (open ? `<div class="lukt"><input class="noot" id="antw-${esc(m.k)}" placeholder="Wat heb je gedaan? (mag leeg)"><div class="rij"><button class="knop pri" data-a="meld-klaar" data-k="${esc(m.k)}">Opgelost</button><button class="knop" data-a="sluit">Annuleren</button></div></div>`
        : `<div class="rij acties"><button class="knop" data-a="open" data-k="${esc(m.k)}">Oplossen</button></div>`) : ''}
  </div>`;
}
const vstMail = V => `Hoi Edwin,\n\nGraag de volgende producten terug naar IVOL Veldhoven:\n\nProductcode\tAantal\tOmschrijving\n${V.producten.map(p => `${p.code}\t${p.nodig}\t${p.naam}`).join('\n')}\n\nAlvast bedankt.\n\nMet vriendelijke groet,\n${wie()}\nIVOL`;

// elke taak geeft { n, hot, html } terug; S = stand()
const SECTIE = {
  aanwezig(){
    const af = P.d['a:' + dag()] || {};
    const n = Object.values(af).filter(Boolean).length;
    return { n, hot:false, html:`<p class="muted">Tik wie er vandaag niet is. Hun taken gaan direct naar de vervanger.</p>
      <div class="chips">${cfg().personen.map(p => `<button class="chip ${af[p.id] ? 'uit' : 'aan'}" data-a="afwezig" data-p="${esc(p.id)}">${esc(p.naam)} <small>${af[p.id] ? 'afwezig' : 'er'}</small></button>`).join('')}</div>` };
  },
  nu(S){
    const regels = S.nu.open.concat(S.nu.gemeld, S.nu.nogopen);
    return { n:S.nu.open.length, hot:S.nu.open.length > 0, html:
      `<p class="muted">Oudste eerst.</p>` + (regels.length ? regels.map(m => taakRij('nu', m.code, m.naam, m.van, m.naar, m.verpl,
        `${m.orders.length} ${m.orders.length === 1 ? 'order' : 'orders'} · oudste ${esc(dagTijd(m.datum))} · op pick nu ${nf(m.pickst)}`)).join('')
        : leeg(isLive() ? 'Niets. Geen order wacht op een verplaatsing.' : LV().code ? 'Ophalen uit Picqer…' : 'Eerst koppelen met Picqer.')) };
  },
  ronde(S){
    const R = S.rd.open.concat(S.rd.gemeld, S.rd.nogopen);
    const gangen = [...new Set(R.map(r => r.gang).filter(Boolean))].sort();
    const RG = UI.gang ? R.filter(r => r.gang === UI.gang) : R;
    return { n:S.rd.open.length, hot:false, html:
      `${gangen.length > 1 ? `<div class="chips"><button class="chip ${UI.gang ? '' : 'aan'}" data-a="gang" data-g="">Alle</button>${gangen.map(g => `<button class="chip ${UI.gang === g ? 'aan' : ''}" data-a="gang" data-g="${esc(g)}">${esc(g)} <small>${R.filter(r => r.gang === g && rondeStatus(r.code) === 'open').length}</small></button>`).join('')}</div>` : ''}` +
      (RG.length ? RG.map(r => taakRij('ronde', r.code, r.naam, r.bulk, r.pick, r.aantal, `op pick nu ${nf(r.pickst)} · aanvullen onder ${nf(r.lvl)} · tot ${nf(r.tot)}`)).join('')
        : leeg(WHAL.S.st ? 'Niets onder het niveau.' : LV().code ? 'Aanvulstand wordt opgehaald…' : 'Eerst koppelen met Picqer.')) };
  },
  verwerk(S){
    const vw = verwerkOp(), g = S.nu.gemeld;
    return { n:g.length, hot:g.length > 0, html: g.length
      ? `<p><b>${nf(g.length)}</b> verplaatsingen gemeld${vw ? ' sinds ' + esc(tijd(vw)) : ''}: ${g.slice(0, 8).map(m => `<span class="code">${esc(m.code)}</span>`).join(', ')}${g.length > 8 ? ' …' : ''}</p>
         <p class="muted">Picqer → Backorders → Verwerk backorders. Tik daarna hieronder.</p>
         <div class="rij mt"><button class="knop pri groot" data-a="verwerk">Verwerk backorders gedaan</button></div>`
      : `<p class="muted">${vw ? 'Laatst verwerkt om ' + esc(tijd(vw)) + '. ' : ''}Niets nieuws gemeld.</p>${vw ? '' : `<div class="rij mt"><button class="knop" data-a="verwerk">Verwerk backorders gedaan</button></div>`}` };
  },
  ontv(){
    const v = P.d['c:' + dag() + ':ontv'];
    return { n:v ? 0 : 1, hot:false, html:`<div class="vinken">${vinkKnop('ontv', 'Ontvangsten van vandaag opgeboekt en backorders verwerkt')}</div>` };
  },
  controle(S){
    return { n:S.nogOpen.length, hot:S.nogOpen.length > 0, html: S.nogOpen.length ? S.nogOpen.map(m => {
      const v = P.d[vk(m.ronde ? 'ronde' : 'nu', m.code)] || {};
      const open = UI.open === 'k:' + m.code;
      return `<div class="taak st-nogopen"><div class="t-hoofd"><div><b class="code">${esc(m.code)}</b> <span class="naam">${esc(m.naam || '')}</span></div><span class="badge">${m.ronde ? 'aanvulronde' : 'klant wacht'}</span></div>
        <div class="route"><span class="lbl">van</span> ${locs(m.ronde ? m.bulk : m.van, 'bulk')} <span class="pijl">→</span> ${locs(m.ronde ? m.pick : m.naar, 'pick') || '<span class="geenloc">geen picklocatie</span>'}</div>
        <div class="meta">Gemeld door ${esc(v.wie || '?')} om ${esc(tijd(v.op))}. Ga kijken.</div>
        ${open ? `<div class="lukt"><div class="keuzes">${UITKOMST.map((u, i) => `<button class="knop" data-a="ctrl" data-c="${esc(m.code)}" data-u="${i}">${esc(u)}</button>`).join('')}</div><button class="knop klein" data-a="sluit">Annuleren</button></div>`
          : `<div class="rij acties"><button class="knop" data-a="open" data-k="k:${esc(m.code)}">Gecontroleerd</button></div>`}</div>`;
    }).join('') : leeg('Alles wat gemeld is, klopt in Picqer.') };
  },
  meld(S){
    const klaar = S.meldVandaag.filter(m => m.klaar);
    return { n:S.meldOpen.length, hot:S.meldOpen.length > 0, html:(S.meldOpen.length ? S.meldOpen.map(m => meldRij(m, true)).join('') : leeg('Geen open meldingen.'))
      + (klaar.length ? `<details class="mt"><summary>Vandaag opgelost (${klaar.length})</summary>${klaar.map(m => meldRij(m, false)).join('')}</details>` : '') };
  },
  pick(S){
    const pl = S.pl;
    const pauze = LV().data ? LV().data.picklijsten.filter(p => p.s === 'paused') : [];
    return { n:pl ? pl.o12 + pl.gepauzeerd : null, hot:!!(pl && pl.o12), html:`<div class="tegels klein">
      ${tegel(pl && pl.open, 'open')}${tegel(pl && pl.urgent, 'urgent', pl && pl.urgent ? 'warn' : '')}${tegel(pl && pl.o12, 'ouder dan 12 uur', pl && pl.o12 ? 'rood' : '')}${tegel(pl && pl.gepauzeerd, 'gepauzeerd', pl && pl.gepauzeerd ? 'warn' : '')}</div>
      ${pauze.length ? `<div class="tabel mt"><table><thead><tr><th>Gepauzeerd</th><th>Reden</th><th>Wie</th><th>Sinds</th></tr></thead><tbody>${pauze.slice(0, 40).map(p => `<tr><td><a href="https://ivol.picqer.com/picklists/${p.id}" target="_blank" rel="noopener">${esc(p.nr)}</a></td><td>${esc(p.pauze || '–')}</td><td>${esc(p.wie || '')}</td><td>${esc(dagTijd(p.c))}</td></tr>`).join('')}</tbody></table></div>` : ''}` };
  },
  vst(){
    const V = WHAL.vanVst();
    if(!V) return { n:null, hot:false, html:leeg(LV().code ? 'Wordt opgehaald…' : 'Eerst koppelen met Picqer.') };
    if(!V.producten.length) return { n:0, hot:false, html:leeg('Niets terug te halen: geen order wacht op VST-voorraad.') };
    return { n:V.producten.length, hot:true, html:`<p class="muted">${nf(V.orders.length)} orders worden compleet met voorraad op VST.</p>
      <div class="tabel"><table><thead><tr><th>Product</th><th class="n">Nodig</th><th class="n">Op VST</th><th class="n">Orders</th><th>Oudste</th></tr></thead><tbody>${V.producten.map(p => `<tr><td><b class="code">${esc(p.code)}</b><br><span class="naam">${esc(p.naam)}</span></td><td class="n">${nf(p.nodig)}</td><td class="n">${nf(p.vst)}</td><td class="n">${p.orders.length}</td><td>${esc(dagTijd(p.oudste))}</td></tr>`).join('')}</tbody></table></div>
      <textarea id="vst-mail" class="mail" readonly>${esc(vstMail(V))}</textarea>
      <div class="rij mt"><button class="knop pri" data-a="kopieer" data-id="vst-mail">Mail kopiëren</button></div>
      <div class="vinken">${vinkKnop('vst', 'Mail naar Edwin verstuurd')}</div>` };
  },
  bevest(){
    const v = P.d['c:' + dag() + ':bevest'];
    return { n:v ? 0 : 1, hot:false, html:`<div class="vinken">${vinkKnop('bevest', 'Orderbevestigingen nagelopen, levertijden bijgewerkt')}</div>` };
  },
  cont(){
    const C = containers(7);
    return { n:C.length, hot:false, html: C.length ? `<div class="tabel"><table><thead><tr><th>Datum</th><th>Leverancier</th><th>Container</th><th>Status</th></tr></thead><tbody>${C.map(c => `<tr><td>${esc(dagTijd(c.losdatum + 'T12:00'))}${c.verwacht ? ' <span class="badge">verwacht</span>' : c.lostijd ? ' ' + esc(String(c.lostijd).slice(0, 5)) : ''}</td><td>${esc(c.leverancier || '')}</td><td class="code">${esc(c.containernummer || c.pakbon_ref || '')}</td><td>${esc(c.status || '')}</td></tr>`).join('')}</tbody></table></div>
      <div class="rij mt"><a class="knop" href="containerplanning.html" target="_blank" rel="noopener">Containers openen ↗</a></div>` : leeg('Geen containers in de komende 7 dagen.') };
  }
};

/* ---------- schermen ---------- */
function viewKies(){
  const k = (id, naam, sub) => `<button class="rolknop" data-a="ik" data-p="${esc(id)}"><b>${esc(naam)}</b><span>${esc(sub)}</span></button>`;
  return `<section class="kaart"><h2>Wie ben je?</h2><p class="muted">Kies je naam. Wat je vandaag doet, heeft Daan vastgelegd.</p>
    <div class="rollen mt">${cfg().personen.map(p => k(p.id, p.naam, mijnTaken(p.id).length ? mijnTaken(p.id).length + ' taken vandaag' : 'vandaag geen taken')).join('')}
    ${k('picker', 'Picker', 'Iets melden')}</div></section>`;
}
function viewMijn(id){
  const S = stand();
  const lijst = mijnTaken(id);
  let h = koppelKaart();
  if(afwezig(id)) h += `<div class="melding fout">Je staat vandaag op afwezig. Je taken liggen bij je vervanger.</div>`;
  if(!lijst.length) return h + kaart('Vandaag', leeg('Geen taken voor jou vandaag.'));
  lijst.forEach((t, i) => {
    let s; try{ s = SECTIE[t](S); }catch(e){ console.error(e); s = { n:null, html:`<div class="melding fout">${esc(e.message)}</div>` }; }
    const b = bij(t);
    const voor = b.vervangt ? ` <span class="badge oranje">voor ${esc(naamVan(b.vervangt))}</span>` : '';
    h += `<section class="kaart ${s.hot ? 'actie' : ''}"><h2><span class="volg">${i + 1}</span>${esc(TAKEN[t].titel)} ${s.n != null && t !== 'aanwezig' ? nr(s.n, s.hot) : ''}${voor}</h2><p class="muted klein">${esc(TAKEN[t].uit)}</p>${s.html}</section>`;
  });
  return h;
}
function viewRegie(){
  const S = stand();
  const vw = verwerkOp();
  const afw = [];
  const n = t => naamVan(bij(t).id);
  S.nogOpen.forEach(m => afw.push({ wie:n('controle'), t:`${m.code}: gemeld als verplaatst, Picqer ziet het nog op bulk`, cls:'rood' }));
  S.meldOpen.filter(m => minOud(m.op) > 120).forEach(m => afw.push({ wie:n('meld'), t:`Melding ${m.reden || ''} ${m.code || m.loc || ''} van ${m.wie || '?'} staat al sinds ${dagTijd(m.op)} open`, cls:'rood' }));
  if(S.nu.gemeld.some(m => minOud((P.d[vk('nu', m.code)] || {}).op) > 30)) afw.push({ wie:n('verwerk'), t:`${S.nu.gemeld.length} verplaatsingen wachten langer dan 30 minuten op Verwerk backorders`, cls:'warn' });
  if(S.pl && S.pl.o24) afw.push({ wie:n('pick'), t:`${S.pl.o24} picklijsten zijn ouder dan 24 uur`, cls:'rood' });
  const lang = S.nu.open.filter(m => minOud(m.datum) > 240).length;
  if(lang) afw.push({ wie:n('nu'), t:`Klant wacht: ${lang} producten houden orders langer dan 4 uur tegen`, cls:'warn' });
  cfg().volgorde.forEach(t => { const b = bij(t); if(b.id === 'daan' && b.eig !== 'daan') afw.push({ wie:'Daan', t:`${TAKEN[t].titel}: eigenaar en vervangers zijn er niet, de taak ligt bij jou`, cls:'warn' }); });
  let h = koppelKaart() + `<div class="tegels">
    ${tegel(S.nu.open.length, 'klant wacht, nog niet verplaatst', S.nu.open.length ? 'warn' : 'ok')}
    ${tegel(S.nogOpen.length, 'klopt niet na verplaatsen', S.nogOpen.length ? 'rood' : 'ok')}
    ${tegel(S.meldOpen.length, 'meldingen open', S.meldOpen.length ? 'rood' : 'ok')}
    ${tegel(S.pl && S.pl.o12, 'picklijsten ouder dan 12 uur', S.pl && S.pl.o12 ? 'rood' : 'ok')}
  </div>`;
  h += kaart(`Afwijkingen ${nr(afw.length, afw.length > 0)}`,
    afw.length ? `<div class="afw">${afw.map(a => `<div class="afwrij ${a.cls}"><span>${esc(a.t)}</span><b>${esc(a.wie)}</b></div>`).join('')}</div>` : leeg('Niets wijkt af. Alles loopt.'), afw.length ? 'actie' : '');
  const standTxt = t => {
    if(t === 'nu') return `${nf(S.nu.open.length)} open · ${nf(S.nu.gemeld.length)} gemeld · ${nf(S.klaarNu.length)} klaar`;
    if(t === 'ronde') return `${nf(S.rd.open.length)} open · ${nf(S.klaarRd.length)} klaar`;
    if(t === 'verwerk') return vw ? 'laatst ' + tijd(vw) + (S.nu.gemeld.length ? ' · ' + S.nu.gemeld.length + ' wachten' : '') : (S.nu.gemeld.length ? S.nu.gemeld.length + ' wachten' : 'nog niet');
    if(t === 'controle') return `${nf(S.nogOpen.length)} te controleren`;
    if(t === 'meld') return `${nf(S.meldOpen.length)} open · ${nf(S.meldVandaag.length)} vandaag`;
    if(t === 'pick') return S.pl ? `${nf(S.pl.open)} open · ${nf(S.pl.o12)} ouder dan 12 uur` : '–';
    if(t === 'aanwezig'){ const af = Object.keys(P.d['a:' + dag()] || {}).filter(k => (P.d['a:' + dag()] || {})[k]); return af.length ? 'afwezig: ' + af.map(naamVan).join(', ') : 'iedereen er'; }
    if(t === 'ontv' || t === 'bevest'){ const v = P.d['c:' + dag() + ':' + t]; return v ? 'gedaan ' + tijd(v.op) : 'nog niet'; }
    if(t === 'vst'){ const v = P.d['c:' + dag() + ':vst']; const V = WHAL.vanVst(); return (V ? V.producten.length + ' producten' : '–') + (v ? ' · mail ' + tijd(v.op) : ''); }
    if(t === 'cont') return `${containers(7).length} komende 7 dagen`;
    return '';
  };
  h += kaart('Wie doet wat vandaag', `<div class="tabel"><table><thead><tr><th>Taak</th><th>Bij</th><th>Stand</th></tr></thead><tbody>${cfg().volgorde.map(t => { const b = bij(t); return `<tr><td>${esc(TAKEN[t].titel)}</td><td><b>${esc(naamVan(b.id))}</b>${b.vervangt ? `<br><span class="naam">voor ${esc(naamVan(b.vervangt))}</span>` : ''}</td><td>${esc(standTxt(t))}</td></tr>`; }).join('')}
    <tr><td>Melden</td><td><b>Pickers</b></td><td>${nf(S.meldVandaag.filter(m => m.rol === 'picker').length)} meldingen vandaag</td></tr></tbody></table></div>`);
  if(S.B) h += kaart('Backorders', `<div class="tegels klein">${tegel(S.B.orders, 'orders in backorder')}${tegel(S.B.vol, 'compleet zodra verplaatst', S.B.vol ? 'warn' : 'ok')}${tegel(S.B.wacht, 'wachten op inkoop of meer')}</div>`);
  return h;
}
// Daan: indeling één keer vastleggen
function viewIndeling(){
  const c = UI.concept || (UI.concept = JSON.parse(JSON.stringify({ personen:cfg().personen, taken:cfg().taken, volgorde:cfg().volgorde })));
  const opties = (sel, leegTxt) => `<option value="">${esc(leegTxt)}</option>` + c.personen.map(p => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.naam)}</option>`).join('');
  const cf = P.d.cfg;
  return `<section class="kaart"><h2>Indeling</h2>
    <p class="muted">Eén keer vastleggen: wie doet welke taak, wie vervangt als diegene er niet is, en in welke volgorde. Iedereen ziet zijn taken in deze volgorde.</p>
    ${cf && cf.op ? `<p class="muted klein">Laatst opgeslagen door ${esc(cf.door || '?')} op ${esc(dagTijd(cf.op))}.</p>` : `<p class="melding">Nog niet opgeslagen: dit is mijn voorstel.</p>`}
    <div class="tabel"><table class="indeling"><thead><tr><th>#</th><th>Taak</th><th>Eigenaar</th><th>Vervanger 1</th><th>Vervanger 2</th><th></th></tr></thead><tbody>
    ${c.volgorde.map((t, i) => { const x = c.taken[t] || {}; return `<tr><td class="n">${i + 1}</td><td><b>${esc(TAKEN[t].titel)}</b><br><span class="naam">${esc(TAKEN[t].uit)}</span></td>
      <td><select data-ind="eig" data-t="${t}">${opties(x.eig, 'kies')}</select></td><td><select data-ind="v1" data-t="${t}">${opties(x.v1, '–')}</select></td><td><select data-ind="v2" data-t="${t}">${opties(x.v2, '–')}</select></td>
      <td class="pijlen"><button class="knop klein" data-a="omhoog" data-t="${t}" ${i ? '' : 'disabled'} aria-label="Hoger">↑</button><button class="knop klein" data-a="omlaag" data-t="${t}" ${i < c.volgorde.length - 1 ? '' : 'disabled'} aria-label="Lager">↓</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <h3 class="mt">Mensen</h3>
    <div class="chips">${c.personen.map(p => `<span class="chip">${esc(p.naam)}${p.id === 'daan' ? '' : ` <button class="x" data-a="persoon-weg" data-p="${esc(p.id)}" aria-label="${esc(p.naam)} verwijderen">×</button>`}</span>`).join('')}</div>
    <div class="rij mt"><input id="nieuw-persoon" placeholder="Naam toevoegen, bijv. tweede rijder"><button class="knop" data-a="persoon-erbij">Toevoegen</button></div>
    <div class="rij mt"><button class="knop pri groot" data-a="indeling-op">Indeling opslaan</button><button class="knop" data-a="indeling-terug">Wijzigingen weggooien</button></div>
  </section>`;
}

/* ---------- picker: alleen melden (4 talen) ---------- */
const PT = {
  nl:{ titel:'Iets melden', uitleg:'Klopt er iets niet bij het picken? Meld het hier. Het komt direct bij de coördinator.', naam:'Je naam', code:'Productcode of barcode', loc:'Locatie', wat:'Wat is er?',
    r:['Locatie leeg', 'Te weinig voor de picklijst', 'Ander product op de locatie', 'Kapot', 'Anders'], noot:'Toelichting (mag leeg)', knop:'Melden', ok:'Gemeld. Ga door met picken.',
    mist:'Vul een productcode of locatie in en kies wat er is.', vandaag:'Jouw meldingen vandaag', open:'open', klaar:'opgelost' },
  en:{ titel:'Report a problem', uitleg:'Something wrong while picking? Report it here. It goes straight to the coordinator.', naam:'Your name', code:'Product code or barcode', loc:'Location', wat:'What is wrong?',
    r:['Location empty', 'Not enough for the picklist', 'Wrong product on the location', 'Damaged', 'Other'], noot:'Note (optional)', knop:'Report', ok:'Reported. Carry on picking.',
    mist:'Fill in a product code or location and choose what is wrong.', vandaag:'Your reports today', open:'open', klaar:'solved' },
  es:{ titel:'Avisar de un problema', uitleg:'¿Algo no está bien al preparar pedidos? Avisa aquí. Llega directamente al coordinador.', naam:'Tu nombre', code:'Código de producto o código de barras', loc:'Ubicación', wat:'¿Qué pasa?',
    r:['Ubicación vacía', 'No hay suficiente para la lista', 'Otro producto en la ubicación', 'Dañado', 'Otro'], noot:'Nota (opcional)', knop:'Avisar', ok:'Aviso enviado. Sigue preparando.',
    mist:'Rellena un código o una ubicación y elige qué pasa.', vandaag:'Tus avisos de hoy', open:'abierto', klaar:'resuelto' },
  el:{ titel:'Αναφορά προβλήματος', uitleg:'Κάτι δεν πάει καλά στη συλλογή; Αναφέρετέ το εδώ. Πηγαίνει κατευθείαν στον συντονιστή.', naam:'Το όνομά σας', code:'Κωδικός προϊόντος ή barcode', loc:'Θέση', wat:'Τι συμβαίνει;',
    r:['Άδεια θέση', 'Δεν φτάνει για τη λίστα', 'Άλλο προϊόν στη θέση', 'Χαλασμένο', 'Άλλο'], noot:'Σημείωση (προαιρετικό)', knop:'Αποστολή', ok:'Στάλθηκε. Συνεχίστε τη συλλογή.',
    mist:'Συμπληρώστε κωδικό ή θέση και επιλέξτε τι συμβαίνει.', vandaag:'Οι αναφορές σας σήμερα', open:'ανοιχτό', klaar:'λύθηκε' }
};
function viewPicker(){
  const t = PT[UI.taal] || PT.nl;
  const mijn = (ls('ploeg-mijn') || '').split(',').filter(Boolean);
  const mijnM = mijn.map(id => P.d['m:' + id] ? Object.assign({ k:'m:' + id }, P.d['m:' + id]) : null).filter(m => m && isoDag(m.op) === dag());
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

/* ---------- tekenen ---------- */
function bezigMetTypen(){ const e = document.activeElement; return !!(e && /INPUT|TEXTAREA|SELECT/.test(e.tagName) && e.closest && e.closest('#app') && !e.readOnly); }
let uitgesteld = false;
function teken(forceer){
  if(!forceer && bezigMetTypen()){ uitgesteld = true; return; }
  uitgesteld = false;
  const knop = $('wie');
  if(knop) knop.textContent = UI.ik ? (wie() || 'Kies je naam') : 'Kies je naam';
  const y = window.scrollY;
  let h;
  try{
    if(!UI.ik || (UI.ik !== 'picker' && !persoon(UI.ik))) h = viewKies();
    else if(D.fout) h = kaart('Geen verbinding met de database', `<p class="muted">${esc(D.fout.message || '')}</p>`);
    else if(UI.ik === 'picker') h = viewPicker();
    else {
      const dagNaam = new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' });
      h = `<div class="dagkop"><h1>${esc(dagNaam.charAt(0).toUpperCase() + dagNaam.slice(1))} · ${esc(wie())}</h1>${liveRegel()}</div>`;
      if(P.fout) h += `<div class="melding fout">Stand ophalen mislukt: ${esc(P.fout.message)}</div>`;
      if(UI.ik === 'daan'){
        const tab = (id, t) => `<button class="chip ${UI.tab === id ? 'aan' : ''}" data-a="tab" data-t="${id}">${t}</button>`;
        h += `<div class="chips">${tab('mijn', 'Mijn taken')}${tab('regie', 'Regie')}${tab('indeling', 'Indeling')}</div>`;
        h += UI.tab === 'regie' ? viewRegie() : UI.tab === 'indeling' ? viewIndeling() : viewMijn('daan');
      } else h += viewMijn(UI.ik);
    }
  }catch(e){ console.error(e); h = kaart('Er ging iets mis', `<pre>${esc(e.stack || e.message)}</pre>`); }
  app.innerHTML = h;
  window.scrollTo(0, y);
}
document.addEventListener('focusout', () => setTimeout(() => { if(uitgesteld && !bezigMetTypen()) teken(); }, 200));

/* ---------- acties ---------- */
document.addEventListener('change', ev => {
  const s = ev.target.closest && ev.target.closest('[data-ind]');
  if(s && UI.concept){ const t = s.dataset.t; UI.concept.taken[t] = Object.assign({}, UI.concept.taken[t], { [s.dataset.ind]:s.value }); }
});
document.addEventListener('click', async ev => {
  const b = ev.target.closest('[data-a]'); if(!b) return;
  const a = b.dataset.a;
  if(a === 'ik'){ UI.ik = b.dataset.p; lsZet('ploeg-ik', UI.ik); UI.open = null; UI.tab = 'mijn'; teken(true); window.scrollTo(0, 0); return; }
  if(a === 'wissel'){ UI.ik = null; lsZet('ploeg-ik', null); teken(true); window.scrollTo(0, 0); return; }
  if(a === 'tab'){ UI.tab = b.dataset.t; if(UI.tab !== 'indeling') UI.concept = null; teken(true); return; }
  if(a === 'ververs'){ await vernieuw(true); return; }
  if(a === 'koppel'){ const v = (($('p-code') || {}).value || '').trim(); if(!v) return; WHLIVE.zetCode(v); WHLIVE.laad(true); WHAL.ververs(10); teken(true); return; }
  if(a === 'gang'){ UI.gang = b.dataset.g || ''; teken(true); return; }
  if(a === 'sluit'){ UI.open = null; teken(true); return; }
  if(a === 'open'){ UI.open = b.dataset.k; teken(true); return; }
  if(a === 'afwezig'){
    const k = 'a:' + dag(), af = Object.assign({}, P.d[k] || {});
    if(af[b.dataset.p]) delete af[b.dataset.p]; else af[b.dataset.p] = true;
    await zet({ [k]:af }); return;
  }
  if(a === 'verpl'){
    await zet({ [vk(b.dataset.s, b.dataset.c)]:{ wie:wie(), op:new Date().toISOString(), aantal:Number(b.dataset.n) || null } });
    toast('Verplaatst gemeld'); return;
  }
  if(a === 'verpl-uit'){ await zet({ [vk(b.dataset.s, b.dataset.c)]:null }); return; }
  if(a === 'lukt-op'){
    const box = b.closest('.lukt'), keuze = box.querySelector('input[type=radio]:checked');
    if(!keuze){ toast('Kies wat er is'); return; }
    UI.open = null;
    await zet({ ['m:' + nieuwId()]:{ wie:wie(), rol:'rijder', op:new Date().toISOString(), code:b.dataset.c, loc:b.dataset.l, reden:REDEN_RIJ[Number(keuze.value)], noot:box.querySelector('.noot').value.trim() } });
    toast('Gemeld aan ' + naamVan(bij('meld').id)); return;
  }
  if(a === 'meld-klaar'){
    const k = b.dataset.k, m = P.d[k]; if(!m) return;
    const antw = (($('antw-' + k) || {}).value || '').trim();
    UI.open = null;
    await zet({ [k]:Object.assign({}, m, { klaar:{ wie:wie(), op:new Date().toISOString(), antw } }) }); return;
  }
  if(a === 'ctrl'){ UI.open = null; await zet({ ['k:' + dag() + ':' + b.dataset.c]:{ wie:wie(), op:new Date().toISOString(), uitkomst:UITKOMST[Number(b.dataset.u)] } }); return; }
  if(a === 'verwerk'){
    const k = 'dg:' + dag() + ':verwerk', v = { op:new Date().toISOString(), via:'ploeg', wie:wie() };
    D.TAKEN[k] = v; teken(true);
    try{ await WH.catPatch('wh-taken', { [k]:v }); }catch(e){}
    toast('Verwerkt. Over een halve minuut haal ik Picqer opnieuw op.');
    setTimeout(() => WHLIVE.laad(true), 30000); return;
  }
  if(a === 'vink'){ const k = b.dataset.k; await zet({ [k]:P.d[k] ? null : { wie:wie(), op:new Date().toISOString() } }); return; }
  if(a === 'kopieer'){
    const el = $(b.dataset.id); if(!el) return;
    try{ await navigator.clipboard.writeText(el.value); toast('Gekopieerd'); }
    catch(e){ el.focus(); el.select(); toast('Geselecteerd: kopieer met Cmd+C of Ctrl+C'); }
    return;
  }
  // indeling (Daan)
  if(a === 'omhoog' || a === 'omlaag'){
    const v = UI.concept.volgorde, i = v.indexOf(b.dataset.t), j = a === 'omhoog' ? i - 1 : i + 1;
    if(i < 0 || j < 0 || j >= v.length) return;
    [v[i], v[j]] = [v[j], v[i]]; teken(true); return;
  }
  if(a === 'persoon-erbij'){
    const naam = (($('nieuw-persoon') || {}).value || '').trim(); if(!naam) return;
    const id = naam.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '') || nieuwId();
    if(UI.concept.personen.some(p => p.id === id)){ toast('Die naam staat er al'); return; }
    UI.concept.personen.push({ id, naam }); teken(true); return;
  }
  if(a === 'persoon-weg'){
    const id = b.dataset.p;
    UI.concept.personen = UI.concept.personen.filter(p => p.id !== id);
    Object.values(UI.concept.taken).forEach(x => ['eig', 'v1', 'v2'].forEach(f => { if(x[f] === id) x[f] = ''; }));
    teken(true); return;
  }
  if(a === 'indeling-terug'){ UI.concept = null; teken(true); return; }
  if(a === 'indeling-op'){
    const c = UI.concept;
    const zonder = c.volgorde.filter(t => !(c.taken[t] || {}).eig);
    if(zonder.length){ toast('Geef elke taak een eigenaar: ' + zonder.map(t => TAKEN[t].titel).join(', '), 5000); return; }
    await zet({ cfg:{ personen:c.personen, taken:c.taken, volgorde:c.volgorde, door:wie(), op:new Date().toISOString() } });
    UI.concept = null; toast('Indeling opgeslagen'); teken(true); return;
  }
  if(a === 'taal'){ UI.taal = b.dataset.t; lsZet('ploeg-taal', UI.taal); teken(true); return; }
  if(a === 'pick-meld'){
    const t = PT[UI.taal] || PT.nl;
    const naam = ($('pk-naam').value || '').trim(), code = ($('pk-code').value || '').trim(), loc = ($('pk-loc').value || '').trim().toUpperCase();
    const keuze = document.querySelector('input[name="pk-r"]:checked');
    if((!code && !loc) || !keuze){ toast(t.mist, 4000); return; }
    if(naam !== UI.naam){ UI.naam = naam; lsZet('ploeg-naam', naam); }
    const echt = D.PLOW[code.toLowerCase()] || code;
    const id = nieuwId();
    const mijn = (ls('ploeg-mijn') || '').split(',').filter(Boolean).slice(-30); mijn.push(id); lsZet('ploeg-mijn', mijn.join(','));
    UI.meldOk = Date.now();
    await zet({ ['m:' + id]:{ wie:naam || 'picker', rol:'picker', op:new Date().toISOString(), code:echt, loc, reden:PT.nl.r[Number(keuze.value)], noot:($('pk-noot').value || '').trim() } });
    window.scrollTo(0, 0); return;
  }
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
  if(Date.now() - P.tijd > 90000 && !UI.concept) laadPloeg().then(() => teken());
  const s = LV();
  if(s.code && !s.laden && (!s.data || Date.now() - s.data.binnen > 120000)) WHLIVE.laad();
}, 30000);
setInterval(() => { if(document.visibilityState === 'visible' && LV().code && !WHAL.S.bezig) WHAL.ververs(10); }, 300000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && Date.now() - P.tijd > 60000) vernieuw(false); });
WHLIVE.opNieuw(() => teken());
WHAL.opNieuw(() => teken());

/* ---------- start ---------- */
async function start(){
  UI.ik = ls('ploeg-ik');
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
return { P, UI, stand, teken, bij, cfg };
})();
