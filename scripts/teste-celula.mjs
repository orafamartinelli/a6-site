// Teste: escreve um valor numa célula da planilha da agenda. Uso: node scripts/teste-celula.mjs "Agenda!C2" "texto"
import fs from 'node:fs';
import path from 'node:path';
import { g, SHEETS } from './google.mjs';
const drive = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'conteudo', 'drive.json'), 'utf8'));
const [faixa, valor] = process.argv.slice(2);
await g(`${SHEETS}/${drive.planilha}/values/${encodeURIComponent(faixa)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [[valor ?? '']] }) });
console.log('gravado', faixa, '=', JSON.stringify(valor), new Date().toISOString());
