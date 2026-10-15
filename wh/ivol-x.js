/* =====================================================================
   IVOL Warehouse 3.0 — schermen voor iedereen (15-10-2026, Claude)
   Native schermen in de 3.0-schil (geen iframe):
     nakijken  Te controleren: schattingen van Claude in Productdata (meta.tw) en aannames (wh/aannames.js)
     dag       Dagstart: zes kerncijfers, dagritme om af te vinken, ochtendoverleg
     stand     Hoe staat het magazijn ervoor: Daans tien punten (kennisbank A1), alleen lezen (management)
     zoek      Product zoeken voor de vloer: waar ligt het, wat weten we, en een meldknop
     hulp      Hulp: per rol drie zinnen over wat je ziet en wat je doet (16-10)
   Opslag: productdata (alleen na een tik van Daan), catalog wh-aannames, wh-dag, wh-todo (meldingen).
   Leest alleen uit Picqer (via WHLIVE); schrijft nooit naar Picqer.
   ===================================================================== */
window.WHX = (function(){
'use strict';
const { $, esc, nf, D, isoDag, vandaag, toast } = WH;
const S = { pd:null, pdLaden:null, pdFout:null, dag:null, dagLaden:null, tab:'pd', zoek:'', gekozen:null, el:null, naam:'', rest:'' };
const ik = () => { try{ return localStorage.getItem('ivol-ik') || 'Daan'; }catch(e){ return 'Daan'; } };
const VELD = { opslag:'Soort', spp:'Stuks per pallet', pick:'Picklocatie', maxpick:'Max op pick', lvl:'Aanvullen bij', met:'Aanvullen met', geleverd:'Geleverd', mixgroep:'Mixgroep',
  maat:'Palletmaat', hoogte:'Hoogte incl. pallet (cm)', gewicht:'Gewicht volle pallet (kg)', plaatsen:'Plaatsen op ligger', vn:'Vloernaam', spd:'Stuks per doos', maxlig:'Max pallets per ligger', kgst:'Gewicht per stuk (kg)', doos:'Doosmaat', opm:'Opmerking' };
const VOLG = Object.keys(VELD);
const ABC = { A:0, B:1, C:2 };
const naamVan = c => String((D.P[c] || {}).naam || '');
const abcVan = c => (D.P[c] || {}).abc || '';
const tijdNu = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* ---------- stijl (eenmalig) ---------- */
function stijl(){
  if($('whx-stijl')) return;
  const s = document.createElement('style'); s.id = 'whx-stijl';
  s.textContent = `
  .x-tabs{display:flex;gap:6px;flex-wrap:wrap}
  .x-tabs button{border:1px solid var(--lijn);background:#fff;border-radius:999px;padding:7px 14px;min-height:44px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .x-tabs button.aan{background:var(--ink);color:#fff;border-color:var(--ink)}
  .x-tabs b{font-variant-numeric:tabular-nums;margin-left:4px}
  .x-kaart{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px 16px;display:grid;gap:8px}
  .x-kop{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
  .x-kop .code{font-family:ui-monospace,Consolas,monospace;font-weight:800}
  .x-abc{display:inline-block;font-size:11px;font-weight:800;border-radius:4px;padding:1px 6px;background:#eef1f5;margin-left:6px}
  .x-abc.A{background:#1c7a4a;color:#fff}.x-abc.B{background:#cfe8da}
  .x-rij{display:grid;grid-template-columns:minmax(120px,190px) minmax(90px,170px) 1fr auto;grid-template-areas:"l i w k";gap:8px;align-items:center;padding:6px 0;border-top:1px solid #eef1f5}
  .x-rij>b{grid-area:l}.x-rij>input{grid-area:i}.x-rij>.x-why{grid-area:w}.x-rij>button{grid-area:k}
  .x-rij input{width:100%;min-height:44px;border:1px solid var(--lijn);border-radius:6px;padding:7px 9px;font:inherit;font-size:15px;background:#fffbea}
  .x-rij input.ok{background:#fff}
  .x-why{font-size:12.5px;color:var(--muted)}
  .x-btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--lijn);background:#fff;border-radius:8px;padding:7px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap;text-decoration:none;color:inherit}
  .x-btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
  .x-btn.pri{background:#f08a4b;border-color:#f08a4b}
  .x-btn:disabled{opacity:.5;cursor:default}
  .x-tegels{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}
  .x-tegel{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px;border-top:6px solid #d3d9e0;display:grid;gap:4px;text-decoration:none;color:inherit}
  .x-tegel.groen{border-top-color:var(--ok)}.x-tegel.oranje{border-top-color:#e0a100}.x-tegel.rood{border-top-color:var(--rood)}
  .x-tegel .n{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
  .x-tegel .t{font-weight:700;font-size:14px}.x-tegel .u{font-size:12.5px;color:var(--muted)}
  .x-ritme{display:grid;gap:0}
  .x-ritme label{display:grid;grid-template-columns:28px 54px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-top:1px solid #eef1f5;cursor:pointer}
  .x-ritme input{width:20px;height:20px}
  .x-ritme .tijd{font-variant-numeric:tabular-nums;font-weight:800}
  .x-ritme .wie{font-size:12.5px;color:var(--muted)}
  .x-ritme label.af .wat{text-decoration:line-through;color:var(--muted)}
  .x-ritme label.nu{background:#fff6e5}
  .x-punten{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
  .x-punt{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(15,23,32,.08);padding:14px;border-left:6px solid #d3d9e0;display:grid;gap:6px}
  .x-punt.groen{border-left-color:var(--ok)}.x-punt.oranje{border-left-color:#e0a100}.x-punt.rood{border-left-color:var(--rood)}
  .x-punt .nr{font-size:12px;font-weight:800;color:var(--muted)}
  .x-punt .m{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
  .x-punt a.small{display:inline-flex;align-items:center;min-height:44px;justify-self:start}
  .x-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .x-ritme label:focus-within{outline:3px solid #f08a4b;outline-offset:-3px;border-radius:6px}
  #native input:focus-visible,#native textarea:focus-visible,#native select:focus-visible,#native summary:focus-visible{outline:3px solid #f08a4b;outline-offset:2px}
  .x-zoek input{width:100%;font:inherit;font-size:18px;padding:12px 14px;border:2px solid var(--ink);border-radius:10px}
  .x-res{display:grid;gap:6px}
  .x-res button{all:unset;cursor:pointer;background:#fff;border-radius:10px;padding:10px 12px;box-shadow:0 1px 4px rgba(15,23,32,.08);display:grid;gap:2px}
  .x-res button:focus-visible{outline:3px solid var(--blauw)}
  .x-loc{display:flex;flex-wrap:wrap;gap:6px}
  .x-loc span{font-family:ui-monospace,Consolas,monospace;font-weight:800;font-size:16px;background:#eef1f5;border-radius:6px;padding:4px 9px}
  .x-loc span.pick{background:#1d4ea0;color:#fff}
  .x-meld{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
  .x-meld button{padding:14px;font-size:15px}
  .x-feit{list-style:none;display:grid;font-size:14px}.x-feit li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #eef1f5}.x-feit li:last-child{border-bottom:0}
  .x-notitie{width:100%;min-height:110px;font:inherit;font-size:15px;padding:10px;border:1px solid var(--lijn);border-radius:8px}
  @media (max-width:640px){ .x-rij{grid-template-columns:1fr auto;grid-template-areas:"l l" "i k" "w w";gap:6px 8px;padding:8px 0} }
  `;
  document.head.appendChild(s);
}

/* ---------- laden ---------- */
function laadPd(vers){
  if(S.pdLaden && !vers) return S.pdLaden;
  S.pdLaden = (async () => {
    try{
      const rows = await WH.getAll('productdata', 'select=productcode,data,meta');
      S.pd = {}; (rows || []).forEach(r => { S.pd[r.productcode] = { data:r.data || {}, meta:r.meta || {} }; });
      S.pdFout = null;
    }catch(e){ S.pdFout = e; }
    herteken();
  })();
  return S.pdLaden;
}
function laadDag(vers){
  if(S.dagLaden && !vers) return S.dagLaden;
  S.dagLaden = (async () => { try{ const r = await WH.catHaal('wh-dag'); S.dag = (r && r.data) || {}; }catch(e){ S.dag = S.dag || {}; } herteken(); })();
  return S.dagLaden;
}
// alle schattingen van Claude die nog niet gecontroleerd zijn: [{ c, velden:[{k, v, uit}] }]
function twLijst(){
  if(!S.pd) return [];
  const uit = [];
  Object.entries(S.pd).forEach(([c, r]) => {
    const v = VOLG.concat(Object.keys(r.meta).filter(k => !VELD[k])).filter(k => r.meta[k] && r.meta[k].tw && r.data[k] !== undefined && r.data[k] !== '')
      .map(k => ({ k, v:String(r.data[k]), uit:r.meta[k].uit || '' }));
    if(v.length) uit.push({ c, velden:v });
  });
  return uit.sort((a, b) => (ABC[abcVan(a.c)] ?? 3) - (ABC[abcVan(b.c)] ?? 3) || naamVan(a.c).localeCompare(naamVan(b.c)));
}
async function bevestig(c, waarden){
  // waarden = { veld: waarde }; vers lezen, samenvoegen, één rij terugschrijven
  const nu = new Date().toISOString();
  const vers = await WH.api('GET', 'productdata?productcode=eq.' + encodeURIComponent(c) + '&select=productcode,data,meta');
  const r = (vers && vers[0]) || { productcode:c, data:{}, meta:{} };
  const data = Object.assign({}, r.data || {}), meta = Object.assign({}, r.meta || {});
  Object.entries(waarden).forEach(([k, v]) => {
    v = String(v ?? '').trim(); if(!v) return;
    const was = meta[k] && meta[k].tw ? ' (was schatting Claude' + (String(data[k]) !== v ? ': ' + data[k] : '') + ')' : '';
    data[k] = v; meta[k] = { op:nu, bron:'invul', uit:'gecontroleerd door ' + ik() + was };
  });
  await WH.upsert('productdata', [{ productcode:c, data, meta, updated_at:nu }], 'productcode');
  if(S.pd) S.pd[c] = { data, meta };
  if(D.PD) D.PD[c] = data;
  if(window.WHPD && WHPD.S && WHPD.S.pd) WHPD.S.pd[c] = { data, meta, t:nu };
}

/* ---------- Te controleren ---------- */
function viewNakijken(){
  const tw = twLijst(), nTw = tw.reduce((s, x) => s + x.velden.length, 0);
  const aan = window.WHAAN ? WHAAN.open() : [];
  const zonder = Object.entries(D.VR || {}).filter(([c, v]) => v.geen > 0).length;
  const tab = S.tab;
  const kop = `<div class="pagina"><h1>Te controleren</h1>
    <p class="lede">Wat Claude heeft ingevuld of aangenomen zonder dat jij het zei. Alles is al bruikbaar, maar telt pas als zeker nadat jij op <b>Klopt</b> tikt of het aanpast. Productdata-schattingen tellen tot dan als open in Poort 0.4.</p>
    <div class="x-tabs" role="tablist">
      <button role="tab" aria-selected="${tab === 'pd'}" class="${tab === 'pd' ? 'aan' : ''}" data-x="tab" data-v="pd">Productdata<b>${S.pd ? nf(nTw) : '…'}</b></button>
      <button role="tab" aria-selected="${tab === 'aan'}" class="${tab === 'aan' ? 'aan' : ''}" data-x="tab" data-v="aan">Aannames<b>${nf(aan.length)}</b></button>
      <button role="tab" aria-selected="${tab === 'data'}" class="${tab === 'data' ? 'aan' : ''}" data-x="tab" data-v="data">Uit de data</button>
    </div>`;
  let body = '';
  if(tab === 'pd'){
    if(S.pdFout) body = `<div class="blok let">Productdata laden lukte niet: ${esc(S.pdFout.message || String(S.pdFout))}</div>`;
    else if(!S.pd){ laadPd(); body = '<div class="leeg">Productdata laden…</div>'; }
    else if(!tw.length) body = '<div class="blok"><b>Niets meer te controleren in Productdata.</b></div>';
    else body = `<div class="small muted">${nf(tw.length)} producten · ${nf(nTw)} waarden · belangrijkste eerst. Pas aan waar nodig en tik <b>Klopt</b>; de waarde wordt dan jouw invoer.</div>` +
      tw.slice(0, 120).map(x => `<div class="x-kaart" data-code="${esc(x.c)}">
        <div class="x-kop"><div><span class="code">${esc(x.c)}</span>${abcVan(x.c) ? `<span class="x-abc ${esc(abcVan(x.c))}">${esc(abcVan(x.c))}</span>` : ''}<div class="small muted">${esc(naamVan(x.c).slice(0, 90))}</div></div>
          <button class="x-btn ok" data-x="alles" data-code="${esc(x.c)}">Alles klopt</button></div>
        ${x.velden.map(f => `<div class="x-rij"><b>${esc(VELD[f.k] || f.k)}</b><input data-k="${esc(f.k)}" value="${esc(f.v)}" aria-label="${esc(VELD[f.k] || f.k)}"><span class="x-why">${esc(f.uit.replace(/^Schatting Claude: /, '').replace(/^Voorstel app \((laag|mid)\): /, 'onzeker voorstel: '))}</span><button class="x-btn" data-x="een" data-code="${esc(x.c)}" data-k="${esc(f.k)}">Klopt</button></div>`).join('')}
      </div>`).join('') + (tw.length > 120 ? `<div class="small muted">Nog ${nf(tw.length - 120)} producten; die komen hier als je deze afrondt.</div>` : '');
  } else if(tab === 'aan'){
    const groepen = [...new Set(WHAAN.LIJST.map(a => a.groep))];
    body = groepen.map(g => `<section class="blok"><h2>${esc(g)}</h2>${WHAAN.LIJST.filter(a => a.groep === g).map(a => { const k = WHAAN.keus(a.id); return `<div class="x-rij" data-aan="${esc(a.id)}"><b>${esc(a.t)}</b><input class="${k && k.ok ? 'ok' : ''}" value="${esc(WHAAN.waarde(a.id))}" aria-label="${esc(a.t)}"><span class="x-why">${esc(a.waarom)}${a.eenheid ? ' · ' + esc(a.eenheid) : ''}${k && k.ok ? ` · <b style="color:var(--ok)">✓ ${esc(k.door || '')} ${esc(String(k.op || '').slice(0, 10))}</b>` : ''}</span>${k && k.ok ? `<button class="x-btn" data-x="aanterug" data-id="${esc(a.id)}">Opnieuw</button>` : `<button class="x-btn" data-x="aanok" data-id="${esc(a.id)}">Klopt</button>`}</div>`; }).join('')}</section>`).join('');
  } else {
    const bo = D.BO || [];
    body = `<section class="blok"><h2>Twijfel die uit de gegevens komt</h2><div class="tabel"><table><tbody>
      <tr><td><b>Voorraad op "geen specifieke locatie"</b><br><span class="muted">Picqer telt dit als pick, maar niemand vindt het. Tellen en op de juiste plek zetten.</span></td><td><b>${nf(zonder)}</b> producten</td><td><a class="knop" href="#/aanvullive">Live advies →</a></td></tr>
      <tr><td><b>Locatie-aandachtspunten</b><br><span class="muted">Pick op tijdelijk, vloer maar bulk, hoog maar pick, BA-dubbelingen, losse namen.</span></td><td></td><td><a class="knop" href="#/locaties">Locaties →</a></td></tr>
      <tr><td><b>Dubbel in palletlabels</b><br><span class="muted">Twee aantallen per pallet voor één product.</span></td><td></td><td><a class="knop" href="#/productdata">Productdata →</a></td></tr>
      <tr><td><b>Backorders (export)</b><br><span class="muted">Regels in de laatst ingelezen backorder-export.</span></td><td><b>${nf(bo.length)}</b></td><td><a class="knop" href="#/backorders">Backorders →</a></td></tr>
    </tbody></table></div></section>`;
  }
  return kop + body + '</div>';
}

/* ---------- kerncijfers (gedeeld door Dagstart en Stand) ---------- */
function kleur(n, id, extra){
  if(n === null || n === undefined) return '';
  const g = WHAAN.grens(id);
  if(extra === 'voor12' && n >= g.oranje) return 'oranje';
  return n >= g.rood ? 'rood' : n >= g.oranje ? 'oranje' : 'groen';
}
function cijfers(){
  const st = window.WHLIVE ? WHLIVE.status() : { code:false };
  const data = st.data;
  const P = data ? WHLIVE.picklijstCijfers(data.picklijsten) : null;
  const B = data ? WHLIVE.backorderCijfers(data.backorders) : null;
  // orders langer dan 30 dagen in backorder (oudste regel van de order)
  if(B) B.o30 = B.orderLijst.filter(o => (WHLIVE.uren(o.oudste) ?? 0) >= 30 * 24).length;
  let nu = null; try{ nu = data && st.klaar ? WHLIVE.nuLijst().length : null; }catch(e){}
  const vd = vandaag(), tn = tijdNu();
  const takenAchter = Object.values(D.TODO || {}).filter(t => t && t.titel && !t.klaar && (t.datum < vd || (t.datum === vd && t.tijd && t.tijd < tn))).length;
  const geen = Object.values(D.VR || {}).filter(v => v.geen > 0).length;
  const binnen = (D.CONT || []).filter(c => c.losdatum === vd && c.status !== 'afgerond');
  const na12 = tn >= '12:00';
  return { st, P, B, nu, takenAchter, geen, binnen, na12, live:!!data };
}
function tegels(K){
  const KL = { groen:'op schema', oranje:'let op', rood:'nu iets doen' };
  const t = (n, titel, uitleg, kl, href) => `<a class="x-tegel ${kl}" href="${href || '#/dag'}"><span class="n">${n === null || n === undefined ? '–' : nf(n)}</span><span class="t">${esc(titel)}</span><span class="u">${esc(uitleg)}</span>${KL[kl] ? `<span class="x-sr">, ${KL[kl]}</span>` : ''}</a>`;
  const geenLive = K.st.code ? (K.st.laden ? 'laden…' : K.st.fout ? 'Picqer: ' + (K.st.fout.message || 'fout') : 'nog niet geladen') : 'geen koppelcode op dit apparaat';
  return `<div class="x-tegels">
    ${t(K.P ? K.P.o12 : null, 'Orders ouder dan 12 uur', K.P ? (K.na12 ? 'na 12:00: moet 0 zijn' : 'om 12:00 moet dit 0 zijn') : geenLive, K.P ? kleur(K.P.o12, 'k-o12', K.na12 ? '' : 'voor12') : '', '#/live')}
    ${t(K.P ? K.P.o24 : null, 'Picklijsten ouder dan 24 uur', K.P ? (K.P.oudsteUur ? 'oudste ' + Math.round(K.P.oudsteUur) + ' uur' : 'geen open') : geenLive, K.P ? kleur(K.P.o24, 'k-o24') : '', '#/live')}
    ${t(K.B ? K.B.orders : null, 'Backorders', K.B ? nf(K.B.vol) + ' met alles op voorraad · waarvan ' + nf(K.B.o30) + ' > 30 dagen' : geenLive, K.B ? kleur(K.B.orders, 'k-bo') : '', '#/live')}
    ${t(K.nu, 'Nu verplaatsen open', K.nu === null ? (K.live ? 'voorraad laden…' : geenLive) : 'van bulk naar pick voor orders', K.nu === null ? '' : K.na12 ? kleur(K.nu, 'k-nu') : (K.nu ? 'oranje' : 'groen'), '#/aanvullive')}
    ${t(K.takenAchter, 'Taken achter', 'niet afgevinkt op tijd', kleur(K.takenAchter, 'k-taak'), '#/vandaag')}
    ${t(K.binnen.length, 'Inkomend vandaag', K.binnen.length ? K.binnen.map(c => c.leverancier || c.containernummer || '').filter(Boolean).slice(0, 2).join(', ') : 'geen container gepland', K.binnen.length ? 'oranje' : 'groen', '#/containers')}
  </div>`;
}

/* ---------- Dagstart ---------- */
function ritme(){
  const vd = vandaag();
  const cont = (D.CONT || []).some(c => c.losdatum === vd && c.status !== 'afgerond');
  const morgen = isoDag(Date.now() + 864e5);
  const contMorgen = (D.CONT || []).some(c => c.losdatum === morgen && c.status !== 'afgerond');
  return WHAAN.LIJST.filter(a => a.groep === 'Dagritme gewone dag' || (a.groep === 'Containerdag (extra)' && (cont || (a.id === 'c-01' && contMorgen))))
    .map(a => { const w = WHAAN.waarde(a.id), p = w.split('·').map(s => s.trim()); return { id:a.id, wat:a.t, tijd:/^\d\d:\d\d$/.test(p[0]) ? p[0] : '', wanneer:p[0], wie:p.slice(1).join(' · '), cont:a.groep !== 'Dagritme gewone dag' }; })
    .sort((a, b) => (a.tijd || (a.wanneer === 'dag ervoor' ? '00:00' : '99:99')).localeCompare(b.tijd || (b.wanneer === 'dag ervoor' ? '00:00' : '99:99')));
}
function viewDag(){
  if(!S.dag) laadDag();
  const K = cijfers(), vd = vandaag(), dg = (S.dag || {})[vd] || {}, af = dg.af || {}, tn = tijdNu();
  const R = ritme(); const volgende = R.find(r => !af[r.id] && r.tijd && r.tijd >= tn) || null;
  const nAf = R.filter(r => af[r.id]).length;
  const tw = S.pd ? twLijst().length : null;
  if(!S.pd) laadPd();
  return `<div class="pagina"><h1>Dagstart · ${esc(new Date().toLocaleDateString('nl-NL', { weekday:'long', day:'numeric', month:'long' }))}</h1>
    <p class="lede">Zes cijfers, het ritme van de dag en het ochtendoverleg. Groen = op schema, oranje = let op, rood = nu iets doen. Grenzen en tijden staan onder Te controleren (aannames).</p>
    ${tegels(K)}
    <section class="blok"><div class="x-kop"><h2>Ritme van vandaag</h2><span class="small muted">${nf(nAf)} van ${nf(R.length)} gedaan${volgende ? ' · volgende: ' + esc(volgende.tijd) + ' ' + esc(volgende.wat) : ''}</span></div>
      <div class="x-ritme">${R.map(r => `<label class="${af[r.id] ? 'af' : ''}${volgende && volgende.id === r.id ? ' nu' : ''}"><input type="checkbox" id="x-r-${esc(r.id)}" data-x="ritme" data-id="${esc(r.id)}" ${af[r.id] ? 'checked' : ''}><span class="tijd">${esc(r.tijd || r.wanneer)}</span><span><span class="wat">${esc(r.wat)}</span>${r.cont ? ' <span class="x-abc">container</span>' : ''}<div class="wie">${esc(r.wie)}${af[r.id] ? ' · gedaan ' + esc(String(af[r.id].op || '').slice(11, 16)) + ' door ' + esc(af[r.id].door || '') : ''}</div></span><span></span></label>`).join('')}</div>
    </section>
    <section class="blok"><h2>Ochtendoverleg (Kate en Sala, 07:00)</h2>
      <ul class="small" style="padding-left:18px;display:grid;gap:4px">
        <li>Oudste open picklijst: <b>${K.P && K.P.oudsteUur ? Math.round(K.P.oudsteUur) + ' uur' : '–'}</b> · urgent: <b>${K.P ? nf(K.P.urgent) : '–'}</b></li>
        <li>Backorders die met verplaatsen vrijkomen: <b>${K.B ? nf(K.B.vol) : '–'}</b> orders → <a href="#/aanvullive">Nu verplaatsen</a></li>
        <li>Inkomend vandaag: <b>${K.binnen.length ? K.binnen.map(c => esc((c.leverancier || '') + ' ' + (c.lostijd || ''))).join(', ') : 'niets gepland'}</b></li>
        <li>Producten op "geen specifieke locatie": <b>${nf(K.geen)}</b> (export ${esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–')})</li>
        <li>Te controleren voor Daan: <b>${tw === null ? '…' : nf(tw)}</b> producten · <a href="#/nakijken">openen</a></li>
      </ul>
      <label class="small" for="x-notitie"><b>Verdeling vandaag</b> (wie doet wat, prioriteiten, aandachtspunten)</label>
      <textarea id="x-notitie" class="x-notitie" placeholder="Bijv. Kate: containers + AD/AE · Sala: verzenden + CF · Valerii: Nu verplaatsen, daarna aanvulronde hal B">${esc(dg.notitie || '')}</textarea>
      <div class="x-kop"><span class="small muted">${dg.notitieOp ? 'Opgeslagen ' + esc(String(dg.notitieOp).slice(11, 16)) + ' door ' + esc(dg.notitieDoor || '') : 'Nog niet ingevuld'}</span><button class="x-btn pri" data-x="notitie">Opslaan</button></div>
    </section></div>`;
}
async function zetDag(patch){
  const vd = vandaag();
  S.dag = S.dag || {};
  const dg = Object.assign({}, S.dag[vd] || {}, patch);
  S.dag[vd] = dg;
  // alleen de laatste 21 dagen bewaren
  const weg = Object.keys(S.dag).filter(d => d < isoDag(Date.now() - 21 * 864e5));
  await WH.catPatch('wh-dag', Object.assign({ [vd]:dg }, Object.fromEntries(weg.map(d => [d, null]))));
}

/* ---------- Hoe staat het magazijn ervoor (management) ---------- */
function viewStand(){
  if(!S.dag) laadDag();
  if(!S.pd) laadPd();
  const K = cijfers(), vd = vandaag(), dg = (S.dag || {})[vd] || {}, gis = (S.dag || {})[isoDag(Date.now() - 864e5)] || {};
  let d04 = null; try{ d04 = window.WHTAAK && window.WHPD ? WHTAAK.data04() : null; if(!d04 && window.WHTAAK) WHTAAK.pdLaden().then(herteken); }catch(e){}
  const pdPct = d04 && d04.P.bel.length ? Math.floor((d04.P.bel.length - d04.open.length) / d04.P.bel.length * 100) : null;
  // locatie-aandachtspunten: telling uit wh/locaties.js (zonder besliste uitzonderingen en verwerkte besluiten)
  let locA = null; try{ const T = window.WHLOC ? WHLOC.telling() : null; if(T && T.geladen) locA = T.werk; else if(window.WHL && WHL.locStats){ const a = WHL.locStats().aand || {}; locA = Object.values(a).reduce((s, x) => s + (Array.isArray(x) ? x.length : 0), 0); } }catch(e){}
  const contN = (D.CONT || []).filter(c => c.status !== 'afgerond' && c.losdatum && c.losdatum >= vd && c.losdatum <= isoDag(Date.now() + 14 * 864e5));
  const tw = S.pd ? twLijst().length : null;
  const daanOpen = Object.values(D.TODO || {}).filter(t => t && t.titel && !t.klaar && (t.wie || []).includes('Daan') && t.datum <= vd).length;
  const p = (nr, titel, meting, kl, uitleg, href) => `<div class="x-punt ${kl}"><span class="nr">${nr}</span><b>${esc(titel)}</b><span class="m">${meting}</span><span class="small muted">${uitleg}</span>${href ? `<a class="small" href="${href}">bekijken →</a>` : ''}</div>`;
  const geenBron = 'nog geen bron';
  return `<div class="pagina"><h1>Hoe staat het magazijn ervoor</h1>
    <p class="lede">De tien punten waarop Daan het magazijn beoordeelt, met het cijfer dat de app er nu over kan geven. Alleen lezen. Grijs = nog niet meetbaar.</p>
    ${tegels(K)}
    <div class="x-punten">
      ${p(1, 'Ochtend: planning staat', dg.notitie ? '✓ verdeeld' : '–', dg.notitie ? 'groen' : (tijdNu() > '07:30' ? 'oranje' : ''), dg.notitie ? 'Ochtendoverleg ingevuld om ' + esc(String(dg.notitieOp || '').slice(11, 16)) : 'Verdeling van vandaag nog niet ingevuld', '#/dag')}
      ${p(2, 'Picqer klopt: niets op geen specifieke locatie', nf(K.geen) + ' producten', kleur(K.geen, 'k-geen'), 'Voorraad op geen specifieke locatie (export ' + esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–') + ')' + (locA !== null ? ' · ' + nf(locA) + ' locatie-aandachtspunten' : ''), '#/locaties')}
      ${p(3, 'Verpakking en maatpallets op orde', '–', '', geenBron + ' (kennisbank E5)', '')}
      ${p(4, 'Vloer vrij en berijdbaar', (gis.af || {})['d-10'] ? '✓ gisteren' : '–', (gis.af || {})['d-10'] ? 'groen' : '', 'Einde-dag-check (16:30) afgevinkt in Dagstart', '#/dag')}
      ${p(5, 'Pickers op prioriteit', K.P ? nf(K.P.urgent) + ' urgent open' : '–', K.P ? (K.P.urgent ? 'oranje' : 'groen') : '', 'Urgente picklijsten die nog open staan', '#/live')}
      ${p(6, 'Containerdag volgens plan', nf(contN.length) + ' in 14 dagen', contN.length ? '' : 'groen', contN.slice(0, 3).map(c => esc((c.losdatum || '').slice(5) + ' ' + (c.leverancier || ''))).join(' · ') || 'geen gepland', '#/containers')}
      ${p(7, 'Inrichting op logica', pdPct !== null ? pdPct + '% productdata' : '…', pdPct === null ? '' : pdPct >= 100 ? 'groen' : pdPct >= 85 ? 'oranje' : 'rood', 'Belangrijke producten met complete productdata (Poort 0.4)' + (locA !== null ? ' · ' + nf(locA) + ' locatie-aandachtspunten open' : '') + '; herindeling volgt na de analyses', '#/todo')}
      ${p(8, 'Verzenden juist verpakt', '–', '', geenBron + ' (kennisbank E6/E8)', '')}
      ${p(9, '12:00: orders ouder dan 12 uur verwerkt', K.P ? nf(K.P.o12) : '–', K.P ? kleur(K.P.o12, 'k-o12', K.na12 ? '' : 'voor12') : '', K.na12 ? 'Na 12:00 moet dit 0 zijn' : 'Vóór 12:00: dit moet om 12:00 op 0 staan', '#/live')}
      ${p(10, 'Daan managet in plaats van oplost', nf(daanOpen) + ' taken · ' + (tw === null ? '…' : nf(tw)) + ' te controleren', daanOpen + (tw || 0) ? 'oranje' : 'groen', 'Open taken voor Daan en wat hij nog moet nakijken', '#/nakijken')}
    </div></div>`;
}

/* ---------- Product zoeken (vloer) ---------- */
function zoekRes(q){
  q = String(q || '').trim().toLowerCase(); if(q.length < 2) return [];
  const exact = D.PLOW[q]; const uit = [];
  if(exact) uit.push(exact);
  for(const c of Object.keys(D.P)){
    if(uit.length >= 25) break;
    if(c === exact) continue;
    const p = D.P[c];
    if(c.toLowerCase().includes(q) || String(p.ean || '') === q || String(p.naam || '').toLowerCase().includes(q)) uit.push(c);
  }
  return uit.sort((a, b) => (a === exact ? -1 : b === exact ? 1 : 0) || (ABC[abcVan(a)] ?? 3) - (ABC[abcVan(b)] ?? 3));
}
function locs(c){
  const vr = D.VR[c] || { locs:{}, geen:0, cont:{} }, pick = [], bulk = [];
  Object.entries(vr.locs || {}).forEach(([l, n]) => (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, n]));
  String((D.P[c] || {}).locaties_hm || '').split(/[,|]/).map(s => s.trim()).filter(l => l && !/^container/i.test(l)).forEach(l => {
    if(!pick.some(x => x[0] === l) && !bulk.some(x => x[0] === l)) (D.LOC[l] && D.LOC[l].bulk ? bulk : pick).push([l, 0]);
  });
  return { pick, bulk, geen:vr.geen || 0, kar:Object.entries(vr.cont || {}) };
}
function viewZoek(){
  const res = S.gekozen ? [] : zoekRes(S.zoek);
  let det = '';
  if(S.gekozen && D.P[S.gekozen]){
    const c = S.gekozen, p = D.P[c], L = locs(c), pd = (S.pd && S.pd[c] && S.pd[c].data) || D.PD[c] || {};
    const f = (k, t) => pd[k] ? `<li><span>${esc(t)}</span><b>${esc(pd[k])}</b></li>` : '';
    det = `<div class="x-kaart"><div class="x-kop"><div><span class="code">${esc(c)}</span>${p.abc ? `<span class="x-abc ${esc(p.abc)}">${esc(p.abc)}</span>` : ''}<div>${esc(pd.vn || p.naam || '')}</div><div class="small muted">${esc(p.naam || '')}${p.ean ? ' · EAN ' + esc(p.ean) : ''}</div></div><button class="x-btn" data-x="terug">← zoeken</button></div>
      <div><div class="small muted">Picklocatie</div><div class="x-loc">${L.pick.length ? L.pick.map(([l, n]) => `<span class="pick">${esc(l)} · ${nf(n)}</span>`).join('') : '<span>geen picklocatie</span>'}</div></div>
      <div><div class="small muted">Bulk en overige voorraad</div><div class="x-loc">${L.bulk.length ? L.bulk.map(([l, n]) => `<span>${esc(l)} · ${nf(n)}</span>`).join('') : (L.geen || L.kar.length ? '' : '<span>–</span>')}${L.geen ? `<span style="background:#fde2e1">geen specifieke locatie · ${nf(L.geen)}</span>` : ''}${L.kar.map(([l, n]) => `<span style="background:#fff2d6">${esc(l)} · ${nf(n)}</span>`).join('')}</div></div>
      <ul class="x-feit">${f('spd', 'Stuks per doos')}${f('spp', 'Stuks per pallet')}${f('maxpick', 'Max op pick')}${f('lvl', 'Aanvullen bij')}${f('opm', 'Let op')}</ul>
      <div class="small muted">Voorraad Hoofdmagazijn ${nf(p.voorraad_hm || 0)}${p.voorraad_vst ? ' · VST ' + nf(p.voorraad_vst) : ''} · locaties volgens export ${esc(D.VRDATUM ? String(D.VRDATUM).slice(0, 10) : '–')}</div>
      <b>Klopt er iets niet? Meld het (gaat naar Kate en Sala):</b>
      <div class="x-meld">
        <button class="x-btn" data-x="meld" data-v="Plek leeg">Plek leeg</button>
        <button class="x-btn" data-x="meld" data-v="Aantal klopt niet">Aantal klopt niet</button>
        <button class="x-btn" data-x="meld" data-v="Ligt op verkeerde plek">Verkeerde plek</button>
        <button class="x-btn" data-x="meld" data-v="Beschadigd">Beschadigd</button>
      </div></div>`;
  }
  return `<div class="pagina"><h1>Product zoeken</h1>
    <div class="x-zoek"><input id="x-zoek" type="search" inputmode="search" autocomplete="off" placeholder="Code, naam of EAN (scan)" value="${esc(S.zoek)}" aria-label="Zoek product"></div>
    ${det}
    ${!S.gekozen && S.zoek.trim().length >= 2 ? (res.length ? `<div class="x-res">${res.map(c => { const L = locs(c); return `<button data-x="kies" data-code="${esc(c)}"><b>${esc(c)}</b><span class="small">${esc(naamVan(c).slice(0, 80))}</span><span class="small muted">${L.pick.length ? 'pick ' + esc(L.pick.map(x => x[0]).join(', ')) : 'geen picklocatie'}${L.bulk.length ? ' · bulk ' + esc(L.bulk.slice(0, 3).map(x => x[0]).join(', ')) : ''}</span></button>`; }).join('')}</div>` : '<div class="leeg">Niets gevonden.</div>') : ''}
  </div>`;
}
async function meld(soort){
  const c = S.gekozen; if(!c) return;
  const L = locs(c), id = 'meld-' + Date.now().toString(36);
  const taak = { id, titel:soort + ': ' + c + (L.pick[0] ? ' (' + L.pick[0][0] + ')' : ''), noot:naamVan(c).slice(0, 80) + ' · gemeld via Product zoeken', wie:['Kate', 'Sala'], datum:vandaag(), tijd:'', herhaal:null, prio:1, door:ik(), op:new Date().toISOString(), klaar:null };
  D.TODO = Object.assign({}, D.TODO, { [id]:taak });
  try{ await WH.catPatch('wh-todo', { [id]:taak }); toast('Gemeld: ' + soort); }catch(e){ toast('Melden lukte niet'); }
}

/* ---------- Hulp: per rol wat je ziet en wat je doet ---------- */
const HULP = [
  { rol:'daan', t:'Daan', z:[
    'Je start op Te doen: de bouwplanstap van nu, wat vandaag moet, en bovenaan Te controleren met wat Claude heeft geschat of aangenomen.',
    'Tik bij Te controleren op Klopt of pas de waarde aan; bij Locaties tik je een tegel, beslis je per regel met één knop en ga je via Naar import altijd langs een verse export (maximaal 2 uur oud).',
    'Importbestanden upload je zelf in Picqer, de eerste keer per soort eerst het testbestand met 2 regels; de app schrijft nooit naar Picqer.'] },
  { rol:'karin', t:'Karin', z:[
    'Je start op Dagstart: zes kerncijfers (groen op schema, oranje let op, rood nu iets doen), het ritme van de dag en het ochtendoverleg.',
    'Vink in het ritme af wat gedaan is, zoals Van VST om 14:00 en op containerdag de Stockmove; bij Containers zie je wat er binnenkomt.',
    'Aanvullen en Product zoeken staan in het menu; wijzigingen doe je zelf in Picqer, de app leest alleen.'] },
  { rol:'vloer', t:'Vloer (Kate, Sala, Valerii, pickers)', z:[
    'Je start op Dagstart: de cijfers van vandaag en het ritme; Kate en Sala verdelen om 07:00 het werk en vullen Verdeling vandaag in.',
    'Rijders doen eerst Nu verplaatsen (wat een order vrijmaakt), dan de aanvulronde: eerst de retourkar terugzetten, en een volle pallet pakken waar dat bij het product staat.',
    'Klopt er iets niet, zoek het product op in Product zoeken en tik de meldknop; Kate en Sala krijgen dan een taak.'] },
  { rol:'mgmt', t:'Management (Jim, Maxime, Ryan, Gino)', z:[
    'Je start op Hoe staat het ervoor: de tien punten waarop Daan het magazijn beoordeelt, met het cijfer dat de app er nu over kan geven.',
    'Grijs is nog niet meetbaar, groen op schema, oranje let op, rood nu iets doen; bovenaan staan dezelfde zes kerncijfers als op Dagstart.',
    'Je kijkt alleen, je verandert niets; vragen of keuzes gaan naar Daan.'] }
];
function viewHulp(){
  let rol = 'daan'; try{ rol = localStorage.getItem('ivol-rol') || 'daan'; }catch(e){}
  const lijst = HULP.slice().sort((a, b) => (b.rol === rol) - (a.rol === rol));
  return `<div class="pagina"><h1>Hulp</h1>
    <p class="lede">Per rol in drie zinnen: wat je ziet en wat je doet. Kies je rol rechtsboven; die van jou staat bovenaan.</p>
    ${lijst.map(h => `<section class="blok"${h.rol === rol ? ' style="border-left:6px solid #f08a4b"' : ''}><h2>${esc(h.t)}${h.rol === rol ? ' <span class="x-abc">jouw rol</span>' : ''}</h2><ol class="stappen">${h.z.map(z => `<li>${esc(z)}</li>`).join('')}</ol></section>`).join('')}
    <section class="blok"><h2>Altijd zo</h2><ul class="small" style="padding-left:18px;display:grid;gap:4px">
      <li>De app leest alleen uit Picqer. Iets veranderen doe je in Picqer zelf, of met een importbestand dat Daan uploadt.</li>
      <li>Tijden in 24 uur. "Nieuwe versie klaar" bovenin: tik Vernieuwen als je niet aan het typen bent.</li>
      <li>Iets vreemds gezien? Meld het via Product zoeken of bij Daan.</li></ul></section></div>`;
}

/* ---------- tekenen en klikken ---------- */
function herteken(){
  if(!S.el || S.el.hidden) return;
  const actief = document.activeElement, id = actief && actief.id, pos = actief && actief.selectionStart;
  const y = S.el.scrollTop;
  S.el.innerHTML = S.naam === 'nakijken' ? viewNakijken() : S.naam === 'dag' ? viewDag() : S.naam === 'stand' ? viewStand() : S.naam === 'hulp' ? viewHulp() : viewZoek();
  S.el.scrollTop = y;
  if(id && $(id)){ const e = $(id); e.focus(); try{ if(pos != null) e.setSelectionRange(pos, pos); }catch(x){} }
}
function render(naam, el, rest){
  stijl();
  S.naam = naam; S.el = el; S.rest = rest || '';
  el.innerHTML = '<div class="leeg">Laden…</div>';
  // IVOL bestaat pas als ivol.js klaar is met opstarten; eerst de gedeelde gegevens (WH.load)
  (async () => { while(!window.IVOL) await new Promise(r => setTimeout(r, 50)); await IVOL.geladen(); })().then(() => Promise.all([window.WHAAN ? WHAAN.laad() : null])).then(() => {
    if(naam === 'zoek' && rest){ const c = D.PLOW[decodeURIComponent(rest).toLowerCase()]; if(c){ S.gekozen = c; S.zoek = c; } }
    if(['dag', 'stand'].includes(naam) && window.WHLIVE){ const st = WHLIVE.status(); if(st.code && !st.data && !st.laden) WHLIVE.laad(); }
    herteken();
  });
}
let gebonden = false;
function bind(){
  if(gebonden) return; gebonden = true;
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-x]'); if(!b || !S.el || !S.el.contains(b)) return;
    const x = b.dataset.x;
    try{
      if(x === 'tab'){ S.tab = b.dataset.v; herteken(); }
      else if(x === 'een' || x === 'alles'){
        const kaart = b.closest('.x-kaart'), c = b.dataset.code, w = {};
        kaart.querySelectorAll('input[data-k]').forEach(i => { if(x === 'alles' || i.dataset.k === b.dataset.k) w[i.dataset.k] = i.value; });
        b.disabled = true; await bevestig(c, w); toast(x === 'alles' ? c + ': alles bevestigd' : c + ': ' + (VELD[b.dataset.k] || b.dataset.k) + ' bevestigd'); herteken();
      }
      else if(x === 'aanok'){ const rij = b.closest('[data-aan]'); b.disabled = true; await WHAAN.zet(b.dataset.id, rij.querySelector('input').value.trim()); herteken(); }
      else if(x === 'aanterug'){ await WHAAN.terug(b.dataset.id); herteken(); }
      else if(x === 'notitie'){ b.disabled = true; await zetDag({ notitie:$('x-notitie').value, notitieOp:new Date().toISOString(), notitieDoor:ik() }); toast('Verdeling opgeslagen'); herteken(); }
      else if(x === 'kies'){ S.gekozen = b.dataset.code; herteken(); }
      else if(x === 'terug'){ S.gekozen = null; herteken(); const z = $('x-zoek'); if(z) z.focus(); }
      else if(x === 'meld'){ b.disabled = true; await meld(b.dataset.v); b.disabled = false; }
    }catch(err){ console.error(err); toast('Opslaan lukte niet: ' + (err.message || err)); b.disabled = false; }
  });
  document.addEventListener('change', async e => {
    const i = e.target.closest('[data-x="ritme"]'); if(!i || !S.el || !S.el.contains(i)) return;
    const vd = vandaag(), af = Object.assign({}, ((S.dag || {})[vd] || {}).af || {});
    if(i.checked) af[i.dataset.id] = { op:new Date().toISOString().replace(/\.\d+Z$/, 'Z'), door:ik() }; else delete af[i.dataset.id];
    // tijd in Nederland voor de weergave
    if(af[i.dataset.id]){ const d = new Date(); af[i.dataset.id].op = isoDag(d.getTime()) + 'T' + tijdNu() + ':00'; }
    try{ await zetDag({ af }); }catch(err){ toast('Opslaan lukte niet'); }
    herteken();
  });
  document.addEventListener('input', e => {
    if(e.target.id !== 'x-zoek') return;
    S.zoek = e.target.value; S.gekozen = null;
    clearTimeout(S.zt); S.zt = setTimeout(herteken, 150);
  });
  document.addEventListener('keydown', e => {
    if(e.target.id === 'x-zoek' && e.key === 'Enter'){ const r = zoekRes(S.zoek); if(r.length){ S.gekozen = r[0]; herteken(); } }
  });
  if(window.WHLIVE) WHLIVE.opNieuw(() => { if(['dag', 'stand'].includes(S.naam)) herteken(); });
}
bind();
// banner bovenaan Te doen: wat er nog te controleren is (alleen als er iets is).
// Te doen tekent zichzelf geregeld opnieuw: een observer zet de banner er dan weer boven.
let bannerHtml = '', obs = null;
function zetBanner(el){
  if(!bannerHtml || !el || el.hidden || el.querySelector('#x-banner')) return;
  if(!window.IVOL || (IVOL.huidig() || {}).id !== 'todo') return;
  const d = document.createElement('div'); d.id = 'x-banner'; d.innerHTML = bannerHtml; el.prepend(d);
}
async function banner(el){
  try{
    await (async () => { while(!window.IVOL) await new Promise(r => setTimeout(r, 50)); await IVOL.geladen(); })();
    await Promise.all([window.WHAAN ? WHAAN.laad() : null, laadPd()]);
    const n = twLijst().length, a = window.WHAAN ? WHAAN.open().length : 0;
    stijl();
    bannerHtml = n + a ? `<div class="pagina" style="padding-bottom:0"><a class="x-kaart" href="#/nakijken" style="text-decoration:none;color:inherit;border-left:6px solid #e0a100"><div class="x-kop"><div><b>Te controleren</b><div class="small muted">${n ? nf(n) + ' producten met een schatting van Claude' : ''}${n && a ? ' · ' : ''}${a ? nf(a) + ' aannames (kerncijfers, dagritme, regels)' : ''}. Tik Klopt of pas aan; tot dan tellen ze als open.</div></div><span class="x-btn pri">Openen →</span></div></a></div>` : '';
    zetBanner(el);
    if(!obs && window.MutationObserver){ obs = new MutationObserver(() => zetBanner(el)); obs.observe(el, { childList:true }); }
  }catch(e){ console.error(e); }
}
return { render, herteken, twLijst, laadPd, cijfers, banner, S };
})();
