/* =====================================================================
   IVOL Warehouse Junior — handleiding (nl, en, es, el)
   Picqer-menunamen blijven Nederlands, zo staan ze in Picqer.
   ===================================================================== */
window.JH = {
nl:`
<h2>Handleiding IVOL Warehouse Junior</h2>

<h3>1. Wat we bouwen</h3>
<p>IVOL Warehouse is één app bovenop Picqer die het magazijnwerk plant: containers, aanvullen en locaties. <b>Junior</b> is de versie voor op de vloer.</p>
<ul>
<li><b>Geen briefjes meer.</b> De app zegt wat van bulk naar de picklocatie moet, op volgorde van belang.</li>
<li><b>Orders sneller de deur uit.</b> Eerst wat klantorders tegenhoudt, oudste order eerst.</li>
<li><b>Minder zoeken, minder kwijt.</b> Elke verplaatsing wordt in Picqer geboekt, dus de voorraad staat waar Picqer zegt.</li>
<li><b>Eén lijst voor iedereen.</b> Op pc, tablet en telefoon, en je ziet wat al gedaan is.</li>
<li><b>Scannen in plaats van typen.</b> Elke regel heeft een barcode.</li>
</ul>

<h3>2. Hoe het werkt</h3>
<p>Picqer houdt een order in backorder zolang de voorraad alleen op bulk staat. Pas als de voorraad op de picklocatie staat én de backorders zijn verwerkt, wordt de order een picklijst.</p>
<p><b>Wij verplaatsen → Verwerk backorders → orderpickers kunnen pikken.</b> Junior maakt van twee Picqer-exports één lijst op prioriteit.</p>

<h3>3. De schermen</h3>
<p><b>Vandaag</b>: tegels met wat er nu moet. Tik op een tegel. Staat er "de lijst is niet van vandaag", vernieuw dan eerst de lijst (zie 4).</p>
<p><b>Aanvullen</b></p>
<ul>
<li><b>Lijst vernieuwen</b> (vak bovenaan): sleep de twee exports erin. Daaronder: hoeveel orders sinds de vorige lijst zijn opgelost, nog open en nieuw.</li>
<li><b>1 · Nu verplaatsen</b>: hier wachten klantorders op, verder zijn ze compleet. Per regel: product, <b>VAN</b> (bulk) → <b>NAAR</b> (picklocatie), het grote getal = hoeveel je verplaatst, aantal orders, oudste order en een barcode. Volgorde: oudste order eerst of looproute. Filter per gang.</li>
<li><b>2 · Aanvulronde</b>: picklocaties die bijgevuld moeten worden, zonder wachtende order. Per gang.</li>
<li><b>Niet nu</b>: Picqer zegt verplaatsen, maar de order wordt er niet compleet van. Niet verplaatsen.</li>
<li><b>Vakje ✓</b>: aantikken als het verplaatst én in Picqer geboekt is. Iedereen ziet het.</li>
<li><b>✎ klopt niet / past niet</b>: vul in hoeveel er echt op de picklocatie past, of een opmerking (bulk leeg, andere plek). Daan past het aanvulniveau aan.</li>
<li><b>Verwerk backorders gedaan</b> (onderaan Nu verplaatsen): aantikken nadat je in Picqer de backorders hebt verwerkt.</li>
<li><b>Rood</b>: afgevinkt, maar na Verwerk backorders staat hij er nog. Kijk in Picqer of hij echt (genoeg) verplaatst is.</li>
<li><b>Print</b>: papieren lijst met vakje, van, naar, aantal, barcode en een kolom Gedaan voor het echte aantal.</li>
</ul>
<p><b>Containers</b>: containers die eraan komen, met pakbon en losplanning (PDF) zodra Daan die klaar heeft.</p>
<p><b>Palletlabels</b>: de palletlabel-generator (nieuw venster).</p>

<h3>4. Exports uit Picqer, stap voor stap</h3>
<p><b>Backorders (Excel)</b></p>
<ol><li>Open Picqer op de computer.</li><li>Menu <b>Backorders</b>.</li><li>Knop <b>Exporteer backorders</b>. Het bestand komt in Downloads.</li></ol>
<p><b>Aanvuladvies (PDF)</b></p>
<ol><li>Menu <b>Aanvuladvies</b>.</li><li>Knop <b>PDF</b> (picklijst bulklocaties). Opslaan in Downloads.</li></ol>
<p><b>Inladen</b></p>
<ol><li>Open Junior → <b>Aanvullen</b>.</li><li>Sleep beide bestanden in het vak <b>Lijst vernieuwen</b>, of tik op het vak en kies ze.</li><li>Wacht op ✓ Backorders en ✓ Aanvuladvies. Klaar: iedereen ziet de nieuwe lijst.</li></ol>
<p><b>Wanneer:</b> elke ochtend om 07:30, na elke Verwerk backorders, en als de lijst niet van vandaag is.<br>Foutmelding? Maak een foto van de melding en stuur die naar Daan. Picqer in het Engels werkt ook.</p>

<h3>5. Verplaatsen met de Picqer-app (scanner)</h3>
<ol>
<li>Open in de Picqer-app <b>Aanvuladvies</b>.</li>
<li>Scan de barcode van het product op de lijst. Het verplaatsvenster opent.</li>
<li><b>Van</b>: de bulklocatie op de lijst.</li>
<li><b>Naar</b>: de picklocatie op de lijst. Scan de locatiesticker of kies hem. <b>Nooit een container</b>: containers 1–6 zijn retourkarren.</li>
<li><b>Aantal</b>: het grote getal op de lijst, of wat er echt verplaatst is. Bevestig.</li>
<li>Staat er <b>geen specifieke locatie</b>? Verplaats dan naar geen specifieke locatie, alleen het aantal voor de orders.</li>
<li>Klopt de voorraad niet (bulk leeg, meer of minder op de picklocatie)? Pas het meteen aan in de scanner.</li>
<li>Vink de regel af in Junior en schrijf het echte aantal op het papier.</li>
</ol>

<h3>6. Een ronde van begin tot eind</h3>
<ol>
<li>Lijst vernieuwen (4).</li>
<li><b>1 · Nu verplaatsen</b>: printen of op de telefoon, alles verplaatsen (5). Dit gaat voor: hier wachten klanten op.</li>
<li>Picqer → <b>Backorders</b> → <b>Verwerk backorders</b>. In Junior: <b>Verwerk backorders gedaan</b>.</li>
<li>Lijst opnieuw vernieuwen. Rode regels nakijken.</li>
<li><b>2 · Aanvulronde</b> per gang.</li>
</ol>

<h3>7. Als iets niet klopt</h3>
<ul>
<li><b>Bulk leeg of pallet niet te vinden</b>: ✎ klopt niet met een opmerking, en meld het bij Daan.</li>
<li><b>Past niet op de picklocatie</b>: ✎ en vul in hoeveel er past.</li>
<li><b>Order na verwerken nog in backorder (rood)</b>: kijk in Picqer of de voorraad echt op de picklocatie staat.</li>
<li><b>Geen verbinding</b>: even wachten en ↻. Blijft het zo, meld het bij Daan.</li>
</ul>`,

en:`
<h2>IVOL Warehouse Junior manual</h2>

<h3>1. What we are building</h3>
<p>IVOL Warehouse is one app on top of Picqer that plans the warehouse work: containers, replenishment and locations. <b>Junior</b> is the version for the warehouse floor.</p>
<ul>
<li><b>No more paper notes.</b> The app tells you what has to go from bulk to the pick location, in order of importance.</li>
<li><b>Orders leave faster.</b> First what is holding customer orders, oldest order first.</li>
<li><b>Less searching, less lost stock.</b> Every move is booked in Picqer, so stock is where Picqer says.</li>
<li><b>One list for everyone.</b> On PC, tablet and phone, and you see what is already done.</li>
<li><b>Scan instead of typing.</b> Every line has a barcode.</li>
</ul>

<h3>2. How it works</h3>
<p>Picqer keeps an order in backorder as long as the stock is only on bulk. Only when the stock is on the pick location and the backorders are processed does the order become a picklist.</p>
<p><b>We move → Verwerk backorders → order pickers can pick.</b> Junior turns two Picqer exports into one list by priority.</p>

<h3>3. The screens</h3>
<p><b>Today</b>: tiles with what needs doing now. Tap a tile. If it says "the list is not from today", refresh the list first (see 4).</p>
<p><b>Replenish</b></p>
<ul>
<li><b>Refresh list</b> (box at the top): drop the two exports in it. Below it: how many orders were solved, are still open and are new since the previous list.</li>
<li><b>1 · Move now</b>: customer orders are waiting for these, otherwise they are complete. Per line: product, <b>FROM</b> (bulk) → <b>TO</b> (pick location), the big number = how many to move, number of orders, oldest order and a barcode. Order: oldest order first or walking route. Filter by aisle.</li>
<li><b>2 · Replenishment round</b>: pick locations that need topping up, with no order waiting. By aisle.</li>
<li><b>Not now</b>: Picqer says move it, but it does not complete the order. Do not move.</li>
<li><b>Box ✓</b>: tick it when it is moved and booked in Picqer. Everyone sees it.</li>
<li><b>✎ not right / does not fit</b>: enter how many really fit on the pick location, or a remark (bulk empty, other place). Daan adjusts the replenishment level.</li>
<li><b>Verwerk backorders done</b> (bottom of Move now): tick it after processing the backorders in Picqer.</li>
<li><b>Red</b>: ticked, but after Verwerk backorders it is still there. Check in Picqer if it was really moved (enough).</li>
<li><b>Print</b>: paper list with box, from, to, quantity, barcode and a Done column for the real quantity.</li>
</ul>
<p><b>Containers</b>: containers on their way, with packing list and unloading plan (PDF) once Daan has finished it. At the top of every pallet label it says where the pallet goes: TO a bulk place, a pick location or VST.</p>
<p><b>Pallet labels</b>: the pallet label generator (new window).</p>

<h3>4. Exports from Picqer, step by step</h3>
<p><b>Backorders (Excel)</b></p>
<ol><li>Open Picqer on the computer.</li><li>Menu <b>Backorders</b>.</li><li>Button <b>Exporteer backorders</b>. The file goes to Downloads.</li></ol>
<p><b>Replenishment advice (PDF)</b></p>
<ol><li>Menu <b>Aanvuladvies</b>.</li><li>Button <b>PDF</b> (picklijst bulklocaties). Save to Downloads.</li></ol>
<p><b>Loading</b></p>
<ol><li>Open Junior → <b>Replenish</b>.</li><li>Drop both files in the box <b>Refresh list</b>, or tap the box and choose them.</li><li>Wait for ✓ Backorders and ✓ Replenishment advice. Done: everyone sees the new list.</li></ol>
<p><b>When:</b> every morning at 07:30, after every Verwerk backorders, and when the list is not from today.<br>Error message? Take a photo of it and send it to Daan. Picqer in English also works.</p>

<h3>5. Moving with the Picqer app (scanner)</h3>
<ol>
<li>In the Picqer app open <b>Aanvuladvies</b>.</li>
<li>Scan the product barcode on the list. The move screen opens.</li>
<li><b>From</b>: the bulk location on the list.</li>
<li><b>To</b>: the pick location on the list. Scan the location sticker or choose it. <b>Never a container</b>: containers 1–6 are return carts.</li>
<li><b>Quantity</b>: the big number on the list, or what you really moved. Confirm.</li>
<li>Does it say <b>no specific location</b>? Move it to "geen specifieke locatie", only the quantity for the orders.</li>
<li>Stock not right (bulk empty, more or less on the pick location)? Correct it straight away in the scanner.</li>
<li>Tick the line in Junior and write the real quantity on the paper.</li>
</ol>

<h3>6. One round from start to finish</h3>
<ol>
<li>Refresh the list (4).</li>
<li><b>1 · Move now</b>: print it or use the phone, move everything (5). This comes first: customers are waiting.</li>
<li>Picqer → <b>Backorders</b> → <b>Verwerk backorders</b>. In Junior: <b>Verwerk backorders done</b>.</li>
<li>Refresh the list again. Check red lines.</li>
<li><b>2 · Replenishment round</b> by aisle.</li>
</ol>

<h3>7. When something is wrong</h3>
<ul>
<li><b>Bulk empty or pallet not found</b>: ✎ not right with a remark, and tell Daan.</li>
<li><b>Does not fit on the pick location</b>: ✎ and enter how many fit.</li>
<li><b>Order still in backorder after processing (red)</b>: check in Picqer if the stock is really on the pick location.</li>
<li><b>No connection</b>: wait a moment and ↻. Still not working? Tell Daan.</li>
</ul>`,

es:`
<h2>Manual de IVOL Warehouse Junior</h2>

<h3>1. Qué estamos construyendo</h3>
<p>IVOL Warehouse es una sola app encima de Picqer que planifica el trabajo del almacén: contenedores, reposición y ubicaciones. <b>Junior</b> es la versión para el almacén.</p>
<ul>
<li><b>Se acabaron las notas en papel.</b> La app dice qué hay que llevar del bulk a la ubicación pick, por orden de importancia.</li>
<li><b>Los pedidos salen antes.</b> Primero lo que frena pedidos de clientes, el pedido más antiguo primero.</li>
<li><b>Menos buscar, menos cosas perdidas.</b> Cada movimiento se registra en Picqer, así el stock está donde dice Picqer.</li>
<li><b>Una lista para todos.</b> En PC, tablet y móvil, y ves lo que ya está hecho.</li>
<li><b>Escanear en vez de escribir.</b> Cada línea tiene un código de barras.</li>
</ul>

<h3>2. Cómo funciona</h3>
<p>Picqer deja un pedido en backorder mientras el stock solo está en bulk. Solo cuando el stock está en la ubicación pick y se procesan los backorders, el pedido pasa a ser una lista de picking.</p>
<p><b>Nosotros movemos → Verwerk backorders → los pickers pueden preparar.</b> Junior convierte dos exportaciones de Picqer en una lista por prioridad.</p>

<h3>3. Las pantallas</h3>
<p><b>Hoy</b>: fichas con lo que hay que hacer ahora. Toca una ficha. Si pone "la lista no es de hoy", actualiza primero la lista (ver 4).</p>
<p><b>Reponer</b></p>
<ul>
<li><b>Actualizar lista</b> (casilla de arriba): arrastra ahí las dos exportaciones. Debajo: cuántos pedidos se resolvieron, siguen abiertos y son nuevos desde la lista anterior.</li>
<li><b>1 · Mover ahora</b>: aquí esperan pedidos de clientes; por lo demás están completos. Por línea: producto, <b>DE</b> (bulk) → <b>A</b> (ubicación pick), el número grande = cuánto mover, número de pedidos, pedido más antiguo y un código de barras. Orden: pedido más antiguo primero o recorrido. Filtro por pasillo.</li>
<li><b>2 · Ronda de reposición</b>: ubicaciones pick que hay que rellenar, sin pedido esperando. Por pasillo.</li>
<li><b>Ahora no</b>: Picqer dice mover, pero no completa el pedido. No lo muevas.</li>
<li><b>Casilla ✓</b>: márcala cuando esté movido y registrado en Picqer. Todos lo ven.</li>
<li><b>✎ no cuadra / no cabe</b>: pon cuánto cabe de verdad en la ubicación pick, o un comentario (bulk vacío, otro sitio). Daan ajusta el nivel de reposición.</li>
<li><b>Verwerk backorders hecho</b> (abajo en Mover ahora): márcalo después de procesar los backorders en Picqer.</li>
<li><b>Rojo</b>: marcado, pero después de Verwerk backorders sigue ahí. Mira en Picqer si de verdad se movió (suficiente).</li>
<li><b>Imprimir</b>: lista en papel con casilla, de, a, cantidad, código de barras y una columna Hecho para la cantidad real.</li>
</ul>
<p><b>Contenedores</b>: contenedores que llegan, con albarán y plan de descarga (PDF) cuando Daan lo tenga listo. Arriba en cada etiqueta de palé pone adónde va el palé: A un sitio de bulk, una ubicación pick o VST.</p>
<p><b>Etiquetas de palé</b>: el generador de etiquetas (ventana nueva).</p>

<h3>4. Exportaciones de Picqer, paso a paso</h3>
<p><b>Backorders (Excel)</b></p>
<ol><li>Abre Picqer en el ordenador.</li><li>Menú <b>Backorders</b>.</li><li>Botón <b>Exporteer backorders</b>. El archivo va a Descargas.</li></ol>
<p><b>Consejo de reposición (PDF)</b></p>
<ol><li>Menú <b>Aanvuladvies</b>.</li><li>Botón <b>PDF</b> (picklijst bulklocaties). Guárdalo en Descargas.</li></ol>
<p><b>Cargar</b></p>
<ol><li>Abre Junior → <b>Reponer</b>.</li><li>Arrastra los dos archivos a la casilla <b>Actualizar lista</b>, o toca la casilla y elígelos.</li><li>Espera a ✓ Backorders y ✓ Consejo de reposición. Listo: todos ven la lista nueva.</li></ol>
<p><b>Cuándo:</b> cada mañana a las 07:30, después de cada Verwerk backorders, y cuando la lista no es de hoy.<br>¿Mensaje de error? Hazle una foto y mándasela a Daan. Picqer en inglés también funciona.</p>

<h3>5. Mover con la app de Picqer (escáner)</h3>
<ol>
<li>En la app de Picqer abre <b>Aanvuladvies</b>.</li>
<li>Escanea el código de barras del producto en la lista. Se abre la pantalla de mover.</li>
<li><b>De</b>: la ubicación bulk de la lista.</li>
<li><b>A</b>: la ubicación pick de la lista. Escanea la pegatina de la ubicación o elígela. <b>Nunca un contenedor</b>: los contenedores 1–6 son carros de devoluciones.</li>
<li><b>Cantidad</b>: el número grande de la lista, o lo que de verdad moviste. Confirma.</li>
<li>¿Pone <b>sin ubicación específica</b>? Muévelo a "geen specifieke locatie", solo la cantidad para los pedidos.</li>
<li>¿El stock no cuadra (bulk vacío, más o menos en la ubicación pick)? Corrígelo enseguida en el escáner.</li>
<li>Marca la línea en Junior y escribe la cantidad real en el papel.</li>
</ol>

<h3>6. Una ronda de principio a fin</h3>
<ol>
<li>Actualizar la lista (4).</li>
<li><b>1 · Mover ahora</b>: imprime o usa el móvil, muévelo todo (5). Esto va primero: hay clientes esperando.</li>
<li>Picqer → <b>Backorders</b> → <b>Verwerk backorders</b>. En Junior: <b>Verwerk backorders hecho</b>.</li>
<li>Vuelve a actualizar la lista. Revisa las líneas rojas.</li>
<li><b>2 · Ronda de reposición</b> por pasillo.</li>
</ol>

<h3>7. Si algo no cuadra</h3>
<ul>
<li><b>Bulk vacío o palé que no aparece</b>: ✎ no cuadra con un comentario, y díselo a Daan.</li>
<li><b>No cabe en la ubicación pick</b>: ✎ y pon cuánto cabe.</li>
<li><b>Pedido sigue en backorder después de procesar (rojo)</b>: mira en Picqer si el stock está de verdad en la ubicación pick.</li>
<li><b>Sin conexión</b>: espera un momento y ↻. ¿Sigue igual? Díselo a Daan.</li>
</ul>`,

el:`
<h2>Εγχειρίδιο IVOL Warehouse Junior</h2>

<h3>1. Τι φτιάχνουμε</h3>
<p>Το IVOL Warehouse είναι μία εφαρμογή πάνω από το Picqer που οργανώνει τη δουλειά της αποθήκης: κοντέινερ, αναπλήρωση και θέσεις. Το <b>Junior</b> είναι η έκδοση για την αποθήκη.</p>
<ul>
<li><b>Τέλος τα χαρτάκια.</b> Η εφαρμογή λέει τι πρέπει να πάει από το bulk στη θέση pick, με σειρά σημασίας.</li>
<li><b>Οι παραγγελίες φεύγουν πιο γρήγορα.</b> Πρώτα ό,τι κρατάει παραγγελίες πελατών, η παλαιότερη πρώτα.</li>
<li><b>Λιγότερο ψάξιμο, λιγότερα χαμένα.</b> Κάθε μετακίνηση καταγράφεται στο Picqer, οπότε το απόθεμα είναι εκεί που λέει το Picqer.</li>
<li><b>Μία λίστα για όλους.</b> Σε υπολογιστή, tablet και κινητό, και βλέπεις τι έχει ήδη γίνει.</li>
<li><b>Σκανάρισμα αντί για πληκτρολόγηση.</b> Κάθε γραμμή έχει barcode.</li>
</ul>

<h3>2. Πώς λειτουργεί</h3>
<p>Το Picqer κρατάει μια παραγγελία σε backorder όσο το απόθεμα είναι μόνο στο bulk. Μόνο όταν το απόθεμα είναι στη θέση pick και γίνει επεξεργασία των backorders, η παραγγελία γίνεται λίστα συλλογής.</p>
<p><b>Εμείς μετακινούμε → Verwerk backorders → οι pickers μπορούν να μαζέψουν.</b> Το Junior μετατρέπει δύο εξαγωγές του Picqer σε μία λίστα με προτεραιότητα.</p>

<h3>3. Οι οθόνες</h3>
<p><b>Σήμερα</b>: πλακίδια με ό,τι χρειάζεται τώρα. Πάτησε ένα πλακίδιο. Αν γράφει «η λίστα δεν είναι σημερινή», ανανέωσε πρώτα τη λίστα (δες 4).</p>
<p><b>Αναπλήρωση</b></p>
<ul>
<li><b>Ανανέωση λίστας</b> (πλαίσιο πάνω): σύρε εκεί τις δύο εξαγωγές. Από κάτω: πόσες παραγγελίες λύθηκαν, είναι ακόμα ανοιχτές και είναι νέες από την προηγούμενη λίστα.</li>
<li><b>1 · Μετακίνηση τώρα</b>: εδώ περιμένουν παραγγελίες πελατών· κατά τα άλλα είναι πλήρεις. Ανά γραμμή: προϊόν, <b>ΑΠΟ</b> (bulk) → <b>ΠΡΟΣ</b> (θέση pick), ο μεγάλος αριθμός = πόσα μετακινείς, αριθμός παραγγελιών, παλαιότερη παραγγελία και barcode. Σειρά: παλαιότερη παραγγελία πρώτα ή διαδρομή. Φίλτρο ανά διάδρομο.</li>
<li><b>2 · Γύρος αναπλήρωσης</b>: θέσεις pick που πρέπει να συμπληρωθούν, χωρίς παραγγελία σε αναμονή. Ανά διάδρομο.</li>
<li><b>Όχι τώρα</b>: το Picqer λέει μετακίνηση, αλλά δεν ολοκληρώνει την παραγγελία. Μην το μετακινείς.</li>
<li><b>Κουτάκι ✓</b>: πάτησέ το όταν μετακινήθηκε και καταγράφηκε στο Picqer. Όλοι το βλέπουν.</li>
<li><b>✎ δεν ταιριάζει / δεν χωράει</b>: γράψε πόσα χωράνε πραγματικά στη θέση pick, ή ένα σχόλιο (άδειο bulk, άλλη θέση). Ο Daan προσαρμόζει το επίπεδο αναπλήρωσης.</li>
<li><b>Verwerk backorders έγινε</b> (κάτω στο Μετακίνηση τώρα): πάτησέ το αφού κάνεις επεξεργασία των backorders στο Picqer.</li>
<li><b>Κόκκινο</b>: σημειώθηκε, αλλά μετά το Verwerk backorders είναι ακόμα εδώ. Κοίτα στο Picqer αν μετακινήθηκε πραγματικά (αρκετά).</li>
<li><b>Εκτύπωση</b>: χάρτινη λίστα με κουτάκι, από, προς, ποσότητα, barcode και στήλη Έγινε για την πραγματική ποσότητα.</li>
</ul>
<p><b>Κοντέινερ</b>: κοντέινερ που έρχονται, με δελτίο αποστολής και πλάνο εκφόρτωσης (PDF) όταν ο Daan το ετοιμάσει. Πάνω σε κάθε ετικέτα παλέτας γράφει πού πάει η παλέτα: ΠΡΟΣ θέση bulk, θέση pick ή VST.</p>
<p><b>Ετικέτες παλετών</b>: η γεννήτρια ετικετών (νέο παράθυρο).</p>

<h3>4. Εξαγωγές από το Picqer, βήμα βήμα</h3>
<p><b>Backorders (Excel)</b></p>
<ol><li>Άνοιξε το Picqer στον υπολογιστή.</li><li>Μενού <b>Backorders</b>.</li><li>Κουμπί <b>Exporteer backorders</b>. Το αρχείο πάει στις Λήψεις.</li></ol>
<p><b>Πρόταση αναπλήρωσης (PDF)</b></p>
<ol><li>Μενού <b>Aanvuladvies</b>.</li><li>Κουμπί <b>PDF</b> (picklijst bulklocaties). Αποθήκευση στις Λήψεις.</li></ol>
<p><b>Φόρτωση</b></p>
<ol><li>Άνοιξε το Junior → <b>Αναπλήρωση</b>.</li><li>Σύρε και τα δύο αρχεία στο πλαίσιο <b>Ανανέωση λίστας</b>, ή πάτησε το πλαίσιο και διάλεξέ τα.</li><li>Περίμενε το ✓ Backorders και το ✓ Πρόταση αναπλήρωσης. Έτοιμο: όλοι βλέπουν τη νέα λίστα.</li></ol>
<p><b>Πότε:</b> κάθε πρωί στις 07:30, μετά από κάθε Verwerk backorders, και όταν η λίστα δεν είναι σημερινή.<br>Μήνυμα σφάλματος; Βγάλε φωτογραφία και στείλ’ την στον Daan. Το Picqer στα αγγλικά δουλεύει επίσης.</p>

<h3>5. Μετακίνηση με την εφαρμογή Picqer (σκάνερ)</h3>
<ol>
<li>Στην εφαρμογή Picqer άνοιξε το <b>Aanvuladvies</b>.</li>
<li>Σκάναρε το barcode του προϊόντος στη λίστα. Ανοίγει η οθόνη μετακίνησης.</li>
<li><b>Από</b>: η θέση bulk της λίστας.</li>
<li><b>Προς</b>: η θέση pick της λίστας. Σκάναρε το αυτοκόλλητο της θέσης ή διάλεξέ τη. <b>Ποτέ κοντέινερ</b>: τα κοντέινερ 1–6 είναι καρότσια επιστροφών.</li>
<li><b>Ποσότητα</b>: ο μεγάλος αριθμός της λίστας, ή όσα μετακίνησες πραγματικά. Επιβεβαίωσε.</li>
<li>Γράφει <b>χωρίς συγκεκριμένη θέση</b>; Μετακίνησέ το σε «geen specifieke locatie», μόνο την ποσότητα για τις παραγγελίες.</li>
<li>Δεν ταιριάζει το απόθεμα (άδειο bulk, περισσότερα ή λιγότερα στη θέση pick); Διόρθωσέ το αμέσως στο σκάνερ.</li>
<li>Σημείωσε τη γραμμή στο Junior και γράψε την πραγματική ποσότητα στο χαρτί.</li>
</ol>

<h3>6. Ένας γύρος από την αρχή ως το τέλος</h3>
<ol>
<li>Ανανέωση λίστας (4).</li>
<li><b>1 · Μετακίνηση τώρα</b>: τύπωσε ή χρησιμοποίησε το κινητό, μετακίνησε τα πάντα (5). Αυτό έχει προτεραιότητα: περιμένουν πελάτες.</li>
<li>Picqer → <b>Backorders</b> → <b>Verwerk backorders</b>. Στο Junior: <b>Verwerk backorders έγινε</b>.</li>
<li>Ανανέωσε ξανά τη λίστα. Έλεγξε τις κόκκινες γραμμές.</li>
<li><b>2 · Γύρος αναπλήρωσης</b> ανά διάδρομο.</li>
</ol>

<h3>7. Όταν κάτι δεν ταιριάζει</h3>
<ul>
<li><b>Άδειο bulk ή παλέτα που δεν βρίσκεται</b>: ✎ δεν ταιριάζει με σχόλιο, και πες το στον Daan.</li>
<li><b>Δεν χωράει στη θέση pick</b>: ✎ και γράψε πόσα χωράνε.</li>
<li><b>Παραγγελία ακόμα σε backorder μετά την επεξεργασία (κόκκινο)</b>: κοίτα στο Picqer αν το απόθεμα είναι πραγματικά στη θέση pick.</li>
<li><b>Χωρίς σύνδεση</b>: περίμενε λίγο και ↻. Αν συνεχίζει, πες το στον Daan.</li>
</ul>`
};
