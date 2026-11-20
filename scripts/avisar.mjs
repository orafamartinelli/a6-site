// Avisos do robô no WhatsApp do Rafa (central Z-API).
//  node scripts/avisar.mjs planilha  -> manda os avisos de linha com problema, só quando mudam (guarda em conteudo/avisos-ultimo.txt)
//  node scripts/avisar.mjs falha     -> avisa que o robô falhou
import fs from 'node:fs';
import path from 'node:path';
const RAIZ = path.resolve(import.meta.dirname, '..');
const modo = process.argv[2];
const { ZAPI_INSTANCE_ID: I, ZAPI_TOKEN: T, ZAPI_CLIENT_TOKEN: CT, AVISO_FONE: FONE, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;

async function zap(texto) {
  if (!I || !T || !FONE) { console.log('[sem Z-API] ' + texto); return; }
  const r = await fetch(`https://api.z-api.io/instances/${I}/token/${T}/send-text`, { method: 'POST', headers: { 'Client-Token': CT, 'content-type': 'application/json' }, body: JSON.stringify({ phone: FONE, message: texto }) });
  console.log('zap', r.status);
}

if (modo === 'noticias') {
  const arq = path.join(RAIZ, 'conteudo', 'noticias-novas.json');
  const novas = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : [];
  const base = process.env.SITE_URL || 'https://a6-site-previa.pages.dev';
  if (novas.length) await zap(`📰 *Matéria nova no site da A6* (veio do grupo da imprensa):\n\n${novas.map(n => `• ${n.titulo}\n${base}/${n.slug}/`).join('\n\n')}\n\nSe algo estiver errado, me avise que eu ajusto ou tiro do ar.`);
} else if (modo === 'falha') {
  await zap(`⚠️ *Robô do site A6* falhou agora.\nDetalhes: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`);
} else if (modo === 'planilha') {
  const rel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'conteudo', 'agenda-relatorio.json'), 'utf8'));
  const atual = rel.avisos.join('\n');
  const arq = path.join(RAIZ, 'conteudo', 'avisos-ultimo.txt');
  const antes = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : '';
  if (atual !== antes) {
    fs.writeFileSync(arq, atual);
    if (atual) await zap(`📋 *Planilha da agenda do site A6* — linha(s) com problema:\n\n${rel.avisos.map(a => '• ' + a).join('\n')}\n\nO resto do site foi atualizado normalmente.`);
  }
}
