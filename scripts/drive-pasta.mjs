// Lista a pasta-mãe de um arquivo do Drive (conta rafa@obutiquim) e, com --baixar <pasta>, baixa tudo.
import fs from 'node:fs';
import path from 'node:path';
const DIR = 'C:/Users/User/Documents/projetos/.credentials/';
const c = JSON.parse(fs.readFileSync(DIR + 'google-butiquim-oauth.json', 'utf8'));
const cal = JSON.parse(fs.readFileSync(DIR + 'google-calendar-rafa.json', 'utf8'));
const cid = cal.client_id || cal.installed?.client_id || cal.web?.client_id;
const sec = cal.client_secret || cal.installed?.client_secret || cal.web?.client_secret;
const t = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: cid, client_secret: sec, refresh_token: c.refresh_token, grant_type: 'refresh_token' }) })).json();
const H = { Authorization: 'Bearer ' + t.access_token };
const api = async (p, q) => (await fetch('https://www.googleapis.com/drive/v3/' + p + '?' + new URLSearchParams({ supportsAllDrives: 'true', ...q }), { headers: H })).json();
const arquivoId = process.argv[2];
const f = await api('files/' + arquivoId, { fields: 'id,name,parents,mimeType' });
let pai = f.mimeType?.endsWith('folder') ? f.id : f.parents?.[0];
const info = await api('files/' + pai, { fields: 'id,name,parents,owners(emailAddress)' });
console.log('PASTA:', info.name, pai, 'dono:', info.owners?.[0]?.emailAddress);
async function lista(id, nivel = 0, rel = '') {
  const r = await api('files', { q: `'${id}' in parents and trashed=false`, fields: 'files(id,name,mimeType,size)', pageSize: '200', includeItemsFromAllDrives: 'true' });
  for (const x of r.files || []) {
    const pasta = x.mimeType.endsWith('folder');
    console.log('  '.repeat(nivel + 1) + (pasta ? '[+] ' : '') + x.name + (x.size ? ` (${Math.round(x.size / 1024)} KB)` : ''), x.id);
    if (pasta && nivel < 2) await lista(x.id, nivel + 1, rel + x.name + '/');
    const destino = process.argv[3] === '--baixar' && process.argv[4];
    if (destino && !pasta && !x.mimeType.startsWith('application/vnd.google-apps')) {
      const d = path.join(destino, rel); fs.mkdirSync(d, { recursive: true });
      const b = await fetch(`https://www.googleapis.com/drive/v3/files/${x.id}?alt=media&supportsAllDrives=true`, { headers: H });
      fs.writeFileSync(path.join(d, x.name), Buffer.from(await b.arrayBuffer()));
    }
  }
}
await lista(pai);
