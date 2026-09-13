/**
 * Creation Date Tracker
 * ---------------------
 * Aggiunge, alla scheda "Dettagli" di qualsiasi documento con un foglio
 * basato su DocumentSheetV2 (Attori, Oggetti, Scene, Journal, Macro,
 * RollTable, Cards, Playlist, Combattenti, Tile, Wall, ecc.), un blocco
 * che permette di impostare e visualizzare una "data di creazione"
 * calcolata tramite il calendario del game system attivo
 * (foundry.data.CalendarData / game.time.calendar, API Foundry v13+).
 *
 * I dati vengono salvati come flag sul documento stesso:
 *   flags["creation-date-tracker"].time        -> worldTime (secondi) assoluto
 *   flags["creation-date-tracker"].components  -> ultimi componenti usati (debug/riedit)
 */

const MODULE_ID = "creation-date-tracker";

/* -------------------------------------------- */
/*  Hook di inizializzazione                     */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inizializzazione`);
});

/**
 * DocumentSheetV2 è la classe base di tutti i fogli documento "moderni" di
 * Foundry (Actor, Item, Scene, JournalEntry, Macro, RollTable, Cards,
 * Playlist, Combatant, Tile, Wall, AmbientLight/Sound, Region, ecc.).
 * Ogni classe figlia, nella propria catena di ereditarietà, richiama anche
 * gli hook delle classi "antenate" fino a BASE_APPLICATION: per questo
 * l'hook generico "renderDocumentSheetV2" scatta per (quasi) ogni foglio
 * documento del gioco, indipendentemente dal game system usato.
 */
Hooks.on("renderDocumentSheetV2", (app, element) => {
  try {
    injectCreationDateUI(app, element);
  } catch (err) {
    console.error(`${MODULE_ID} | Errore durante l'iniezione della UI:`, err);
  }
});

/* -------------------------------------------- */
/*  Iniezione della UI nel foglio documento      */
/* -------------------------------------------- */

/**
 * @param {foundry.applications.api.DocumentSheetV2} app
 * @param {HTMLElement} root
 */
function injectCreationDateUI(app, root) {
  const doc = app.document;
  if (!doc) return;

  // Evita doppie iniezioni sullo stesso render
  if (root.querySelector(".cdt-creation-date-block")) return;

  const container = findInjectionTarget(root);
  if (!container) return;

  const canEdit = !!(doc.isOwner || game.user.isGM);
  const block = buildBlock(doc, canEdit);
  container.appendChild(block);
}

/**
 * Cerca il punto migliore in cui inserire il blocco: preferibilmente la
 * tab "Dettagli" del foglio (pattern comune a molti game system), in
 * alternativa il form principale o il contenuto della finestra.
 * @param {HTMLElement} root
 * @returns {HTMLElement|null}
 */
function findInjectionTarget(root) {
  return (
    root.querySelector('[data-tab="details"]') ||
    root.querySelector(".tab.details") ||
    root.querySelector('.tab[data-tab="description"]') ||
    root.querySelector("form") ||
    root.querySelector(".window-content") ||
    root
  );
}

/* -------------------------------------------- */
/*  Helper Calendario                            */
/* -------------------------------------------- */

/** @returns {foundry.data.CalendarData|null} */
function getCalendar() {
  return game.time?.calendar ?? null;
}

/** @param {ClientDocument} doc */
function getStoredTime(doc) {
  return doc.getFlag(MODULE_ID, "time");
}

/**
 * Formatta un worldTime tramite il calendario attivo, se disponibile.
 * @param {number|null|undefined} time
 * @returns {string|null}
 */
function formatTime(time) {
  if (time === undefined || time === null) return null;
  const calendar = getCalendar();
  if (!calendar) return String(time);
  try {
    return calendar.format(time, "timestamp");
  } catch (err) {
    console.warn(`${MODULE_ID} | Impossibile formattare la data con il calendario attivo:`, err);
    return String(time);
  }
}

/* -------------------------------------------- */
/*  Costruzione del blocco UI                    */
/* -------------------------------------------- */

/**
 * @param {ClientDocument} doc
 * @param {boolean} canEdit
 * @returns {HTMLElement}
 */
function buildBlock(doc, canEdit) {
  const time = getStoredTime(doc);
  const formatted = formatTime(time);
  const hasValue = time !== undefined && time !== null;

  const fieldset = document.createElement("fieldset");
  fieldset.classList.add("cdt-creation-date-block");

  const legend = document.createElement("legend");
  legend.textContent = game.i18n.localize("CDT.Legend");
  fieldset.appendChild(legend);

  const row = document.createElement("div");
  row.classList.add("cdt-row");

  const valueSpan = document.createElement("span");
  valueSpan.classList.add("cdt-value");
  valueSpan.textContent = formatted ?? game.i18n.localize("CDT.NotSet");
  row.appendChild(valueSpan);

  if (canEdit) {
    row.appendChild(buildButtons(doc, hasValue));
  }

  fieldset.appendChild(row);
  return fieldset;
}

/**
 * @param {ClientDocument} doc
 * @param {boolean} hasValue
 * @returns {HTMLElement}
 */
function buildButtons(doc, hasValue) {
  const wrap = document.createElement("div");
  wrap.classList.add("cdt-buttons");

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.classList.add("cdt-edit-btn");
  editBtn.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${game.i18n.localize(
    hasValue ? "CDT.Edit" : "CDT.Set"
  )}`;
  editBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    openDateDialog(doc);
  });
  wrap.appendChild(editBtn);

  const nowBtn = document.createElement("button");
  nowBtn.type = "button";
  nowBtn.classList.add("cdt-now-btn");
  nowBtn.innerHTML = `<i class="fa-solid fa-clock"></i> ${game.i18n.localize("CDT.UseNow")}`;
  nowBtn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    await applyTime(doc, game.time?.worldTime ?? 0, null);
  });
  wrap.appendChild(nowBtn);

  if (hasValue) {
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.classList.add("cdt-clear-btn");
    clearBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${game.i18n.localize("CDT.Clear")}`;
    clearBtn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await doc.unsetFlag(MODULE_ID, "time");
      await doc.unsetFlag(MODULE_ID, "components");
      refreshSheet(doc);
    });
    wrap.appendChild(clearBtn);
  }

  return wrap;
}

/**
 * Salva il nuovo worldTime (e opzionalmente i componenti) sul documento.
 * @param {ClientDocument} doc
 * @param {number} time
 * @param {object|null} components
 */
async function applyTime(doc, time, components) {
  await doc.setFlag(MODULE_ID, "time", time);
  if (components) await doc.setFlag(MODULE_ID, "components", components);
  refreshSheet(doc);
}

/** Ridisegna il foglio, se aperto (di norma già gestito da Foundry sugli update, ma per sicurezza). */
function refreshSheet(doc) {
  try {
    if (doc.sheet?.rendered) doc.sheet.render();
  } catch (err) {
    // non bloccante
  }
}

/* -------------------------------------------- */
/*  Dialogo di impostazione data                 */
/* -------------------------------------------- */

/**
 * Apre un dialogo (DialogV2) per impostare la data di creazione tramite
 * il calendario del game system attivo.
 * @param {ClientDocument} doc
 */
async function openDateDialog(doc) {
  const calendar = getCalendar();
  const stored = getStoredTime(doc);
  const base = stored ?? game.time?.worldTime ?? 0;
  const components = calendar ? calendar.timeToComponents(base) : null;

  const hasMonths = !!calendar?.months?.values?.length;
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;

  const year = components?.year ?? 0;
  const monthIdx = components?.month ?? 0;
  const dayOfMonth = components?.dayOfMonth ?? 0;
  const dayOfYear = components?.day ?? 0;
  const hour = components?.hour ?? 0;
  const minute = components?.minute ?? 0;
  const second = components?.second ?? 0;

  let monthField = "";
  let dayField = "";

  if (hasMonths) {
    const options = calendar.months.values
      .map(
        (m, idx) =>
          `<option value="${idx}" ${idx === monthIdx ? "selected" : ""}>${foundry.utils.escapeHTML(
            m.name
          )}</option>`
      )
      .join("");
    monthField = `
      <div class="form-group">
        <label>${game.i18n.localize("CDT.Month")}</label>
        <select name="month">${options}</select>
      </div>`;
    dayField = `
      <div class="form-group">
        <label>${game.i18n.localize("CDT.Day")}</label>
        <input type="number" name="dayOfMonth" value="${dayOfMonth + 1}" min="1" step="1"/>
      </div>`;
  } else {
    dayField = `
      <div class="form-group">
        <label>${game.i18n.localize("CDT.DayOfYear")}</label>
        <input type="number" name="day" value="${dayOfYear + 1}" min="1" step="1"/>
      </div>`;
  }

  const content = `
    <form class="cdt-dialog-form">
      <div class="form-group">
        <label>${game.i18n.localize("CDT.Year")}</label>
        <input type="number" name="year" value="${year}" step="1"/>
      </div>
      ${monthField}
      ${dayField}
      <div class="form-group cdt-time-row">
        <label>${game.i18n.localize("CDT.Hour")}</label>
        <input type="number" name="hour" value="${hour}" min="0" max="${hoursPerDay - 1}" step="1"/>
        <label>${game.i18n.localize("CDT.Minute")}</label>
        <input type="number" name="minute" value="${minute}" min="0" max="${minutesPerHour - 1}" step="1"/>
        <label>${game.i18n.localize("CDT.Second")}</label>
        <input type="number" name="second" value="${second}" min="0" max="${secondsPerMinute - 1}" step="1"/>
      </div>
      ${!calendar ? `<p class="notes">${game.i18n.localize("CDT.NoCalendarWarning")}</p>` : ""}
    </form>`;

  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize("CDT.DialogTitle") },
    content,
    buttons: [
      {
        action: "save",
        label: game.i18n.localize("CDT.Save"),
        icon: "fa-solid fa-check",
        default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      {
        action: "cancel",
        label: game.i18n.localize("CDT.Cancel"),
        icon: "fa-solid fa-xmark"
      }
    ],
    rejectClose: false
  });

  if (!result || result === "cancel") return;

  const newComponents = {
    year: Number(result.year) || 0,
    hour: Number(result.hour) || 0,
    minute: Number(result.minute) || 0,
    second: Number(result.second) || 0
  };
  if (hasMonths) {
    newComponents.month = Number(result.month) || 0;
    newComponents.dayOfMonth = Math.max(0, (Number(result.dayOfMonth) || 1) - 1);
  } else {
    newComponents.day = Math.max(0, (Number(result.day) || 1) - 1);
  }

  let newTime;
  if (calendar) {
    try {
      newTime = calendar.componentsToTime(newComponents);
    } catch (err) {
      console.error(`${MODULE_ID} | Errore di conversione componenti->tempo:`, err);
      ui.notifications.error(game.i18n.localize("CDT.ConversionError"));
      return;
    }
  } else {
    // Nessun calendario disponibile (non dovrebbe accadere su Foundry v13+):
    // fallback grezzo, lineare, solo per non perdere completamente il dato.
    newTime =
      (newComponents.year * 365 + (newComponents.day ?? 0)) * 86400 +
      newComponents.hour * 3600 +
      newComponents.minute * 60 +
      newComponents.second;
  }

  await applyTime(doc, newTime, newComponents);
