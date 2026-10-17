# Rapport tool 0.4: rustig en eerlijk (17-10-2026)

Direct op `main`, geen vragen gesteld; gekozen oplossingen staan erbij. Niets naar Picqer geschreven, `supabase/functions/**` niet aangeraakt, geen workflow "Productdata door Claude" gedraaid, geen data in `productdata` gewijzigd. Alleen deze 3.0-bestanden zijn aangepast: `wh/productdata.js`, `wh/taak.js`, `wh/ivol-x.js`, `wh/ivol.js`, `wh/pdbron.js`, `wh/aannames.js`. Warehouse, Junior, Ploeg, Containers en Palletlabels zijn niet aangeraakt.

## 1. Invullen toont alleen wat open is
- Nieuw scherm **Nog open · laag N** op `#/productdata/open/<laag>`. De knop Invullen per laag in Poort 0.4 (`naarlaag`) en de link in Te doen openen dit scherm. De oude link `#/productdata/kies/<laag>` werkt nog en gaat naar hetzelfde scherm. Selecteren en samen invullen (`#/productdata/kies`) blijft bestaan.
- Alleen belangrijke producten met open velden in die laag, alleen die velden (kolom per veld, rij per product), zonder filters, chips of zoekveld. Bovenaan één regel: "Laag N: X producten, Y velden open". De getallen komen uit dezelfde telling als de poort en lopen direct mee bij opslaan.
- Per familie, families met de meeste open velden eerst; binnen een familie A-lopers, dan B, dan wat binnenkomt.
- Voorgevuld: een schatting van Claude (`tw`, oranje), een waarde die tegen een regel ingaat (zie 4, met korte reden) en een zeker voorstel van de app (geel). Een onzeker voorstel staat als grijs `~getal` in het vak, niet ingevuld. Dubbel in palletlabels staat als `a / b` in het vak.
- **Klopt** per regel legt vast wat er staat (een schatting wordt jouw invoer, `tw` weg). Typen en de regel verlaten slaat alleen het getypte op. Er langs tabben of klikken schrijft niets. Klopt op een regel zonder iets ingevuld meldt dat er niets vast te leggen is.
- Leeg: "Laag N klaar" met één knop: naar de volgende laag met open velden, anders terug naar Poort 0.4.
- Producten op Later (weggezet): onderaan als eigen, ingeklapte groep.
- Keuze: geen "hele familie klopt"-knop (te makkelijk om alles blind goed te keuren).

## 2. Te doen bij stap 0.4 toont alleen de poort
Alleen de poortregels die nog rood zijn, elk met één knop (Invullen per laag, Overzetten, Kiezen, Bekijken). Weg: "Per familie … Volgende familie", "Gelijkzetten met Palletlabels en Containers", de groepen "Open belangrijke producten" en de verouderde zin over welke apps productdata lezen. Die schermen bestaan nog onder Productdata. Ook uit de kaart "Nu" op Te doen is "families klaar x van y" gehaald (gaat over alle families). Gebleven: de samenvatting en het vinkje "Later en Op maat tellen mee in de poort" (dat bepaalt wat de poort telt).

## 3. Steekproef pas als de data klaar is
- Knop Steekproef alleen actief als laag 1 t/m 3 op 100% staan, anders grijs met "Kan als laag 1–3 klaar zijn" (ook bij de poortregel in Te doen).
- Alleen producten waarvan alle getoonde velden (per pallet, per doos, palletmaat) die het product nodig heeft gevuld zijn. In de emulator stond nergens een "–" bij zo'n veld.
- De steekproef van 17-10 04:55 vervalt: een steekproef telt alleen als hij met deze regel is getrokken (`v:2`). De oude blijft in de catalog staan (niet gewist), maar telt niet mee en de poort meldt dat hij vervallen is.

## 4. Regelcontrole: waarden tegen een bevestigde regel in tellen als open
Alleen tonen en tellen, niets weggeschreven. Zo'n veld telt als open (zoals een `tw`), toont de reden in Nog open en staat onder Te controleren → Productdata. Aanpassen of Klopt (dan `meta.rok = 1`) telt als compleet; Klopt in Nog open, Te controleren en de productkaart zet `rok`; in de afdelingstabel doet dat het verlaten van een regel (bestaand gedrag: regel verlaten = gezien = opgeslagen), alle vier getest.

| Regel | Veld | Laag | Voorbeeld uit de opdracht |
|---|---|---|---|
| `p-dooscm` per cm of per meter: stuks per doos × gewicht per eenheid > 30 kg (gewicht eigen of Picqer; onbekend = niet controleren) | stuks per doos | 3 | 549-0-120-007: 10.000 cm × 0,005 kg = 50 kg |
| `p-maat` palletmaat is geen opslagmaat (volgorde L×B maakt niet uit; nvt en leeg vallen erbuiten) | palletmaat | 2 | 6008000000004: 100x120 |
| `a-doos` aanvullen met deel of doos, per stuk: max op pick kleiner dan één omdoos/bundel | max op pick | 1 | 42x21x100ALU: max 14, bundels van 15 |

Keuzes: `a-doos` geldt alleen voor producten per stuk (bij per cm/meter/rol is "stuks per doos" geen omdoos) en leest aanvullen met uit het veld of uit de soort. Een schatting van Claude gaat voor (geen dubbele telling).

**Velden die hierdoor open komen, op de emulator (verzonnen data, per regel één voorbeeld):**

| Laag | Open vóór regelcontrole | Open na | Door |
|---|---|---|---|
| 1 Prioriteit | 33 | 34 | 1 × `a-doos` |
| 2 Belangrijk | 25 | 26 | 1 × `p-maat` |
| 3 Medium | 18 | 19 | 1 × `p-dooscm` |

De echte aantallen zijn bij Daan: Poort 0.4 en Te controleren → Productdata.

Aannames: 5 nieuwe regels in `wh/aannames.js` met `bevestigd: Daan (chat) 2026-10-17` (`p-nogopen`, `p-regelcheck`, `p-rc-dooscm`, `p-rc-maat`, `a-rc-doos`; `p-steek` en `p-pdbron` bijgewerkt).

## 5. Kleine punten
- `wh/pdbron.js`: de override per apparaat (`localStorage 'ivol-pd-bron'`) is eruit; alleen de schakelaar in Poort 0.4 (catalog `wh-pd-bron`, alleen Daan) bepaalt de stand.
- `wh/ivol.js`, pagina Koppeling Picqer: tekst bijgewerkt naar de stand nu (schakelaar "Andere apps gebruiken productdata", standaard uit, geen instelling per apparaat). De zin dat Warehouse en Junior "na akkoord volgen" is weg.
- **Let op:** `wh/core.js` (regel 22, buiten de toegestane lijst) heeft nog een eigen `ivol-pd-bron`-override, voor het laden van productdata in Warehouse en Junior. Daar niets aan veranderd; wil je de override overal weg, dan moet die regel ook aangepast worden.

## 6. Testen
Emulator (Playwright, Supabase en CDN's gemockt, verzonnen data, vaste klok), basis `a79412f` tegen nieuw. De emulator staat niet in de repo.
- Functioneel: 69 controles, 0 fout. Nog open (alleen open velden, groepering en volgorde, Later ingeklapt, geen filters, Klopt bij een `tw`, typen en verlaten, Tab, leeg-toestand naar volgende laag en naar Poort), Te doen 0.4 (alleen rode regels, één knop, links per laag, link opent het scherm in 3.0), steekproef (grijs bij < 100%, oude vervalt, nooit "–"), regelcontrole (de drie voorbeelden komen open; 50 cm per doos, onbekend gewicht, nvt en max 45 bij bundels van 15 niet; Klopt en aanpassen; Te controleren; niets geschreven bij alleen openen), schakelaar zonder override (aan en uit, beide kanten).
- Regressie: zichtbare tekst identiek op `warehouse.html` (`#/`, `#/aanvullen`, `#/containers`), `junior.html`, `ploeg.html`, `containerplanning.html` (`#/`, `#/c/1`), `container-labels.html`, `index.html`, `productkaart.html`, `claude.html`, `test.html#/` en `ivol.html#/dag`; geen nieuwe PAGEERROR; geen writes erbij. Alleen de Productdata-schermen verschillen, zoals bedoeld (percentages, "families klaar", teller Te controleren: de drie voorbeelden tellen nu mee).
- Telefoon 390 px: geen horizontaal scrollen op Nog open (laag 1 t/m 3), Poort 0.4, Te doen, taak 0.4, Te controleren en Koppeling (ook in het 3.0-iframe). De tabel scrolt binnen de kaart.
- Snelheid met 747 producten: poort 45 ms, scherm Nog open 99 ms.
- Niet getest: echte data en echte Picqer; Per familie (`pdfamilie.js`) toont een waarde die tegen een regel ingaat als leeg en bewaart een gekozen familiewaarde zonder Klopt-markering. Klopt zetten doe je in Nog open of Te controleren.
