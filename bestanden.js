/* =====================================================================
   bestanden.js — gedeelde bestandsnamen en bewaar-knop voor alle Magazijn-Tools
   Eén plek voor: hoe een bestand heet, in welke map het hoort, en hoe je het bewaart.
   Mappen (in 02_Werk_IVOL):
     01_Container_planning/01_Pakbonnen      pakbon van de leverancier
     01_Container_planning/02_Losdag         losplanning-PDF, werkbon, losdag-overzicht
     01_Container_planning/03_Palletlabels   palletlabels + aanvulpallet-labels
     01_Container_planning/04_Stockmove      Stockmove-lijst (.txt) en movement-PDF's
     01_Container_planning/05_Ontvangsten    Picqer-inruimlijsten
     01_Container_planning/06_Back-ups       back-up van de app
     07_Tools_en_app_bronnen/Productgeheugen_back-ups
   ===================================================================== */
(function(){
  'use strict';
  const BASIS = '02_Werk_IVOL';
  const MAPPEN = {
    pakbon:       '01_Container_planning/01_Pakbonnen',
    losplanning:  '01_Container_planning/02_Losdag',
    werkbon:      '01_Container_planning/02_Losdag',
    overzicht:    '01_Container_planning/02_Losdag',
    palletlabels: '01_Container_planning/03_Palletlabels',
    aanvullabel:  '01_Container_planning/03_Palletlabels',
    stockmove:    '01_Container_planning/04_Stockmove',
    ontvangst:    '01_Container_planning/05_Ontvangsten',
    backup:       '01_Container_planning/06_Back-ups',
    geheugen:     '07_Tools_en_app_bronnen/Productgeheugen_back-ups'
  };
  const EXT = { stockmove:'txt', backup:'json', geheugen:'json' };

  const schoon = s => String(s == null ? '' : s).replace(/[\/\\:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
  const dd = n => String(n).padStart(2, '0');
  function datum(v){
    if(!v) return '';
    if(v instanceof Date) return v.getFullYear() + '-' + dd(v.getMonth() + 1) + '-' + dd(v.getDate());
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }
  const vandaag = () => datum(new Date());
  const tijdNu = () => { const n = new Date(); return dd(n.getHours()) + dd(n.getMinutes()); };

  // "Wallace NL-297 ONEU0155945": leverancier, pakbonreferentie, containernummer (dubbele delen vervallen)
  function id(o){
    const d = [];
    [o.lev, o.ref, o.cont].forEach(x => { x = schoon(x); if(x && !d.some(y => y.toLowerCase() === x.toLowerCase())) d.push(x); });
    return d.join(' ');
  }
  // meerdere containers in één naam: "Wallace NL-297 en NL-298 + Hongle MIEU3705636"
  function samen(items){
    const perLev = [];
    (items || []).forEach(o => {
      const lev = schoon(o.lev), rest = schoon(o.ref || o.cont);
      let g = perLev.find(x => x.lev === lev); if(!g){ g = { lev, delen:[] }; perLev.push(g); }
      if(rest && !g.delen.includes(rest)) g.delen.push(rest);
    });
    return perLev.map(g => [g.lev, g.delen.join(' en ')].filter(Boolean).join(' ')).join(' + ');
  }
  const datumTxt = o => { const d = datum(o.datum); return d ? ' ' + (o.verwacht ? 'ETA ' : '') + d + (o.tijd ? ' ' + String(o.tijd).replace(/\D/g, '') : '') : ''; };

  function naam(soort, o){
    o = o || {};
    const ext = String(o.ext || EXT[soort] || 'pdf').replace(/^\./, '');
    const cid = id(o);
    let n;
    switch(soort){
      case 'pakbon':       n = (cid || 'Pakbon') + (cid ? ' - Pakbon' : ''); break;
      case 'losplanning':  n = (cid || 'Container') + ' - Losplanning' + datumTxt(o); break;
      case 'werkbon':      n = (cid || 'Container') + ' - Werkbon' + datumTxt(o); break;
      case 'overzicht':    n = 'Losdag-overzicht' + datumTxt(o) + (o.items && o.items.length ? ' - ' + samen(o.items) : (cid ? ' - ' + cid : '')); break;
      case 'palletlabels': n = (cid ? cid + ' - ' : '') + 'Palletlabels' + datumTxt(o) + (o.tekst ? ' - ' + schoon(o.tekst) : ''); break;
      case 'aanvullabel':  n = 'Aanvulpallet-label ' + schoon(o.tekst || o.code || '') + (o.datum ? ' ' + datum(o.datum) : ''); break;
      case 'stockmove':    n = (cid || 'Container') + ' - Stockmove' + datumTxt(o); break;
      case 'backup':       n = 'Containerplanning back-up ' + (datum(o.datum) || vandaag()) + ' ' + (o.tijd || tijdNu()); break;
      case 'geheugen':     n = 'Productgeheugen palletlabels ' + (datum(o.datum) || vandaag()) + (o.aantal ? ' (' + o.aantal + ' producten)' : ''); break;
      default:             n = schoon(o.tekst || 'Bestand');
    }
    n = schoon(n).replace(/\s+-\s+-\s+/g, ' - ');
    if(n.length > 120) n = n.slice(0, 120).trim();
    return n + '.' + ext;
  }
  const mapPad = soort => MAPPEN[soort] || '';
  const mapTekst = soort => MAPPEN[soort] ? BASIS + ' › ' + MAPPEN[soort].split('/').join(' › ') : '';

  /* ---------- bewaren / openen / delen ---------- */
  function download(blob, bestandsnaam){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = bestandsnaam; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
  }

  function css(){
    if(document.getElementById('bst-css')) return;
    const s = document.createElement('style'); s.id = 'bst-css';
    s.textContent = `
      #bst-ov{position:fixed;inset:0;z-index:99999;background:rgba(10,15,22,.55);display:flex;align-items:flex-end;justify-content:center;padding:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      #bst-ov .bst{width:100%;max-width:460px;background:#fff;color:#14202b;border-radius:14px;padding:18px 18px 14px;box-shadow:0 12px 40px rgba(0,0,0,.35)}
      #bst-ov h3{margin:0 0 8px;font-size:15px;font-weight:600;color:#5b6673}
      #bst-ov .bst-n{font-size:16px;font-weight:700;word-break:break-word;line-height:1.35;user-select:all;-webkit-user-select:all}
      #bst-ov .bst-m{margin-top:10px;font-size:13px;line-height:1.45;color:#39434f}
      #bst-ov .bst-m b{color:#14202b}
      #bst-ov .bst-h{margin-top:8px;font-size:12px;line-height:1.45;color:#6b7684}
      #bst-ov .bst-b{display:flex;flex-direction:column;gap:8px;margin-top:14px}
      #bst-ov button{font:inherit;font-size:16px;font-weight:600;border-radius:10px;padding:13px 14px;border:1px solid #cfd6de;background:#f3f5f8;color:#14202b;cursor:pointer}
      #bst-ov button.p{background:#1d4ea0;border-color:#1d4ea0;color:#fff}
      #bst-ov button.x{background:transparent;border-color:transparent;color:#5b6673;font-weight:500;padding:8px}
      @media (prefers-color-scheme:dark){
        #bst-ov .bst{background:#1a222c;color:#e8edf4}
        #bst-ov h3{color:#9aa7b8} #bst-ov .bst-m{color:#c3cdd9} #bst-ov .bst-m b{color:#e8edf4} #bst-ov .bst-h{color:#8b97a6}
        #bst-ov button{background:#232e3b;border-color:#334152;color:#e8edf4}
        #bst-ov button.p{background:#2f6bd6;border-color:#2f6bd6;color:#fff}
        #bst-ov button.x{color:#9aa7b8}
      }
      @media (min-width:600px){#bst-ov{align-items:center}}`;
    document.head.appendChild(s);
  }

  // Toont "Bestand klaar" met de juiste naam en map. blob = het bestand, soort = zie MAPPEN.
  function aanbieden(blob, bestandsnaam, soort, opties){
    opties = opties || {};
    css();
    const oud = document.getElementById('bst-ov'); if(oud){ if(oud.__url) URL.revokeObjectURL(oud.__url); oud.remove(); }
    const type = blob.type || (/\.pdf$/i.test(bestandsnaam) ? 'application/pdf' : /\.txt$/i.test(bestandsnaam) ? 'text/plain' : 'application/octet-stream');
    const typed = blob.type ? blob : new Blob([blob], { type });
    const url = URL.createObjectURL(typed);
    const file = (typeof File === 'function') ? new File([typed], bestandsnaam, { type }) : null;
    const kanDelen = !!(file && navigator.canShare && navigator.share && navigator.canShare({ files:[file] }));
    const kanOpen = /pdf|text|image/.test(type);
    const map = mapTekst(soort);
    const ov = document.createElement('div'); ov.id = 'bst-ov'; ov.__url = url;
    ov.innerHTML = `<div class="bst" role="dialog" aria-label="Bestand klaar">
      <h3>${opties.titel || 'Bestand klaar'}</h3>
      <div class="bst-n"></div>
      ${map ? `<div class="bst-m">Hoort in: <b></b></div>` : ''}
      <div class="bst-h">Bewaren zet het bestand met deze naam in je downloadmap (stel Safari in op <b>01_Inbox</b>). Delen laat je de map zelf kiezen.</div>
      <div class="bst-b">
        <button class="p" data-a="bewaar">Bewaren</button>
        ${kanOpen ? '<button data-a="open">Openen om te printen</button>' : ''}
        ${kanDelen ? '<button data-a="deel">Delen / in map bewaren…</button>' : ''}
        <button class="x" data-a="sluit">Sluiten</button>
      </div></div>`;
    ov.querySelector('.bst-n').textContent = bestandsnaam;
    if(map) ov.querySelector('.bst-m b').textContent = map;
    const sluit = () => { ov.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
    ov.addEventListener('click', async e => {
      if(e.target === ov){ sluit(); return; }
      const b = e.target.closest('button[data-a]'); if(!b) return;
      const a = b.dataset.a;
      if(a === 'bewaar'){ download(typed, bestandsnaam); b.textContent = 'Bewaard — kijk in je downloads'; }
      else if(a === 'open'){ const w = window.open(url, '_blank'); if(!w) location.href = url; }
      else if(a === 'deel'){ try{ await navigator.share({ files:[file], title:bestandsnaam }); }catch(err){ /* geannuleerd */ } }
      else if(a === 'sluit') sluit();
    });
    document.body.appendChild(ov);
    window.__bestand = { naam:bestandsnaam, soort, map, url, grootte:typed.size };   // voor tests en controle
    return { naam:bestandsnaam, url };
  }

  window.addEventListener('hashchange', () => { const o = document.getElementById('bst-ov'); if(o) o.remove(); });


  /* ---------- afdrukken / "Bewaar als PDF": de browser neemt document.title als bestandsnaam ----------
     Volgorde: Bestanden.printAls(naam) vlak voor window.print() → element met data-printnaam →
     printkop (.pkop b) → paginatitel + actief menu-onderdeel. Datum (en tijd) gaan erachter. */
  let printEigen = null, printT0 = null;
  function printAls(n){ printEigen = n; }
  function printTitel(){
    if(printEigen) return printEigen;
    const el = document.querySelector('[data-printnaam]');
    if(el && el.dataset.printnaam) return el.dataset.printnaam;
    const kop = document.querySelector('.pkop b');
    if(kop && kop.textContent.trim()) return kop.textContent.replace(/^\s*IVOL\s*·\s*/, '');
    const sub = ['#subnav a.on', '#nav a.on', 'nav a.on', '.tabs a.on', '.tab.on'].map(q => document.querySelector(q)).find(Boolean);
    const basis = (printT0 || document.title).replace(/\s*[·—–|]\s*/g, ' - ');
    const st = sub ? sub.textContent.trim() : '';
    return basis + (st && !basis.toLowerCase().endsWith(st.toLowerCase()) ? ' - ' + st : '');
  }
  function printNaam(){
    let t = schoon(printTitel().replace(/\s*·\s*/g, ' - '));
    if(!/\d{4}-\d{2}-\d{2}/.test(t)) t += ' ' + vandaag() + ' ' + tijdNu();
    return t.slice(0, 140);
  }
  window.addEventListener('beforeprint', () => {
    if(printT0 === null) printT0 = document.title;
    document.title = printNaam();
  });
  window.addEventListener('afterprint', () => {
    if(printT0 !== null) document.title = printT0;
    printT0 = null; printEigen = null;
  });

  window.Bestanden = { MAPPEN, naam, id, samen, datum, vandaag, mapPad, mapTekst, download, aanbieden, schoon, printAls, printNaam };
})();
