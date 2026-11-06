# MindTrack v2

Denní zápis sociálních sítí, následujícího spánku a nálady. Stres, soustředění a volné poznámky se nesbírají. Datum označuje den používání sítí a nálady; spánek patří k noci, která po tomto dni následovala. Vyplňuje se ráno.

## Stav

Kód integrace je připraven. Před použitím pro sběr dat je nutné nasadit SQL migraci, zapnout Anonymous Sign-Ins v Supabase a ověřit celý tok se dvěma testovacími účastníky. Nenahrazovat toto ověření pouhou kontrolou kódu.

## Supabase

1. Projekt: `rukeziypxobbwzrjnlqj` (již existující projekt autora).
2. Spustit `supabase/migrations/202611050001_mindtrack_v2.sql` jednou na tomto projektu.
3. V Authentication → Sign In / Providers povolit Anonymous Sign-Ins.
4. `config.js` obsahuje pouze veřejnou adresu a veřejný publishable key. Nikdy sem nevkládat service_role ani secret key.
5. Každý účastník má vlastní Supabase Auth ID. RLS omezuje čtení, změny a mazání na jeho vlastní řádky. Autor vyhodnocuje data z dashboardu Supabase, nikoli přes veřejný administrátorský klíč ve webu.

Zapnutí sdílení vyžaduje nový souhlas a odešle i dosavadní místní záznamy v2. Opravy využívají upsert podle účastníka a dne. Neodeslané změny zůstávají místně pro další pokus. Pozastavení nezničí již odeslaná data. Ukončení účasti smaže řádek účastníka a kaskádově jeho záznamy; místní kopie zůstává.

Původní v1 data se automaticky nepřevádějí, protože měla jiné časové přiřazení spánku. Lze je samostatně stáhnout. Nemíchat je s v2 výzkumem.

## Spuštění a ověření

`python3 -m http.server 8000` a otevřít `/mindtrack/`.

Ověřit zápis, opravu, export, import v2, výpadek internetu a opakované odeslání bez duplicit. Dva prohlížeče musí představovat dva oddělené účastníky. Po smazání dat prohlížeče nelze obnovit původní anonymní přihlášení jen ze zálohy záznamů.

Počet účastníků, doba sledování a doba uchování údajů dosud nejsou určeny. Před sběrem je musí autor sdělit účastníkům.
