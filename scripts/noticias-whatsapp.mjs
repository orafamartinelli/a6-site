// Busca no vigia (a6-site-robo) as matérias que o Wallace mandou no grupo da imprensa e cria as notícias do site.
// Precisa de NOTICIAS_URL (ex.: https://a6-site-robo.rafa-572.workers.dev) e A6_DISPARO_KEY.
// Grava conteudo/noticias.json (+ capa WebP) e conteudo/noticias-novas.json (para o aviso com o link).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const { NOTICIAS_URL: URL_ROBO, A6_DISPARO_KEY: KEY } = process.env;
const RAIZ = path.resolve(import.meta.dirname, '..');
const NOVAS = path.join(RAIZ, 'conteudo', 'noticias-novas.json');
fs.writeFileSync(NOVAS, '[]');
if (!URL_ROBO || !KEY) { console.log('robô de notícias ainda não ligado'); process.exit(0); }

const pend = await (await fetch(`${URL_ROBO}/pendentes?key=${KEY}`)).json();
if (!pend.length) { console.log('nenhuma matéria nova'); process.exit(0); }

const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugDe = s => { const t = semAcento(s).toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); return t.length <= 90 ? t : t.slice(0, 90).replace(/-[^-]*$/, ''); };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// formatação do WhatsApp → HTML (*negrito*, _itálico_)
const fmt = s => esc(s).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1<em>$2</em>');

const arq = path.join(RAIZ, 'conteudo', 'noticias.json');
const noticias = JSON.parse(fs.readFileSync(arq, 'utf8'));
const feitas = [], novas = [];
for (const p of pend.sort((a, b) => a.recebidoEm.localeCompare(b.recebidoEm))) {
  const linhas = p.texto.split(/\n/).map(l => l.trim()).filter(Boolean);
  let titulo = linhas.shift().replace(/^\*|\*$/g, '').replace(/[*_]/g, '').trim();
  if (titulo.length > 140) { // 1ª linha é parágrafo: título = 1ª frase
    const frase = titulo.match(/^(.{20,140}?[.!?])\s/);
    linhas.unshift(titulo); titulo = frase ? frase[1].replace(/[.]$/, '') : titulo.slice(0, 110) + '…';
  }
  let slug = slugDe(titulo) || 'noticia-' + Date.now();
  while (noticias.some(n => n.slug === slug)) slug += '-2';
  // capa
  let capa = null;
  try {
    const buf = Buffer.from(await (await fetch(p.capa)).arrayBuffer());
    const destino = path.join(RAIZ, 'site', 'assets', 'img', 'noticias', `${slug.slice(0, 60)}-capa.webp`);
    await sharp(buf).rotate().resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(destino);
    capa = '/' + path.relative(path.join(RAIZ, 'site'), destino).replaceAll('\\', '/');
  } catch (e) { console.log('capa falhou', e.message); }
  const html = linhas.map(l => `<p>${fmt(l)}</p>`).join('\n');
  const resumo = linhas.join(' ').replace(/[*_]/g, '').slice(0, 220);
  const agora = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19); // horário de Brasília, como no WP
  noticias.unshift({ slug, titulo, data: agora, atualizado: agora, resumo, descricao: resumo.slice(0, 158), capa, capaAlt: titulo, categorias: [], autor: 'Wallace Machado — Assessoria de Imprensa A6', html, origem: 'whatsapp', messageId: p.messageId });
  feitas.push(p.id); novas.push({ slug, titulo });
  console.log('matéria criada:', slug);
}
fs.writeFileSync(arq, JSON.stringify(noticias, null, 2));
fs.writeFileSync(NOVAS, JSON.stringify(novas, null, 2));
await fetch(`${URL_ROBO}/confirmar?key=${KEY}`, { method: 'POST', body: JSON.stringify(feitas) });
