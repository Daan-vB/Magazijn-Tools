# Rapport tool 0.4 ronde b: voorstellen volgen Daans regels (17-10-2026)

Direct op `main`, geen vragen gesteld. Niets naar Picqer geschreven, `supabase/functions/**` niet aangeraakt, andere apps niet aangeraakt. Code alleen in `wh/productdata.js`, `wh/pdfamilie.js` en `wh/aannames.js`. Data alleen via `.github/claude/daan-2026-10-17b.json` en de workflow "Productdata door Claude".

## Data (punten 1–3)
Bron `daan`, reden "Daan 17-10 (regel)", geen twijfel-vlag. 27 regels, 27 waarden. Eigen invoer (invul, spraak, tabel, overgezet) wordt door `schrijf.py` nooit overschreven.
1. **Alles op pick (B4):** soort `pick` voor HN3188-black, holder-black-flat, holder-black-square, design-200-black, design-250-black, TRLBLACK-350. Verwacht: huidige waarde `deel` of `mix` (of leeg). Aanvullen bij en max op pick niet aangeraakt.
2. **Ribbel op maat (B7, p-rol):** MR65SX2.7-0.4 en -0.5 (1 m) plus -2 t/m -10, 20 codes. Lengte 1 t/m 3 m soort `deel`, 4 t/m 10 m soort `mix`. Verwacht `deel` of `mix` (of leeg); een andere waarde met een andere bron dan eigen invoer blijft staan.
3. **single-mounting-pin:** veld `mixgroep` geparkeerd (`park`) met de notitie "Pennen: vaste plek bij inpaktafel en mixpallet pennen op bulk (idee, geparkeerd 17-10)". De waarde (leeg) blijft zoals hij is.

**Workflow:** run 39006732658 (commit `3388fa2`) is **geslaagd**. Het aantal gezet en overgeslagen kon ik niet uit het log halen: vanuit deze sessie zijn de log-opslag van GitHub Actions en Supabase geblokkeerd (403), dus ook het teruglezen uit `productdata` kon niet. Het getal staat in het log van die run ("… waarden gezet voor … producten, … overgeslagen", per overgeslagen code een regel). Een droogtest van de samenvoeglogica van `schrijf.py` (zonder netwerk) gaf: leeg of `klein`/`claude` met `deel`/`mix` wordt gezet, eigen invoer blijft staan, het parkeren werkt op een leeg veld en laat eigen invoer staan. Maximaal 27 waarden kunnen gezet zijn.

## Code (punten 4–6)
4. **Verworpen = geen voorstel.** Een veld dat leeg staat met meta-bron `daan` krijgt geen voorstel (ook niet van kleurgenoten of de familie), niets voorgevuld of `~schatting` in Nog open, en wordt niet meer "overgezet" uit palletlabels (dat zou de 100 van de ribbel terugzetten). Het veld telt wel als open zolang het nodig is. Per familie en "alle kleuren" vullen zo'n veld ook niet meer. Geparkeerde velden vallen hier buiten (die tellen compleet).
5. **Ribbel.** Geen "zelfde als"- of familievoorstel voor stuks per pallet van of naar ribbel op maat (code MR65SX2.7-0.4-N en -0.5-N, ook in Per familie). Het commentaar bij `isOpMaat` is bijgewerkt: ribbel telt mee (alleen de schakelaar "Later en Op maat tellen mee" kan dat uitzetten).
6. **Palletmaat volgt de maatregels vóór de familie.** Volgorde nu: kleurgenoot, pakbon, bevestigde maatregel, familie, productmaat uit de naam, 80x120x180. Whiteboard groter dan 80x120: kleinste opslagmaat waar het bord in past (uit de maat in de naam, nu uit alle opslagmaten, niet meer alleen uit vier). Rubber ringmat met rand: 100x150 (behalve kleine matten met midden-pick). Voorbeelden in de emulator: 120240WM → 120x240, 120200WM en 11103.267 → 120x200, rm150x90 → 100x150.
   Keuzes: de hoogte volgt dezelfde volgorde (anders staat de hoogte van de familie bij een andere maat); "met rand" herken ik aan "ringmat" of "rubber … met rand" in de naam.

Aannames in `wh/aannames.js` (bevestigd Daan (chat) 2026-10-17): nieuw `p-verworpen`, `p-ribbel-spp`, `p-maatvolgorde`; `p-maat` aangepast aan de whiteboardregel.

## Testen
Emulator (verzonnen data, vaste klok), basis `929eb12` tegen nieuw:
- Nieuw: 27 controles, 0 fout (verworpen zonder voorstel en zonder overzetten, ribbel zonder zelfde-als terwijl een kleurgenoot 100 heeft, maatvoorbeelden, Nog open vult 120x240 voor, niets geschreven).
- Vorige suite: 69 controles, 0 fout.
- Regressie: zichtbare tekst identiek op 19 pagina's (Warehouse, Junior, Ploeg, Containers, Palletlabels, `claude.html`, 3.0 en de Productdata-schermen), geen nieuwe PAGEERROR, geen writes erbij.
- Niet getest: echte data. Of de drie echte voorbeelden (120240WM, 120200WM, 11103.267, rm150x90) kloppen hangt af van hun productnaam; het voorbeeld in de emulator gebruikt een verzonnen naam met de maat erin.
