# Voorstel: functie `picqer`, actie `locaties` geeft ook "geen specifieke locatie"

*16-10-2026 · Claude Code · alleen een voorstel. `supabase/functions/**` is niet aangeraakt: een push daar zet de functie live. Daan beslist of en wanneer.*

## Waarom

De app weet nu alleen uit de **voorraad-per-locatie-export** hoeveel voorraad een product op "geen specifieke locatie" heeft (export 15-10: 1.637 producten). Picqer telt die voorraad als pick, maar op de plank ligt hij niet. Daardoor:

- adviseert Picqer soms niet aan te vullen terwijl de plank leeg is (Live advies: "Picqer slaat dit over");
- is de tegel **Voorraad zonder locatie** (Locaties) zo oud als de laatste export;
- kan **Ontkoppelen** bij Locaties alleen controleren op de voorraad van de laatste export.

De actie `locaties` haalt al per product de voorraad per locatie op (`products/{id}/locations`). Met één extra gegeven per product weet de app het live.

## Wat er verandert (alleen lezen, zoals nu)

In `supabase/functions/picqer/index.ts`, functie `locaties(idsTxt)`:

1. Per product naast `products/{id}/locations` ook `products/{id}` ophalen (zoals de actie `producten` al doet). Daarin staat `stock[]` per magazijn.
2. Geen specifieke locatie = **voorraad Hoofdmagazijn min de som van de locaties in het Hoofdmagazijn** (retourkarren tellen als locatie mee, die staan in de locatielijst).
   - Heeft Picqer een eigen veld voor voorraad zonder locatie, dan dat gebruiken. Dat is niet zeker: eerst één product met voorraad zonder locatie bekijken in de testomgeving (`ivol-dev`, functie `picqer-test`).
3. Alleen als dat meer dan 0 is: één extra regel in de lijst van dat product, **met een lege naam**:
   `["", 3857, 0, 0, <aantal>, <op picklijsten>]`
   (zelfde vorm als de andere regels: naam, magazijn, bulk, kar, voorraad, gereserveerd).
4. Gereserveerd zonder locatie = `reservedpicklists` van het magazijn min de som van de reserveringen op de locaties (niet onder 0).

Voorbeeld (schets, niet uitgevoerd):

```ts
async function locaties(idsTxt: string) {
  const ids = /* zoals nu */;
  const lijst = await perStuk(ids, 4, async (id) => {
    const [locs, p] = await Promise.all([
      pq("products/" + id + "/locations").catch(() => null),
      pq("products/" + id).catch(() => null),
    ]);
    if (!Array.isArray(locs)) return [id, null];
    const rijen = locs.map((l: any) => { /* zoals nu */ });
    const w = (p && Array.isArray(p.stock) ? p.stock : []).find((s: any) => Number(s.idwarehouse) === MAGAZIJN);
    if (w) {
      const hier = rijen.filter((r: any) => r[1] == null || Number(r[1]) === MAGAZIJN);
      const geen = (Number(w.stock) || 0) - hier.reduce((t: number, r: any) => t + r[4], 0);
      const res = (Number(w.reservedpicklists) || 0) - hier.reduce((t: number, r: any) => t + r[5], 0);
      if (geen > 0) rijen.push(["", MAGAZIJN, 0, 0, geen, Math.max(0, res)]);
    }
    return [id, rijen];
  });
  return { opgehaald: new Date().toISOString(), lijst };
}
```

**Kosten:** één Picqer-verzoek extra per product (van 50 naar 100 per blok). De app vraagt nu rustig aan (±250 per minuut); de stand per 10 minuten van de aanvulkandidaten blijft daaronder, maar de eerste volledige ronde duurt dan ongeveer twee keer zo lang. Alternatief: alleen voor producten waarvoor de catalogus (actie `catalogus`) een voorraad Hoofdmagazijn geeft die niet gelijk is aan de som van de locaties.

## De app werkt mét en zonder

Al gebouwd, zonder functiewijziging:

- `wh/aanvullive.js` herkent een regel zonder naam als "geen specifieke locatie" (`isGeen`): telt niet als pick, wel als "Picqer telt dit als pick". Zonder die regel neemt de app de export (`D.VR[code].geen`) en zegt dat erbij ("volgens export van …").
- Kandidaten voor het live advies tellen een regel zonder naam niet als picklocatie (16-10 bestendig gemaakt).
- `wh/locaties.js` (Locaties): **Voorraad zonder locatie** gebruikt de live stand waar die nieuwer is dan de export; **Ontkoppelen** kijkt naar de nieuwste stand.

## Wat de app daarna nog uit de export haalt

| Gegevens | Waarom nog een export |
| --- | --- |
| Productkoppelingen per locatie (kolom Productcodes van de locatie-export) | `locatielijst` levert de locaties zonder producten; voor alle 6.819 locaties per product vragen is te veel. Nodig voor Locaties en de import (altijd een verse export). |
| Voorraad per locatie van producten die geen aanvulkandidaat zijn | Live alleen voor producten met pick én bulk. Voorraad zonder locatie, retourkarren, Ruimte en Controle voor de overige producten blijven uit de voorraad-per-locatie-export. |
| VST-palletnummers (locatie-export Bulk van Spreuwel) | Niet in de functie. |
| Magazijnverkopen per maand | Rapport, geen API-actie. |
| Aanvuladvies-PDF van Picqer | Alleen om live naast de PDF te vergelijken (bouwplan 1.1). |
| Backorder-export | Alleen nog voor de vergelijking "vorige vs nu" en als er geen koppelcode op het apparaat staat; live gaat via `vandaag`. |

## Zo zet Daan het live (als hij akkoord is)

1. Wijziging laten maken in `supabase/functions/picqer/index.ts` (één functie, alleen lezen).
2. Eerst in de testomgeving controleren met één product met voorraad zonder locatie.
3. Push naar main zet de functie live (workflow `supabase-functies.yml`), of zoals in 3.0 → Koppeling Picqer staat beschreven.
