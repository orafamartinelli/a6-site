// Escreve na aba Leia-me o link "Atualizar o site agora" (com a chave do cofre, sem passar pelo terminal).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const k = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/a6-site-robo.json', 'utf8')).link_key;
const f = `=HYPERLINK("https://a6-site-robo.rafa-572.workers.dev/atualizar?k=${k}";"👉 Atualizar o site agora (fica pronto em ~2 min)")`;
execFileSync('node', [new URL('./teste-celula.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), 'Leia-me!A12', f, '--formula'], { stdio: 'inherit' });
execFileSync('node', [new URL('./teste-celula.mjs', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'), 'Leia-me!A11', 'Sem paciência? Depois de preencher, clique abaixo:'], { stdio: 'inherit' });
