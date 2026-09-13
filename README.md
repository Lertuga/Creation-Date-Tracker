# Creation Date Tracker

Modulo per **Foundry Virtual Tabletop** (v13+, verificato su v14.365) che aggiunge, alla scheda **Dettagli** di ogni documento con foglio (Attori, Oggetti, Scene, Journal, Macro, RollTable, Cards, Playlist, Combattenti, Tile, Wall, ecc.), un blocco per impostare e visualizzare una **data di creazione**, calcolata usando il **calendario del game system attivo** (l'API `game.time.calendar` introdotta nel core di Foundry a partire dalla v13.333, non l'orologio reale del computer).

## Come funziona

- Il modulo si aggancia all'hook `renderDocumentSheetV2`. Poiché ogni foglio documento "moderno" di Foundry (`ActorSheetV2`, `ItemSheetV2`, `SceneConfig`, `JournalEntrySheet`, `RollTableSheet`, `MacroConfig`, `PlaylistConfig`, `TokenConfig`, `WallConfig`, `RegionConfig`, ecc.) eredita da `DocumentSheetV2` e Foundry richiama gli hook per **tutte** le classi della catena di ereditarietà, il blocco compare automaticamente su qualunque foglio, indipendentemente dal game system installato.
- Il modulo cerca la tab con `data-tab="details"` (pattern usato da molti sistemi, es. dnd5e, pf2e) e vi inserisce il blocco. Se non la trova, lo aggiunge in fondo al form del foglio.
- Cliccando su **Imposta/Modifica** si apre una finestra di dialogo con i campi Anno, Mese (se il calendario ne definisce), Giorno, Ora, Minuto, Secondo — precompilati leggendo il calendario configurato per il mondo (`game.time.calendar`).
- Il pulsante **Usa istante attuale** applica immediatamente il tempo di gioco corrente (`game.time.worldTime`) come data di creazione, senza aprire il dialogo.
- Il pulsante **Rimuovi** cancella la data salvata.
- Solo il proprietario del documento (o un GM) vede i pulsanti di modifica; il valore, se impostato, è comunque visibile a chi ha accesso al foglio.

## Dati salvati

I dati sono salvati come *flag* sul documento stesso, quindi seguono il documento (si esportano/importano con esso):

```
flags["creation-date-tracker"].time         // worldTime assoluto in secondi
flags["creation-date-tracker"].components   // ultimi componenti calendario usati (anno, mese, giorno, ...)
```

## Installazione

1. Copia l'intera cartella `creation-date-tracker` dentro `Data/modules/` della tua installazione di Foundry (o crea un file manifest puntando a `module.json` se distribuisci il modulo da un repository).
2. Avvia Foundry, attiva il modulo "Data di Creazione (Calendario di Gioco)" nelle impostazioni del mondo.
3. Apri un qualsiasi foglio documento: nella scheda Dettagli troverai il nuovo blocco "Data di creazione".

## Note e limiti

- Richiede Foundry **v13 o superiore** (l'API Calendar del core, `game.time.calendar`/`CalendarData`, non esiste nelle versioni precedenti).
- Se il game system o un altro modulo sostituisce il calendario mondiale (`CONFIG.time.worldCalendarClass`) con uno personalizzato (es. calendari fantasy con mesi e giorni diversi da quello gregoriano), il modulo lo userà automaticamente: mesi, ore/giorno, minuti/ora e secondi/minuto vengono letti dinamicamente dalla configurazione attiva.
- Se in un foglio non esiste una tab "Dettagli" riconoscibile, il blocco viene comunque aggiunto in fondo al form, per garantire che l'opzione sia sempre raggiungibile.
- Il modulo **non** si aggancia ai vecchi fogli `FormApplication` (v1) che alcuni sistemi non ancora aggiornati potrebbero usare al posto di `DocumentSheetV2`; con quei sistemi il blocco potrebbe non comparire.
