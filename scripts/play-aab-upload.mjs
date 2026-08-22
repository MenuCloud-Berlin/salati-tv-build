// AAB in die Play-Tracks (Play Developer API). Listing/Grafiken/Fragebögen
// sind schon fertig → hier nur Bundle-Upload + Track-Releases (completed).
//
// Es werden BEIDE Tracks gehoben: internal UND production. Bis 1.2.0 hob das
// Skript nur `internal` — bei Nutzern kam damit nichts an, der Produktions-
// Track blieb auf dem alten versionCode stehen und das fiel erst beim
// Nachsehen in der Console auf.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';
// Pfad zum AAB als Argument. Stand bis 2026-07-29 fest verdrahtet auf eine
// Datei im Zwischenspeicher einer alten Sitzung — dadurch ging zweimal ein
// veraltetes Bundle (versionCode 1) hoch, waehrend Play korrekt ablehnte
// ("Version code 1 has already been used") und der Fehler beim Build gesucht
// wurde. Ohne Argument bricht der Lauf jetzt ab, statt etwas Falsches zu senden.
const AAB = process.argv[2];
if (!AAB) {
  console.error('Aufruf: node scripts/play-aab-upload.mjs <pfad/zur/app-release.aab> [notes.json]');
  process.exit(1);
}
if (!fs.existsSync(AAB)) {
  console.error(`AAB nicht gefunden: ${AAB}`);
  process.exit(1);
}

// Release-Notizen als UTF-8-DATEI { "de-DE": "…", "en-US": "…", … }. Bewusst
// nicht als Kommandozeilen-Argument: die Windows-Shell schreibt Umlaute darin
// um ("nördlichen" -> "noerdlichen"), und genau so standen sie schon einmal
// bei den Nutzern. Ohne Datei bleiben die Notizen der Vorversion stehen.
const NOTES_PATH = process.argv[3];
let releaseNotes;
if (NOTES_PATH) {
  if (!fs.existsSync(NOTES_PATH)) {
    console.error(`Notizen-Datei nicht gefunden: ${NOTES_PATH}`);
    process.exit(1);
  }
  const map = JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
  releaseNotes = Object.entries(map).map(([language, text]) => ({ language, text: String(text).slice(0, 500) }));
  console.log('Release-Notizen fuer:', releaseNotes.map((r) => r.language).join(', '));
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    sa.private_key, { algorithm: 'RS256' });
  const r = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })).json();
  if (!r.access_token) throw new Error('token: ' + JSON.stringify(r));
  return r.access_token;
}
const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UP = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
let TOK;
async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = { raw: t }; }
  return { ok: r.ok, status: r.status, j };
}

TOK = await token();
console.log('auth ok');
const e = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
if (!e.ok) throw new Error('edit: ' + e.status + ' ' + JSON.stringify(e.j));
const editId = e.j.id;
console.log('edit', editId);

const bytes = fs.readFileSync(AAB);
console.log('Bundle-Upload', (bytes.length / 1e6).toFixed(1), 'MB ...');
const up = await api(`${UP}/edits/${editId}/bundles?uploadType=media`, {
  method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes,
});
if (!up.ok) { console.error('Bundle FEHLER:', up.status, JSON.stringify(up.j).slice(0, 500)); process.exit(1); }
const vc = up.j.versionCode;
console.log('Bundle OK, versionCode', vc);

// Beide Tracks auf denselben versionCode heben. `production` zuerst zu
// vergessen war der Fehler bis 1.2.0 — deshalb steht er hier fest in der
// Liste und nicht hinter einer Option.
let fehler = 0;
for (const track of ['internal', 'production']) {
  const release = { status: 'completed', versionCodes: [String(vc)] };
  if (releaseNotes) release.releaseNotes = releaseNotes;
  const tr = await api(`${BASE}/edits/${editId}/tracks/${track}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track, releases: [release] }),
  });
  console.log(`Track ${track}:`, tr.ok ? 'OK' : 'FEHLER ' + tr.status + ' ' + JSON.stringify(tr.j).slice(0, 400));
  if (!tr.ok) fehler += 1;
}
if (fehler) { console.error('Mindestens ein Track fehlgeschlagen — es wird NICHT committet.'); process.exit(1); }

// Solange eine Ablehnung offen ist (2026-08-09 bei vc12 der Fall), weist Play
// einen Commit ab, der die Aenderung gleich zur Pruefung schicken will. Dann
// committen wir ohne Pruefungsanstoss; das Einreichen selbst geht danach nur
// ueber die Console.
let c = await api(`${BASE}/edits/${editId}:commit`, { method: 'POST' });
let manuell = false;
if (!c.ok && JSON.stringify(c.j ?? '').includes('changesNotSentForReview')) {
  c = await api(`${BASE}/edits/${editId}:commit?changesNotSentForReview=true`, { method: 'POST' });
  manuell = c.ok;
}
console.log('COMMIT:', c.ok ? 'OK — AAB in internal UND production' : 'FEHLER ' + c.status + ' ' + JSON.stringify(c.j).slice(0, 600));
if (manuell) {
  console.log('HINWEIS: nicht zur Pruefung geschickt. In der Play Console unter');
  console.log('         „Veroeffentlichungsuebersicht" die Aenderungen einreichen.');
}
if (!c.ok) process.exit(1);
