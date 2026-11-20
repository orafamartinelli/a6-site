// Remove um show cancelado: apaga a linha da planilha (pelo nome do evento), tira do histórico e apaga a página/banners.
// Uso: node scripts/remover-show.mjs "Superia Rock" superia-rock-humberto-gessinger-foz-do-iguacu
import fs from 'node:fs';
import path from 'node:path';
import { g, SHEETS } from './google.mjs';
const RAIZ = path.resolve(import.meta.dirname, '..');
const [nome, id] = process.argv.slice(2);
const drive = JSON.parse(fs.readFileSync(path.join(RAIZ, 'conteudo', 'drive.json'), 'utf8'));
const info = await g(`${SHEETS}/${drive.planilha}?fields=sheets.properties`);
const aba = info.sheets.find(s => s.properties.title === 'Agenda').properties.sheetId;
const vals = (await g(`${SHEETS}/${drive.planilha}/values/Agenda!A1:A300`)).values || [];
const linha = vals.findIndex(v => (v[0] || '').toLowerCase().includes(nome.toLowerCase()));
if (linha > 0) {
  await g(`${SHEETS}/${drive.planilha}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: aba, dimension: 'ROWS', startIndex: linha, endIndex: linha + 1 } } }] }) });
  console.log('linha apagada da planilha:', linha + 1, vals[linha][0]);
} else console.log('não achei na planilha:', nome);
const hist = path.join(RAIZ, 'conteudo', 'eventos-historico.json');
const h = JSON.parse(fs.readFileSync(hist, 'utf8'));
if (h[id]) { delete h[id]; fs.writeFileSync(hist, JSON.stringify(h, null, 2)); console.log('tirado do histórico:', id); }
for (const p of [path.join(RAIZ, 'site', 'eventos', id)]) if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true }); console.log('página apagada'); }
for (const f of fs.readdirSync(path.join(RAIZ, 'site', 'assets', 'img', 'eventos'))) if (f.startsWith(id)) fs.rmSync(path.join(RAIZ, 'site', 'assets', 'img', 'eventos', f));
