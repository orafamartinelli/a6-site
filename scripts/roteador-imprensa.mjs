// Liga os grupos da imprensa da A6 no raro-zapi-router SEM perder nada do que está no ar.
//   node scripts/roteador-imprensa.mjs ver        → só leitura: baixa o código publicado e lista as ligações
//   node scripts/roteador-imprensa.mjs publicar   → acrescenta o bloco aditivo e publica mantendo TODAS as ligações
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const ACC = '57200dd7ed7c5dfbbd795fdf1956bd36', NAME = 'raro-zapi-router';
const base = `https://api.cloudflare.com/client/v4/accounts/${ACC}/workers/scripts/${NAME}`;
const TOKEN = execSync('node C:/Users/User/Documents/projetos/butiquim-lista/renova-token.mjs', { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
const H = { Authorization: `Bearer ${TOKEN}` };
const GRUPOS = '120363428127134954-group,120363423540446837-group'; // A6 IMPRENSA 📲🚀 · IMPRENSA A6
const BACKUP = 'C:/Users/User/Documents/projetos/a6-site/referencia/raro-zapi-router-no-ar-antes.js';

const settings = await (await fetch(`${base}/settings`, { headers: H })).json();
if (!settings.success) throw new Error(JSON.stringify(settings.errors));
const bindings = settings.result.bindings;
console.log('ligações no ar:', bindings.map(b => `${b.name}(${b.type}${b.service ? '→' + b.service : ''})`).join(', '));

// código publicado (módulo)
const r = await fetch(`${base}/content/v2`, { headers: H });
let codigo = await r.text();
if (!r.ok) throw new Error('content ' + r.status + codigo.slice(0, 200));
if (codigo.startsWith('--')) { // multipart: tira o envelope
  const fronteira = codigo.split(/\r?\n/)[0];
  const parte = codigo.split(fronteira).find(p => p.includes('name="worker.js"'));
  codigo = parte.slice(parte.search(/\r?\n\r?\n/)).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
}
console.log('código no ar:', codigo.length, 'bytes; tem bloco A6?', codigo.includes('A6_IMPRENSA_GROUP_IDS'));
if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, codigo);
const local = fs.readFileSync('C:/Users/User/Documents/projetos/hub_reservas/infra/raro-zapi-router/worker.js', 'utf8');
console.log('cópia local igual ao no ar?', local.trim() === codigo.trim());
if (process.argv[2] !== 'publicar') process.exit(0);

const ANCORA = "    if (body && body.isGroup === true && body.fromMe !== true) {\n      ctx.waitUntil(repassarRadar(env, raw));\n    }\n";
if (!codigo.includes('A6_IMPRENSA_GROUP_IDS')) {
  if (!codigo.includes(ANCORA)) throw new Error('âncora do Radar não encontrada — não publico às cegas');
  codigo = codigo.replace(ANCORA, ANCORA +
`    // Site A6 (Homer, 20/11/2026): grupos da imprensa da A6 → vigia a6-site-robo /noticia (matéria do Wallace vira
    // notícia no site). ADITIVO: não dá return, o grupo segue o caminho de sempre. Rollback: apagar este bloco.
    if (
      body && body.isGroup === true && body.fromMe !== true && env.A6_ROBO && env.A6_DISPARO_KEY &&
      parseIds(env.A6_IMPRENSA_GROUP_IDS).has(body.phone)
    ) {
      ctx.waitUntil(env.A6_ROBO.fetch('https://a6-site-robo/noticia?key=' + env.A6_DISPARO_KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw }).catch(() => {}));
    }
`);
}
const cofre = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/a6-site-robo.json', 'utf8'));
const s = await (await fetch(`${base}/secrets`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A6_DISPARO_KEY', text: cofre.a6_disparo_key, type: 'secret_text' }) })).json();
if (!s.success) throw new Error('secret ' + JSON.stringify(s.errors));

const manter = bindings.filter(b => b.type !== 'secret_text' && b.name !== 'A6_ROBO' && b.name !== 'A6_IMPRENSA_GROUP_IDS');
const novas = [...manter, { type: 'service', name: 'A6_ROBO', service: 'a6-site-robo' }, { type: 'plain_text', name: 'A6_IMPRENSA_GROUP_IDS', text: GRUPOS }];
const metadata = { main_module: 'worker.js', compatibility_date: settings.result.compatibility_date || '2024-11-01', compatibility_flags: settings.result.compatibility_flags || [], bindings: novas, keep_bindings: ['secret_text'] };
const fd = new FormData();
fd.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
fd.append('worker.js', new Blob([codigo], { type: 'application/javascript+module' }), 'worker.js');
const put = await (await fetch(base, { method: 'PUT', headers: H, body: fd })).json();
console.log(put.success ? 'roteador publicado ✓' : 'ERRO ' + JSON.stringify(put.errors));
const depois = await (await fetch(`${base}/settings`, { headers: H })).json();
console.log('ligações depois:', depois.result.bindings.map(b => `${b.name}(${b.type})`).join(', '));
