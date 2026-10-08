// =====================================================================
//  IVOL Warehouse — TESTDATA aanmaken in de Picqer-TESTOMGEVING (ivol-dev)
//  Supabase Edge Function "picqer-seed". Dit is de ENIGE functie die naar Picqer
//  mag SCHRIJVEN, en alleen naar de testomgeving. De echte functie "picqer",
//  de echte Picqer (ivol.picqer.com) en de gewone app blijven ongemoeid.
//  Zet bij deze functie "Verify JWT" UIT (net als bij "picqer-test").
//
//  Geheimen (Edge Functions → Secrets), dezelfde als bij "picqer-test":
//    PICQER_TEST_DOMAIN     bv. ivol-dev.picqer.com
//    PICQER_TEST_KEY        API-sleutel van de TESTomgeving
//    IVOL_CODE              koppelcode (header x-ivol-code)
//    PICQER_TEST_WAREHOUSE  (optioneel) idwarehouse Hoofdmagazijn in test
//
//  Veiligheid:
//   - weigert te draaien als PICQER_TEST_DOMAIN de echte Picqer (ivol) is;
//   - weigert ook als het adres niet "dev" of "test" bevat;
//   - schrijft alleen via vaste acties (geen vrije opdrachten), alleen met POST;
//   - alles wat aangemaakt wordt krijgt het voorvoegsel DEMO-;
//   - elk antwoord bevat "omgeving":"test".
//
//  Acties:
//   GET  ?actie=status    → welke magazijnen, welk adres (schrijft niets)
//   GET  ?actie=inventaris → telt wat er al in de testomgeving staat (schrijft niets)
//   POST ?actie=locaties|leveranciers|producten|voorraad|inkoop|orders → bouwt de testomgeving op
//   POST ?actie=controle  → stap 1: maakt locatie DEMO-CONTROLE aan en verwijdert
//                           hem meteen weer. Laat zien of de sleutel mag schrijven.
//  Volgende blokken (locaties, leveranciers, producten, voorraad, inkooporders,
//  orders, ontvangsten) komen er één voor één bij, pas als het vorige gecontroleerd is.
//  Wordt automatisch live gezet door GitHub (workflow supabase-functies).
// =====================================================================

const DOMEIN = (Deno.env.get("PICQER_TEST_DOMAIN") || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const SLEUTEL = (Deno.env.get("PICQER_TEST_KEY") || "").trim();
const CODE = (Deno.env.get("IVOL_CODE") || "").trim();
const MAGAZIJN = Number(Deno.env.get("PICQER_TEST_WAREHOUSE") || "3857");
const HOST = DOMEIN ? (DOMEIN.includes(".") ? DOMEIN : DOMEIN + ".picqer.com") : "";
const BASIS = HOST ? "https://" + HOST + "/api/v1" : "";
// de echte Picqer van IVOL: deze functie weigert daarmee te praten
const IS_ECHT = /^ivol(\.picqer\.com)?$/i.test(DOMEIN);
// extra slot: het adres moet er als testomgeving uitzien
const IS_TEST = /(dev|test)/i.test(HOST);
const HERKOMST = ["https://daan-vb.github.io"];
const UA = "IVOL Warehouse TEST-SEED (github.com/Daan-vB/Magazijn-Tools)";
const DEMO = "DEMO-";

function cors(origin: string | null): Record<string, string> {
  const ok = origin && (HERKOMST.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : HERKOMST[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type, x-ivol-code",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function antwoord(data: unknown, status: number, origin: string | null): Response {
  const uit = data && typeof data === "object" && !Array.isArray(data) ? { ...(data as Record<string, unknown>), omgeving: "test" } : data;
  return new Response(JSON.stringify(uit), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Ivol-Omgeving": "test" },
  });
}
class Fout extends Error {
  status: number;
  constructor(bericht: string, status = 502) { super(bericht); this.status = status; }
}
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Picqer: enige netwerkfunctie ----------
// Schrijven mag alleen naar deze onderdelen, en nooit buiten het geweigerde echte adres.
const SCHRIJFBAAR = /^(locations|suppliers|products|purchaseorders|receipts|orders)(\/|$|\?)/;

async function pq(methode: "GET" | "POST" | "PUT" | "DELETE", pad: string, body?: unknown): Promise<any> {
  if (IS_ECHT || !IS_TEST) throw new Fout("Geweigerd: dit is niet de testomgeving.", 500);
  if (methode !== "GET" && !SCHRIJFBAAR.test(pad)) throw new Fout("Geweigerd: schrijven naar " + pad.split("?")[0] + " staat niet toe.", 500);
  for (let poging = 1; ; poging++) {
    let r: Response;
    try {
      r = await fetch(BASIS + "/" + pad, {
        method: methode,
        headers: {
          "Authorization": "Basic " + btoa(SLEUTEL + ":"),
          "Accept": "application/json",
          "User-Agent": UA,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (_e) {
      // bij schrijven nooit opnieuw proberen: kan dubbel aanmaken
      if (methode === "GET" && poging < 3) { await wacht(1000 * poging); continue; }
      throw new Fout("Picqer niet bereikbaar (" + pad.split("?")[0] + ")");
    }
    // 429 = Picqer heeft niets uitgevoerd, opnieuw proberen is dus veilig (ook bij schrijven)
    if (r.status === 429 && poging < 10) { await wacht(1000 * Math.min(30, Number(r.headers.get("Retry-After")) || 5 * poging)); continue; }
    if (r.status >= 500 && methode === "GET" && poging < 3) { await wacht(1500 * poging); continue; }
    const t = await r.text();
    if (r.status === 401) throw new Fout("Picqer weigert de API-sleutel (status 401)", 502);
    if (r.status === 403) throw new Fout("Picqer weigert deze handeling voor de sleutel (status 403) op " + methode + " " + pad.split("?")[0], 403);
    if (!r.ok) {
      let m = ""; try { m = JSON.parse(t).error_message || ""; } catch (_e) { /* geen json */ }
      throw new Fout("Picqer gaf status " + r.status + " op " + methode + " " + pad.split("?")[0] + (m ? ": " + m : ""));
    }
    if (!t.trim()) return null;           // 204 zonder inhoud
    try { return JSON.parse(t); } catch (_e) { throw new Fout("Picqer gaf geen geldige gegevens (" + pad.split("?")[0] + ")"); }
  }
}

// ---------- acties ----------
async function status() {
  const w = await pq("GET", "warehouses");
  return {
    domein: DOMEIN,
    magazijn: MAGAZIJN,
    magazijnen: (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name, actief: x.active !== false })),
  };
}

// Stap 1: mag de sleutel schrijven? Maak één locatie aan en verwijder hem meteen.
async function controle() {
  const w = await pq("GET", "warehouses");
  const lijst = (Array.isArray(w) ? w : []).map((x: any) => ({ id: x.idwarehouse, naam: x.name }));
  const mag = lijst.find((x) => x.id === MAGAZIJN);
  if (!mag) {
    throw new Fout("Magazijn " + MAGAZIJN + " staat niet in de testomgeving. Beschikbaar: " +
      (lijst.map((x) => x.naam + " (id " + x.id + ")").join(", ") || "geen") +
      ". Pas het geheim PICQER_TEST_WAREHOUSE in Supabase aan.", 400);
  }
  const naam = DEMO + "CONTROLE";
  const uit: Record<string, unknown> = { domein: DOMEIN, magazijn: { id: mag.id, naam: mag.naam }, locatie: naam };

  // bestaat hij al van een vorige keer? dan hergebruiken we hem voor de verwijdertest
  const bestaand = await pq("GET", "locations?search=" + encodeURIComponent(naam)).catch(() => []);
  const eerder = (Array.isArray(bestaand) ? bestaand : []).find((l: any) => l.name === naam && l.idwarehouse === MAGAZIJN);

  let id: number;
  if (eerder) {
    id = eerder.idlocation;
    uit.aanmaken = "overgeslagen (bestond al)";
  } else {
    const nieuw = await pq("POST", "locations", { name: naam, idwarehouse: MAGAZIJN });
    id = nieuw && nieuw.idlocation;
    if (!id) throw new Fout("Picqer gaf geen locatie terug na het aanmaken.");
    uit.aanmaken = "gelukt";
  }
  uit.idlocation = id;

  try {
    await pq("DELETE", "locations/" + id);
    uit.verwijderen = "gelukt";
  } catch (e) {
    uit.verwijderen = "mislukt: " + String((e as Error).message || e) + " — verwijder locatie " + naam + " handmatig in Picqer";
  }
  uit.schrijven = uit.aanmaken !== undefined && uit.verwijderen === "gelukt";
  return uit;
}

// Alle pagina's (100 per keer), alleen lezen
async function alles(pad: string, max: number): Promise<any[]> {
  const uit: any[] = [];
  for (let off = 0; off < max; off += 100) {
    const r = await pq("GET", pad + (pad.includes("?") ? "&" : "?") + "offset=" + off);
    if (!Array.isArray(r) || !r.length) break;
    uit.push(...r);
    if (r.length < 100) break;
  }
  return uit;
}

// Wat staat er al in de testomgeving? (schrijft niets) — kijk eerst, vul daarna aan.
async function inventaris() {
  const veilig = async (pad: string, max: number) => { try { return { lijst: await alles(pad, max), fout: "" }; } catch (e) { return { lijst: [] as any[], fout: String((e as Error).message || e) }; } };
  const loc = await veilig("locations", 5000);
  const prod = await veilig("products", 3000);
  const lev = await veilig("suppliers", 500);
  const ink = await veilig("purchaseorders", 1000);
  const ord = await veilig("orders", 2000);
  const bo = await veilig("backorders", 3000);
  const telPer = (l: any[], f: (x: any) => string) => { const m: Record<string, number> = {}; l.forEach((x) => { const k = f(x) || "(leeg)"; m[k] = (m[k] || 0) + 1; }); return m; };
  const hm = loc.lijst.filter((l: any) => l.idwarehouse === MAGAZIJN);
  const demo = (l: any[], f: (x: any) => string) => l.filter((x) => String(f(x) || "").startsWith(DEMO)).length;
  return {
    domein: DOMEIN,
    magazijn: MAGAZIJN,
    locaties: {
      totaal: loc.lijst.length, hoofdmagazijn: hm.length,
      bulk: hm.filter((l: any) => l.is_bulk_location).length,
      tijdelijk: hm.filter((l: any) => l.unlink_on_empty).length,
      voorbeeld: hm.slice(0, 10).map((l: any) => l.name),
      demo: demo(loc.lijst, (x) => x.name), fout: loc.fout,
    },
    producten: {
      totaal: prod.lijst.length,
      metEan: prod.lijst.filter((p: any) => p.barcode).length,
      voorbeeld: prod.lijst.slice(0, 8).map((p: any) => p.productcode),
      demo: demo(prod.lijst, (x) => x.productcode), fout: prod.fout,
    },
    leveranciers: { totaal: lev.lijst.length, namen: lev.lijst.slice(0, 15).map((s: any) => s.name), demo: demo(lev.lijst, (x) => x.name), fout: lev.fout },
    inkooporders: { totaal: ink.lijst.length, perStatus: telPer(ink.lijst, (x) => x.status), fout: ink.fout },
    orders: { totaal: ord.lijst.length, perStatus: telPer(ord.lijst, (x) => x.status), fout: ord.fout },
    backorders: { totaal: bo.lijst.length, fout: bo.fout },
  };
}

// =====================================================================
//  VOLLEDIGE TESTOMGEVING: dezelfde opzet als de echte Picqer, kleiner van schaal.
//  Elk blok is herhaalbaar (bestaat het al, dan overslaan) en werkt in porties,
//  zodat de pagina het blok blijft aanroepen tot "rest" 0 is.
// =====================================================================
const pad2 = (n: number) => String(n).padStart(2, "0");
const plaatsen = (n: number) => "ABCD".slice(0, n);
const locNaam = (gang: string, sec: number, pl: string, h: string) => gang + pad2(sec) + pl + h;
function ean(n: number): string {
  const b = "871000" + String(n).padStart(6, "0");
  let s = 0; for (let i = 0; i < 12; i++) s += Number(b[i]) * (i % 2 ? 3 : 1);
  return b + ((10 - (s % 10)) % 10);
}
const nl = (d: Date) => d.toISOString().slice(0, 10);
const overDagen = (n: number) => nl(new Date(Date.now() + n * 86400000));

// ---- locaties: zelfde naamgeving als in het echte magazijn (gang·sectie·plaats·hoogte) ----
function locatiePlan(): { name: string; bulk: boolean }[] {
  const uit: { name: string; bulk: boolean }[] = [];
  const grid = (gang: string, secs: number, pl: number, hoogtes: string[]) => {
    for (let s = 1; s <= secs; s++) for (const p of plaatsen(pl)) for (const h of hoogtes) uit.push({ name: locNaam(gang, s, p, h), bulk: Number(h) >= 10 });
  };
  grid("AD", 6, 3, ["02", "04", "06", "08", "10", "20"]);   // midden: legborden pick, bulk erboven
  grid("AE", 6, 3, ["02", "04", "06", "08", "10", "20"]);
  grid("CC", 6, 4, ["00", "10", "20"]);                     // vloer = pick, 10/20 = bulk
  grid("BY", 4, 4, ["00", "15", "30"]);                     // BY: vloer pick, 15 en 30 bulk
  grid("CF", 3, 1, ["10", "20"]);                           // rubber rollen: alleen bulk
  for (let s = 1; s <= 6; s++) for (const p of plaatsen(2)) uit.push({ name: locNaam("AH", s, p, "00"), bulk: false }); // AH: alles pick
  return uit;
}

// ---- leveranciers (Europees, geen containers) ----
const LEVERANCIERS = [
  { name: "DEMO Hongle Tiles BV", country: "nl", city: "Venlo", zipcode: "5911 AB", address: "Industrieweg 12", emailaddress: "inkoop@example.com" },
  { name: "DEMO Rubberwerk GmbH", country: "de", city: "Köln", zipcode: "50667", address: "Gummistrasse 5", emailaddress: "bestellung@example.com" },
  { name: "DEMO Transportpallets Polska", country: "pl", city: "Poznań", zipcode: "60-001", address: "ul. Paletowa 3", emailaddress: "zamowienia@example.com" },
  { name: "DEMO Accessoires Europa BV", country: "nl", city: "Tilburg", zipcode: "5011 CD", address: "Havenstraat 40", emailaddress: "orders@example.com" },
  { name: "DEMO Kleinmateriaal SA", country: "fr", city: "Lille", zipcode: "59000", address: "Rue des Vis 8", emailaddress: "commandes@example.com" },
  { name: "DEMO Matten Iberia SL", country: "es", city: "Valencia", zipcode: "46001", address: "Calle Alfombra 2", emailaddress: "pedidos@example.com" },
];

// ---- producten: groepen zoals in het echte magazijn, met bewust dezelfde problemen ----
// scenario per product: 0 pick+bulk zelfde gang · 1 bulk in andere gang · 2 alleen pick ·
// 3 alleen bulk (geen picklocatie) · 4 voorraad zonder locatie · 5 pick leeg, bulk vol (backorder)
type Prod = {
  code: string; naam: string; sup: number; prijs: number; gewicht: number; l: number; b: number; h: number;
  groep: string; sc: number; pick: string | null; bulk: string[]; pickStuks: number; bulkStuks: number[]; zonder: number;
  trigger?: number; tot?: number;
};
function productPlan(): Prod[] {
  const P: Prod[] = [];
  const voeg = (groep: string, aantal: number, f: (i: number, sc: number) => Partial<Prod> & { code: string; naam: string }) => {
    for (let i = 0; i < aantal; i++) {
      const sc = i % 6;
      const x = f(i, sc);
      P.push({ sup: 0, prijs: 9.95, gewicht: 500, l: 20, b: 15, h: 10, groep, sc, pick: null, bulk: [], pickStuks: 0, bulkStuks: [], zonder: 0, ...x });
    }
  };
  const doos = (i: number) => ({ pick: 8 + ((i * 13) % 50), bulk: 24 * (1 + (i % 4)) });
  const pal = (i: number) => ({ pick: 60 + ((i * 37) % 130), bulk: 200 * (1 + (i % 3)) });
  const verdeel = (sc: number, pick: string, bulk: string, bulkAnders: string, st: { pick: number; bulk: number }) => {
    const r: Partial<Prod> = { pick, bulk: [bulk], pickStuks: st.pick, bulkStuks: [st.bulk], zonder: 0 };
    if (sc === 1) r.bulk = [bulkAnders];
    if (sc === 2) { r.bulk = []; r.bulkStuks = []; }
    if (sc === 3) { r.pick = null; r.pickStuks = 0; }
    if (sc === 4) { r.pick = null; r.bulk = []; r.bulkStuks = []; r.pickStuks = 0; r.zonder = st.pick + st.bulk; }
    if (sc === 5) { r.pickStuks = 0; }
    return r;
  };
  const niveau = (i: number, sc: number, pallet: boolean): { trigger?: number; tot?: number } =>
    (sc === 0 || sc === 1 || sc === 5) && i % 4 !== 0 ? (pallet ? { trigger: 20 + (i % 5) * 10, tot: 20 + (i % 5) * 10 + 150 } : { trigger: 5 + (i % 6), tot: 5 + (i % 6) + 20 }) : {};
  voeg("Accessoires", 14, (i, sc) => {
    const st = doos(i);
    return { code: "DEMO-ACC-" + String(i + 1).padStart(3, "0"), naam: "Demo accessoire " + (i + 1), sup: 3, prijs: 4.5 + i, gewicht: 120 + i * 15,
      ...verdeel(sc, locNaam("AD", 1 + (i % 6), "ABC"[Math.floor(i / 6) % 3], "02"), locNaam("AD", 1 + ((i + 2) % 6), "ABC"[(i + 1) % 3], i % 2 ? "20" : "10"), locNaam("AE", 1 + ((i + 3) % 6), "ABC"[(i + 1) % 3], "10"), { pick: st.pick, bulk: st.bulk }),
      ...niveau(i, sc, false) };
  });
  voeg("Tegels", 12, (i, sc) => {
    const st = pal(i);
    return { code: "DEMO-TEG-" + String(i + 1).padStart(3, "0"), naam: "Demo tegel " + (i + 1), sup: 0, prijs: 18 + i, gewicht: 2500, l: 50, b: 50, h: 4,
      ...verdeel(sc, locNaam("CC", 1 + (i % 6), "ABCD"[Math.floor(i / 6) % 4], "00"), locNaam("CC", 1 + ((i + 1) % 6), "ABCD"[(i + 2) % 4], i % 2 ? "20" : "10"), locNaam("BY", 1 + (i % 4), "ABCD"[(i + 1) % 4], "15"), { pick: st.pick, bulk: st.bulk }),
      ...niveau(i, sc, true) };
  });
  voeg("Transportpallets", 6, (i, sc) => {
    const st = pal(i);
    return { code: "DEMO-TRP-" + String(i + 1).padStart(3, "0"), naam: "Demo transportpallet " + (i + 1), sup: 2, prijs: 14 + i, gewicht: 22000, l: 120, b: 80, h: 15,
      ...verdeel(sc, locNaam("BY", 1 + (i % 4), "ABCD"[Math.floor(i / 4) % 4], "00"), locNaam("BY", 1 + (i % 4), "ABCD"[Math.floor(i / 4) % 4], i % 2 ? "30" : "15"), locNaam("CC", 1 + (i % 6), "ABCD"[(i + 1) % 4], "10"), { pick: st.pick, bulk: st.bulk }),
      ...niveau(i, sc, true) };
  });
  // rollen per meter: alleen bulk (de backorder-val)
  ["ring-rol-50", "ring-rol-80-16", "ring-rol-120-16"].forEach((c, i) => {
    P.push({ code: "DEMO-" + c, naam: "Demo rubber rol per meter " + (i + 1), sup: 1, prijs: 3.5 + i, gewicht: 800, l: 100, b: 100, h: 100, groep: "Rollen", sc: 3,
      pick: null, bulk: [locNaam("CF", 1 + i, "A", "10")], pickStuks: 0, bulkStuks: [300 + i * 150], zonder: 0 });
  });
  voeg("Klein spul", 15, (i, sc) => {
    const st = doos(i + 3);
    return { code: "DEMO-KLN-" + String(i + 1).padStart(3, "0"), naam: "Demo klein onderdeel " + (i + 1), sup: 4, prijs: 1.2 + i * 0.3, gewicht: 40 + i * 5, l: 8, b: 6, h: 4,
      ...verdeel(sc, locNaam("AE", 1 + (i % 6), "ABC"[Math.floor(i / 6) % 3], ["02", "04", "06"][i % 3]), locNaam("AE", 1 + ((i + 2) % 6), "ABC"[(i + 1) % 3], "10"), locNaam("AD", 1 + ((i + 4) % 6), "ABC"[(i + 2) % 3], "20"), { pick: st.pick, bulk: st.bulk }),
      ...niveau(i, sc, false) };
  });
  // AH: extra picklocaties bij de inpaktafels, alles pick
  for (let i = 0; i < 6; i++) {
    P.push({ code: "DEMO-AH-" + String(i + 1).padStart(3, "0"), naam: "Demo inpakaccessoire " + (i + 1), sup: 3, prijs: 0.8 + i * 0.2, gewicht: 30, l: 10, b: 10, h: 5, groep: "AH", sc: 2,
      pick: locNaam("AH", 1 + i, "A", "00"), bulk: [], pickStuks: 40 + i * 20, bulkStuks: [], zonder: 0, trigger: 10, tot: 60 });
  }
  // nieuw / uitverkocht: geen voorraad, wel een open inkooporder → zekere backorders
  for (let i = 0; i < 4; i++) {
    P.push({ code: "DEMO-NIEUW-" + String(i + 1).padStart(3, "0"), naam: "Demo nieuw product " + (i + 1), sup: 4, prijs: 6 + i, gewicht: 300, l: 25, b: 20, h: 12, groep: "Nieuw", sc: 6,
      pick: locNaam("AE", 1 + i, "C", "08"), bulk: [], pickStuks: 0, bulkStuks: [], zonder: 0, trigger: 4, tot: 24 });
  }
  return P;
}

// ---- hulp: werk in porties binnen een tijdsbudget ----
async function werk<T>(items: T[], n: number, f: (x: T) => Promise<unknown>, maxMs = 80000) {
  const t0 = Date.now(); let i = 0, gedaan = 0, overgeslagen = 0; const fouten: string[] = [];
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length && Date.now() - t0 < maxMs) {
      const x = items[i++];
      try { if ((await f(x)) === "overslaan") overgeslagen++; else gedaan++; } catch (e) { fouten.push(String((e as Error).message || e)); }
    }
  }));
  return { gedaan, overgeslagen, aantalFouten: fouten.length, fouten: fouten.slice(0, 4), rest: items.length - i };
}
let BTW: number | null = null;
async function btwGroep(): Promise<number> {
  if (BTW) return BTW;
  const l = await pq("GET", "vatgroups");
  const g = (Array.isArray(l) ? l : []).find((x: any) => Number(x.percentage) === 21) || (Array.isArray(l) ? l[0] : null);
  if (!g) throw new Fout("Geen btw-groep gevonden in de testomgeving.");
  BTW = g.idvatgroup; return BTW!;
}
async function locatieIds(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  (await alles("locations", 5000)).forEach((l: any) => { if (l.idwarehouse === MAGAZIJN) m.set(l.name, l.idlocation); });
  return m;
}
async function demoProducten(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  (await alles("products", 5000)).forEach((p: any) => { if (String(p.productcode).startsWith(DEMO)) m.set(p.productcode, p.idproduct); });
  return m;
}

// ---- blokken ----
async function blokLocaties() {
  const bestaand = await locatieIds();
  const nodig = locatiePlan().filter((l) => !bestaand.has(l.name));
  const r = await werk(nodig, 3, (l) => pq("POST", "locations", { name: l.name, idwarehouse: MAGAZIJN, is_bulk_location: l.bulk, unlink_on_empty: l.bulk }));
  return { blok: "locaties", totaalPlan: locatiePlan().length, alAanwezig: bestaand.size, ...r };
}
async function blokLeveranciers() {
  const bestaand = new Set((await alles("suppliers", 500)).map((s: any) => s.name));
  const nodig = LEVERANCIERS.filter((l) => !bestaand.has(l.name));
  const r = await werk(nodig, 2, (l) => pq("POST", "suppliers", l));
  return { blok: "leveranciers", totaalPlan: LEVERANCIERS.length, ...r };
}
async function blokProducten() {
  const sup = new Map<string, number>((await alles("suppliers", 500)).map((s: any) => [s.name, s.idsupplier]));
  const vat = await btwGroep();
  const bestaand = await demoProducten();
  const plan = productPlan();
  const nodig = plan.filter((p) => !bestaand.has(p.code));
  const r = await werk(nodig, 3, async (p) => {
    const idsupplier = sup.get(LEVERANCIERS[p.sup].name);
    if (!idsupplier) throw new Fout("Leverancier " + LEVERANCIERS[p.sup].name + " ontbreekt: draai eerst Leveranciers.");
    const n = plan.indexOf(p) + 1;
    await pq("POST", "products", {
      productcode: p.code, name: p.naam, price: p.prijs, idvatgroup: vat, barcode: ean(n), weight: p.gewicht,
      length: p.l, width: p.b, height: p.h, idsupplier, productcode_supplier: "SUP-" + p.code.replace(/^DEMO-/, ""), deliverytime: 7,
    });
  });
  return { blok: "producten", totaalPlan: plan.length, alAanwezig: bestaand.size, ...r };
}
async function blokVoorraad() {
  const loc = await locatieIds();
  const prods = await demoProducten();
  const plan = productPlan().filter((p) => prods.has(p.code));
  // vergelijkt per product wat er moet staan met wat er staat, en vult alleen het verschil aan
  // (zo herstelt een tweede keer draaien een product dat halverwege bleef steken)
  const r = await werk(plan, 2, async (p) => {
    const id = prods.get(p.code)!;
    const links = await pq("GET", "products/" + id + "/locations").catch(() => []);
    const gekoppeld = new Set((Array.isArray(links) ? links : []).map((l: any) => Number(l.idlocation)));
    const st = await pq("GET", "products/" + id + "/stock/" + MAGAZIJN);
    const perLoc = new Map<number, number>();
    (st && Array.isArray(st.locations) ? st.locations : []).forEach((l: any) => { perLoc.set(Number(l.idlocation), Number(l.stock) || 0); gekoppeld.add(Number(l.idlocation)); });
    const opLoc = [...perLoc.values()].reduce((t, x) => t + x, 0);
    const zonderNu = Math.max(0, (Number(st && st.stock) || 0) - opLoc);
    let iets = false;
    const stel = async (naam: string, aantal: number, voorkeur: boolean) => {
      const idl = loc.get(naam);
      if (!idl) throw new Fout("Locatie " + naam + " bestaat niet: draai eerst Locaties.");
      if (!gekoppeld.has(idl)) { await pq("POST", "products/" + id + "/locations", voorkeur ? { idlocation: idl, is_preferred: true } : { idlocation: idl }); iets = true; }
      const tekort = aantal - (perLoc.get(idl) || 0);
      if (tekort > 0) { await pq("POST", "products/" + id + "/stock/" + MAGAZIJN, { idlocation: idl, change: tekort, reason: "DEMO beginvoorraad" }); iets = true; }
    };
    if (p.pick) await stel(p.pick, p.pickStuks, true);
    for (let k = 0; k < p.bulk.length; k++) await stel(p.bulk[k], p.bulkStuks[k] || 0, false);
    if (p.zonder > zonderNu) { await pq("POST", "products/" + id + "/stock/" + MAGAZIJN, { idlocation: null, change: p.zonder - zonderNu, reason: "DEMO beginvoorraad zonder locatie" }); iets = true; }
    if (p.trigger !== undefined) await pq("PUT", "products/" + id + "/warehouses/" + MAGAZIJN, { picking_stock_replenish_trigger: p.trigger, picking_stock_replenish_to: p.tot });
    return iets ? "gedaan" : "overslaan";
  });
  return { blok: "voorraad", totaalPlan: plan.length, ...r };
}

// ---- inkooporders: 5 stuks, twee ontvangen (één volledig, één deels), drie open (één te laat) ----
const INKOOP = [
  { ref: "DEMO-PO-001", sup: 3, groep: "Accessoires", regels: 4, aantal: 100, dag: -5, ontvang: 1 },
  { ref: "DEMO-PO-002", sup: 0, groep: "Tegels", regels: 3, aantal: 400, dag: -3, ontvang: 0.5 },
  { ref: "DEMO-PO-003", sup: 4, groep: "Nieuw", regels: 4, aantal: 120, dag: 3, ontvang: 0 },
  { ref: "DEMO-PO-006", sup: 4, groep: "Klein spul", regels: 5, aantal: 200, dag: 14, ontvang: 0 },
  { ref: "DEMO-PO-004", sup: 2, groep: "Transportpallets", regels: 3, aantal: 300, dag: 10, ontvang: 0 },
  { ref: "DEMO-PO-005", sup: 1, groep: "Rollen", regels: 3, aantal: 500, dag: -9, ontvang: 0 },
];
async function blokInkoop() {
  const sup = new Map<string, number>((await alles("suppliers", 500)).map((s: any) => [s.name, s.idsupplier]));
  const prods = await demoProducten();
  const plan = productPlan();
  const alleInk = await alles("purchaseorders", 2000);
  const bestaand = new Set(alleInk.map((o: any) => o.supplier_orderid));
  const hangend = alleInk.filter((o: any) => String(o.supplier_orderid || "").startsWith(DEMO) && o.status === "concept");
  for (const o of hangend) await pq("POST", "purchaseorders/" + o.idpurchaseorder + "/mark-as-purchased").catch(() => null);
  const nodig = INKOOP.filter((o) => !bestaand.has(o.ref));
  const r = await werk(nodig, 1, async (o) => {
    const idsupplier = sup.get(LEVERANCIERS[o.sup].name);
    if (!idsupplier) throw new Fout("Leverancier ontbreekt: draai eerst Leveranciers.");
    const regels = plan.filter((p) => p.groep === o.groep).slice(0, o.regels).filter((p) => prods.has(p.code))
      .map((p) => ({ idproduct: prods.get(p.code)!, amount: o.aantal, price: p.prijs }));
    if (!regels.length) throw new Fout("Geen producten voor " + o.ref + ": draai eerst Producten.");
    const po = await pq("POST", "purchaseorders", { idsupplier, idwarehouse: MAGAZIJN, supplier_orderid: o.ref, delivery_date: overDagen(o.dag), remarks: "DEMO testinkooporder", products: regels });
    await pq("POST", "purchaseorders/" + po.idpurchaseorder + "/mark-as-purchased");
    if (o.ontvang > 0) {
      const vol = await pq("GET", "purchaseorders/" + po.idpurchaseorder);
      const rc = await pq("POST", "receipts", { idpurchaseorder: po.idpurchaseorder, idwarehouse: MAGAZIJN, version: 2 });
      for (const l of (vol.products || [])) {
        await pq("POST", "receipts/" + rc.idreceipt + "/products", { idproduct: l.idproduct, idpurchaseorder_product: l.idpurchaseorder_product, amount: Math.max(1, Math.round(o.aantal * o.ontvang)) });
      }
      await pq("PUT", "receipts/" + rc.idreceipt, { status: "completed" });
    }
  });
  return { blok: "inkoop", totaalPlan: INKOOP.length, ...r };
}

// ---- klantorders: 40 stuks, deels te verwerken, deels backorder door lege pick ----
const KLANTEN = ["Jansen", "de Vries", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos"];
const STEDEN = [["Utrecht", "3511 AA"], ["Eindhoven", "5611 BB"], ["Zwolle", "8011 CC"], ["Breda", "4811 DD"], ["Arnhem", "6811 EE"], ["Groningen", "9711 FF"]];
async function blokOrders() {
  const prods = await demoProducten();
  const plan = productPlan().filter((p) => prods.has(p.code));
  if (!plan.length) throw new Fout("Geen producten: draai eerst Producten en Voorraad.");
  const alleOrd = await alles("orders", 5000);
  const bestaand = new Set(alleOrd.map((o: any) => o.reference));
  const hangend = alleOrd.filter((o: any) => String(o.reference || "").startsWith(DEMO) && o.status === "concept");
  for (const o of hangend) await pq("POST", "orders/" + o.idorder + "/process").catch(() => null);
  const nieuw = plan.filter((p) => p.groep === "Nieuw");
  const alle = Array.from({ length: 40 }, (_, k) => k);
  const nodig = alle.filter((k) => !bestaand.has("DEMO-ORD-" + String(k + 1).padStart(3, "0")));
  const r = await werk(nodig, 2, async (k) => {
    const regels = Array.from({ length: 1 + (k % 3) }, (_, j) => {
      const p = plan[(k * 7 + j * 13) % plan.length];
      return { idproduct: prods.get(p.code)!, amount: p.groep === "Rollen" ? 10 + 5 * (k % 5) : 1 + ((k + j) % 9) };
    });
    if (k % 4 === 0 && nieuw.length) {
      const n = nieuw[(k / 4) % nieuw.length];
      if (!regels.some((r) => r.idproduct === prods.get(n.code))) regels.push({ idproduct: prods.get(n.code)!, amount: 1 + (k % 3) });
    }
    const naam = "Fam. " + KLANTEN[k % KLANTEN.length], [stad, pc] = STEDEN[k % STEDEN.length], adres = "Teststraat " + (k + 1);
    const o = await pq("POST", "orders", {
      idcustomer: null, reference: "DEMO-ORD-" + String(k + 1).padStart(3, "0"),
      deliveryname: naam, deliveryaddress: adres, deliveryzipcode: pc, deliverycity: stad, deliverycountry: "nl",
      invoicename: naam, invoiceaddress: adres, invoicezipcode: pc, invoicecity: stad, invoicecountry: "nl",
      products: regels,
    });
    await pq("POST", "orders/" + o.idorder + "/process");
  });
  return { blok: "orders", totaalPlan: alle.length, ...r };
}

// ---- levering met producten die Picqer zelf al verkoopgeschiedenis heeft gegeven ----
// De DEMO-producten bestaan pas sinds vandaag, dus "picks per dag" is daar 0. De 101
// producten uit Picqers eigen demodata hebben wel historie (603 orders, 419 picklijsten).
// Met deze levering kan stap 4 van Ontvangsten mét verkoopcijfers getest worden.
async function blokHistorie() {
  const alleProd = await alles("products", 6000);
  const metHistorie = alleProd
    .filter((p: any) => !String(p.productcode || "").startsWith(DEMO) && p.active !== false)
    .map((p: any) => ({ p, pd: Number(p.analysis_pick_amount_per_day) || 0 }))
    .filter((x: any) => x.pd > 0)
    .sort((a: any, b: any) => b.pd - a.pd)
    .slice(0, 5);
  if (!metHistorie.length) {
    return { blok: "historie", gedaan: 0, overgeslagen: 0, aantalFouten: 0, fouten: [],
      rest: 0, opmerking: "Geen enkel product in de testomgeving heeft picks per dag. Dan valt dit niet te testen." };
  }
  const REF = "DEMO-PO-007";
  const alleInk = await alles("purchaseorders", 2000);
  if (alleInk.some((o: any) => o.supplier_orderid === REF)) {
    return { blok: "historie", gedaan: 0, overgeslagen: 1, aantalFouten: 0, fouten: [], rest: 0,
      producten: metHistorie.map((x: any) => x.p.productcode + " (" + x.pd.toFixed(2) + "/dag)") };
  }
  // leverancier van het eerste product, anders de eerste uit de lijst
  const levs = await alles("suppliers", 500);
  const idsupplier = metHistorie[0].p.idsupplier || (levs[0] && levs[0].idsupplier);
  if (!idsupplier) throw new Fout("Geen leverancier gevonden voor deze levering.");
  const regels = metHistorie.map((x: any) => ({ idproduct: x.p.idproduct, amount: 240, price: Number(x.p.price) || 10 }));
  const po = await pq("POST", "purchaseorders", {
    idsupplier, idwarehouse: MAGAZIJN, supplier_orderid: REF, delivery_date: overDagen(-1),
    remarks: "DEMO levering met producten die verkoopgeschiedenis hebben", products: regels,
  });
  await pq("POST", "purchaseorders/" + po.idpurchaseorder + "/mark-as-purchased");
  const vol = await pq("GET", "purchaseorders/" + po.idpurchaseorder);
  const rc = await pq("POST", "receipts", { idpurchaseorder: po.idpurchaseorder, idwarehouse: MAGAZIJN, version: 2 });
  for (const l of (vol.products || [])) {
    await pq("POST", "receipts/" + rc.idreceipt + "/products",
      { idproduct: l.idproduct, idpurchaseorder_product: l.idpurchaseorder_product, amount: 240 });
  }
  await pq("PUT", "receipts/" + rc.idreceipt, { status: "completed" });
  return { blok: "historie", gedaan: 1, overgeslagen: 0, aantalFouten: 0, fouten: [], rest: 0,
    inkooporder: REF, producten: metHistorie.map((x: any) => x.p.productcode + " (" + x.pd.toFixed(2) + "/dag)") };
}

const BLOKKEN: Record<string, () => Promise<unknown>> = {
  locaties: blokLocaties, leveranciers: blokLeveranciers, producten: blokProducten,
  voorraad: blokVoorraad, inkoop: blokInkoop, orders: blokOrders, historie: blokHistorie,
};

// Kijkt of Picqer de analysevelden (picks per dag, ABC) wel invult. Die staan soms
// alleen op het losse product en niet in de lijst. Schrijft niets.
async function analyse() {
  const lijst = await alles("products", 6000);
  const telLijst = lijst.filter((p: any) => Number(p.analysis_pick_amount_per_day) > 0).length;
  const abcLijst = lijst.filter((p: any) => p.analysis_abc_classification).length;
  // vijf losse producten apart ophalen en vergelijken
  const steek = lijst.slice(0, 5).map((p: any) => p.idproduct);
  const los: unknown[] = [];
  for (const id of steek) {
    const p = await pq("GET", "products/" + id).catch(() => null);
    if (!p) continue;
    const velden: Record<string, unknown> = {};
    Object.keys(p).filter((k) => /analysis|stock_level|picking_stock|abc/i.test(k)).forEach((k) => { velden[k] = p[k]; });
    los.push({ code: p.productcode, velden });
  }
  // hebben die producten uberhaupt picklijstregels?
  let picks = 0;
  try { const pl = await pq("GET", "picklists?limit=1"); picks = Array.isArray(pl) ? pl.length : 0; } catch (_e) { /* mag */ }
  return {
    producten: lijst.length,
    metPicksPerDagInLijst: telLijst,
    metAbcInLijst: abcLijst,
    losOpgehaald: los,
    picklijstenAanwezig: picks > 0,
    uitleg: telLijst === 0
      ? "Picqer vult de analysevelden in deze testomgeving niet. Verkoopsnelheid valt hier dus niet te testen."
      : "Er zijn producten met picks per dag.",
  };
}

// ---------- ingang ----------
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "GET" && req.method !== "POST") return antwoord({ fout: "Alleen GET of POST." }, 405, origin);
  if (IS_ECHT) return antwoord({ fout: "PICQER_TEST_DOMAIN wijst naar de echte Picqer (ivol). Deze functie weigert dat." }, 500, origin);
  if (!BASIS || !SLEUTEL) return antwoord({ fout: "PICQER_TEST_DOMAIN of PICQER_TEST_KEY ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if (!IS_TEST) return antwoord({ fout: "Het adres " + HOST + " ziet er niet uit als een testomgeving (geen 'dev' of 'test' in de naam). Deze functie weigert dat." }, 500, origin);
  if (!CODE) return antwoord({ fout: "IVOL_CODE ontbreekt bij de Secrets in Supabase." }, 500, origin);
  if ((req.headers.get("x-ivol-code") || "").trim() !== CODE) return antwoord({ fout: "Koppelcode klopt niet.", code: "koppelcode" }, 401, origin);
  const url = new URL(req.url);
  const actie = url.searchParams.get("actie") || "status";
  try {
    if (actie === "status") return antwoord(await status(), 200, origin);
    if (actie === "inventaris") return antwoord(await inventaris(), 200, origin);
    if (actie === "analyse") return antwoord(await analyse(), 200, origin);
    if (BLOKKEN[actie]) {
      if (req.method !== "POST") return antwoord({ fout: "Deze actie schrijft en werkt alleen met POST (gebruik de knop op testdata.html)." }, 405, origin);
      return antwoord(await BLOKKEN[actie](), 200, origin);
    }
    if (actie === "controle") {
      if (req.method !== "POST") return antwoord({ fout: "Deze actie schrijft en werkt alleen met POST (gebruik de knop op testdata.html)." }, 405, origin);
      return antwoord(await controle(), 200, origin);
    }
    return antwoord({ fout: "Onbekende actie: " + actie }, 400, origin);
  } catch (e) {
    const f = e instanceof Fout ? e : new Fout(String((e as Error)?.message || e));
    return antwoord({ fout: f.message }, f.status, origin);
  }
});
