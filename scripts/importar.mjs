// Importa do WordPress antigo para conteudo/ + site/assets/img (WebP leve).
// Rodar uma vez (ou de novo para atualizar). Não toca no site atual.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const RAIZ = path.resolve(import.meta.dirname, '..');
const FFMPEG = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const TMP = path.join(RAIZ, 'referencia', 'baixados');
const IMG = path.join(RAIZ, 'site', 'assets', 'img');
for (const d of [TMP, path.join(IMG, 'noticias'), path.join(IMG, 'banners'), path.join(RAIZ, 'conteudo')]) fs.mkdirSync(d, { recursive: true });

const ref = f => JSON.parse(fs.readFileSync(path.join(RAIZ, 'referencia', f), 'utf8'));

// tira sufixo -768x513 para pegar o original
const original = u => u.replace(/-\d+x\d+(\.\w+)$/, '$1').replace(/-e\d{10,}(\.\w+)$/, '$1');

async function baixarWebp(url, destinoSemExt, largura = 1200) {
  const destino = destinoSemExt + '.webp';
  if (fs.existsSync(destino)) return destino;
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const tmp = path.join(TMP, crypto.createHash('md5').update(url).digest('hex') + ext);
  if (!fs.existsSync(tmp)) {
    let r = await fetch(url);
    if (!r.ok && url !== original(url)) r = await fetch(original(url));
    if (!r.ok) { console.warn('  falhou', r.status, url); return null; }
    fs.writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  }
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `scale='min(${largura},iw)':-2`, '-q:v', '78', destino]);
  return destino;
}
const rel = p => '/' + path.relative(path.join(RAIZ, 'site'), p).replaceAll('\\', '/');

const limpa = s => s.replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&#8220;|&#8221;/g, '"').replace(/&#8216;|&#8217;/g, '’').replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#8230;/g, '…').trim();
const texto = h => limpa(h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

const noticias = [];
for (const n of ref('noticias.json')) {
  let html = n.html;
  // imagens dentro da matéria
  const imgs = [...new Set([...html.matchAll(/https:\/\/a6producoes\.com\.br\/wp-content\/uploads\/[^"' )\s,]+?\.(?:png|jpe?g|webp|gif)/gi)].map(m => m[0]))];
  const mapa = {};
  for (const u of imgs) {
    const base = path.join(IMG, 'noticias', n.slug.slice(0, 50) + '-' + crypto.createHash('md5').update(original(u)).digest('hex').slice(0, 6));
    const d = await baixarWebp(original(u), base, 1100);
    if (d) mapa[u] = rel(d);
  }
  for (const [de, para] of Object.entries(mapa)) html = html.split(de).join(para);
  // limpa atributos do WP: srcset/sizes/classes wp-image
  html = html.replace(/\s(srcset|sizes)="[^"]*"/g, '').replace(/\sclass="wp-image-\d+"/g, '').replace(/<p>\s*(&nbsp;)?\s*<\/p>/g, '');
  html = html.replace(/<img /g, '<img loading="lazy" decoding="async" ');
  const capa = n.imagem ? await baixarWebp(original(n.imagem), path.join(IMG, 'noticias', n.slug.slice(0, 60) + '-capa'), 1200) : null;
  const resumo = texto(n.resumo).replace(/\[…\]|\[&hellip;\]/g, '').slice(0, 220);
  noticias.push({
    slug: n.slug,
    titulo: limpa(n.titulo),
    data: n.data,
    atualizado: n.modificado,
    resumo,
    descricao: (n.rank || resumo).slice(0, 158),
    capa: capa ? rel(capa) : null,
    capaAlt: n.imagemAlt || limpa(n.titulo),
    categorias: n.categorias.filter(c => c !== 'Uncategorized'),
    autor: 'Wallace Machado — Assessoria de Imprensa A6',
    html,
  });
  process.stdout.write('.');
}
noticias.sort((a, b) => b.data.localeCompare(a.data));
fs.writeFileSync(path.join(RAIZ, 'conteudo', 'noticias.json'), JSON.stringify(noticias, null, 2));
console.log('\nnoticias', noticias.length);

// banners e logo
const banners = {
  'zeze-sunset': 'https://a6producoes.com.br/wp-content/uploads/2026/09/WhatsApp-Image-2026-09-23-at-18.58.40.jpeg',
  'ce-ta-doido': 'https://a6producoes.com.br/wp-content/uploads/2026/08/1120X640_CTD.png',
  'superia-rock': 'https://a6producoes.com.br/wp-content/uploads/2026/10/SUPERIAROCK_1600x900.webp',
  'zeze-sunset-agenda': 'https://a6producoes.com.br/wp-content/uploads/2026/10/44594.webp',
  'camarote-2027': 'https://a6producoes.com.br/wp-content/uploads/2026/05/CAPAS-A6-IMPRENSA.png',
  'lounges': 'https://a6producoes.com.br/wp-content/uploads/2026/01/A6-ASSESSORIA-DE-IMPRENSA-WALLACE-MACHADO-1.jpg',
};
for (const [nome, u] of Object.entries(banners)) console.log(nome, await baixarWebp(u, path.join(IMG, 'banners', nome), 1600));
console.log('logo', await baixarWebp('https://a6producoes.com.br/wp-content/uploads/2025/05/Design-sem-nome-16-768x768.png', path.join(IMG, 'logo-a6'), 400));
// favicon png
const favTmp = path.join(TMP, 'fav.png');
fs.writeFileSync(favTmp, Buffer.from(await (await fetch('https://a6producoes.com.br/wp-content/uploads/2025/05/cropped-Design-sem-nome-16-192x192.png')).arrayBuffer()));
fs.copyFileSync(favTmp, path.join(IMG, 'favicon.png'));
console.log('ok');
