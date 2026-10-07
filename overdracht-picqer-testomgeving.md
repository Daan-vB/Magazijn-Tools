# Overdracht: bouwen in de Picqer-testomgeving (ivol-dev)

Voor het project dat over testomgevingen gaat. Dit document bevat alles om direct te beginnen; verder terugkijken is niet nodig.

## Wat er moet gebeuren
Een complete keten **van A tot Z in de Picqer-testomgeving** opbouwen met verzonnen data — leveranciers, producten, locaties, voorraad, inkooporders, ontvangsten, orders, backorders, aanvullingen — en die pas daarna koppelen aan **IVOL Warehouse Test**. Niets in de gewone Warehouse-app, niets in Junior, niets live.

Volgorde: eerst de testomgeving vullen, dan testen, dan pas aan de app koppelen.

## Scope: alleen Europese leveranciers
Containers van buiten Europa lopen via Containerplanning en blijven hier buiten. Het Europese proces:
1. Gino bestelt bij de leverancier (inkoop, buiten het magazijn om).
2. Karin bewaakt orderbevestigingen, herstelt fouten, past levertijden aan.
3. Levering komt binnen en wordt gelost. Daan, Kate of Sala controleren de pakbon tegen de levering; mankementen gaan naar Karin.
4. Karin boekt op in Picqer op "geen specifieke locatie" en verwerkt de backorders, zodat er picklijsten komen.
5. Vanaf hier neemt de app het over: wat gaat direct weg voor orders, welke palletlabels zijn nodig, wat moet waarheen, en achteraf een controle.

Europese pallets gaan vrijwel nooit naar VST — dat is een uitzondering, geen regel.

## Wat er nu al is (repo Daan-vB/Magazijn-Tools)

### Supabase Edge Functions (project `jarbgetbwkjtxwtcfwmq`, "Palletlabels")
- **`picqer`** — tussenstation naar de echte Picqer (ivol.picqer.com). **Alleen GET.**
- **`picqer-test`** — zelfde functie, maar naar de testomgeving. **Alleen GET.** Weigert te draaien als het domein de echte ivol is; elk antwoord bevat `"omgeving":"test"`.
- Secrets (Edge Functions → Secrets): `PICQER_DOMAIN`, `PICQER_KEY`, `PICQER_TEST_DOMAIN`, `PICQER_TEST_KEY`, `IVOL_CODE` (koppelcode die de app meestuurt als header `x-ivol-code`), `PICQER_TEST_WAREHOUSE`, `PICQER_TEST_VST`.
- Functies gaan automatisch live via GitHub Actions ("Supabase-functies live zetten") bij een push naar `main` die `supabase/functions/**` raakt. Handmatig: Actions → die workflow → Run workflow.

Acties die beide functies kennen: `status`, `vandaag`, `producten`, `picklijst`, `catalogus`, `locaties`, `mutaties`, `verplaatsingen`, `ontvangsten`, `ontvangstenlijst`, **`keten`** (inkooporders + ontvangsten + leveranciers + gebruikers in één antwoord).

### App
- `test.html` = IVOL Warehouse **Test**. Knop **Bron** bovenin schakelt tussen LIVE (functie `picqer`) en TEST (functie `picqer-test`) — zie `wh/bron.js`.
- `warehouse.html` (dagelijkse app) en `junior.html` (de vloer) bevatten **niets** van dit werk.
- In Test staat een tab **Ontvangsten** (`wh/levering.js`, scherm `#/leveringen`): de vijf stappen, een demo-stand met verzonnen leveringen, en een controlestap die de verplaatsingen uit Picqer naleest. Die is gebouwd vóórdat de testomgeving gevuld was — te gebruiken als vertrekpunt of opnieuw te doen.

## Wat ontbreekt en als eerste moet
**Schrijven naar de Picqer-testomgeving.** Beide functies doen uitsluitend GET; er is nog geen manier om in ivol-dev iets aan te maken.

Voorstel: een aparte functie `picqer-seed` in dezelfde Supabase-map, die
- weigert te draaien als `PICQER_TEST_DOMAIN` naar de echte ivol wijst (zelfde controle als `picqer-test`),
- de koppelcode `IVOL_CODE` eist,
- alles aanmaakt met voorvoegsel `DEMO-` zodat het herkenbaar is en weer te verwijderen,
- herhaalbaar is (bestaat het al, dan overslaan),
- in het antwoord precies teruggeeft wat is aangemaakt.

Te vullen in deze volgorde: magazijn en locaties (pick en bulk) → leveranciers → producten met stuks per pallet en EAN → beginvoorraad → inkooporders met besteldatum en verwachte leverdatum → klantorders en backorders → ontvangsten.

**Eerst controleren:** heeft de API-sleutel van ivol-dev schrijfrechten? Picqer (test) → Instellingen → API-sleutels → bij die sleutel de vinkjes voor schrijven. Zonder die rechten kan er niets aangemaakt worden en moet er een nieuwe sleutel komen.

## Afspraken
- Stap voor stap, één onderwerp tegelijk afronden. Niet vooruit bouwen.
- Hooguit één vraag tegelijk; niets aannemen.
- Daan is geen programmeur: bij GitHub, Supabase of Picqer altijd genummerde klikstappen.
- Productcode is heilig: altijd de exacte Picqer-productcode, bij twijfel markeren.
- Niets uitrollen naar `warehouse.html` of `junior.html` zonder dat Daan dat vraagt.
