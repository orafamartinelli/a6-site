// Procura logos da A6 no Google Drive (inclusive "compartilhados comigo") com os OAuth do cofre.
import fs from 'node:fs';
const DIR = 'C:/Users/User/Documents/projetos/.credentials/';
const candidatos = ['google-pessoal-oauth.json', 'google-drive-dre-oauth.json', 'google-butiquim-oauth.json', 'google-raro-navegador.json', 'google-pessoal-navegador.json'];
const q = process.argv[2] || "(name contains 'A6' or name contains 'a6') and (mimeType contains 'image/' or mimeType='application/pdf' or mimeType='application/postscript' or mimeType='application/vnd.google-apps.folder' or name contains '.ai' or name contains '.svg' or name contains '.cdr') and trashed=false";
for (const f of candidatos) {
  if (!fs.existsSync(DIR + f)) continue;
  const c = JSON.parse(fs.readFileSync(DIR + f, 'utf8'));
  const cal = JSON.parse(fs.readFileSync(DIR + 'google-calendar-rafa.json', 'utf8'));
  const cid = c.client_id || cal.client_id || cal.installed?.client_id || cal.web?.client_id;
  const sec = c.client_secret || cal.client_secret || cal.installed?.client_secret || cal.web?.client_secret;
  const rt = c.refresh_token || c.tokens?.refresh_token;
  if (!cid || !sec || !rt) { console.log(f, '-> sem refresh_token/client'); continue; }
  const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: cid, client_secret: sec, refresh_token: rt, grant_type: 'refresh_token' }) })).json();
  if (!t.access_token) { console.log(f, '-> token falhou', t.error); continue; }
  const u = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q, pageSize: '100', fields: 'files(id,name,mimeType,size,parents,owners(emailAddress),webViewLink)', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives' });
  const r = await (await fetch(u, { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
  if (r.error) { console.log(f, '-> drive erro', r.error.code, r.error.message?.slice(0, 80)); continue; }
  console.log(`\n== ${f} (${c.email || c.account || ''}): ${r.files.length} itens`);
  for (const x of r.files) console.log(x.mimeType.split('/').pop().slice(0, 22).padEnd(22), (x.size || '').toString().padStart(9), x.id, x.name);
}
