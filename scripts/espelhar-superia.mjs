// Espelha os sites estáticos do Viva Superia e da imersiva (Vercel) para DENTRO do domínio da A6, sem redirecionamento
// (redirecionamento derruba o "acesso à página" da Meta). Roda no robô do site: mudança nos originais chega sozinha.
//   a6producoes.com.br/vivasuperia/  ← https://vivasuperia-site.vercel.app/
//   a6producoes.com.br/superia-rock/ ← https://superia-gessinger.vercel.app/imersiva
// Formulários seguem iguais (CRM em orafamartinelli.com.br/crm/api/leads aceita qualquer origem; pixel/CAPI no próprio site).
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const DOMINIO = 'https://a6producoes.com.br';
const ESPELHOS = [
  { pagina: 'https://vivasuperia-site.vercel.app/', base: 'https://vivasuperia-site.vercel.app/', destino: 'vivasuperia' },
  { pagina: 'https://superia-gessinger.vercel.app/imersiva', base: 'https://superia-gessinger.vercel.app/', destino: 'superia-rock' },
];
// links entre os sites passam a apontar para dentro do domínio da A6
const TROCAS = [
  [/https:\/\/orafamartinelli\.com\.br\/vivasuperia\/?(?=[?"'#]|$)/g, '/vivasuperia/'],
  [/https:\/\/vivasuperia-site\.vercel\.app\/?(?=[?"'#]|$)/g, '/vivasuperia/'],
  [/https:\/\/superia-gessinger\.vercel\.app\/imersiva\/?(?=[?"'#]|$)/g, '/superia-rock/'],
];

const relativo = r => r && !r.includes('${') && !/^(https?:|\/\/|mailto:|tel:|#|data:|javascript:)/i.test(r) && !r.startsWith('/');
const semQuery = r => r.split(/[?#]/)[0];

async function baixar(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

let total = 0;
for (const e of ESPELHOS) {
  const dir = path.join(RAIZ, 'site', e.destino);
  let html = (await baixar(e.pagina)).toString('utf8');
  const fila = new Set(), feitos = new Set();
  const coletar = (texto, deOnde) => {
    for (const m of texto.matchAll(/(?:src|href)=["']([^"']+)["']/g)) if (relativo(m[1])) fila.add(new URL(semQuery(m[1]), deOnde).href);
    for (const m of texto.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) if (relativo(m[1])) fila.add(new URL(semQuery(m[1]), deOnde).href);
    for (const m of texto.matchAll(/["'`](assets\/[^"'`$\s]+\.(?:jpe?g|png|webp|svg|gif|ico|mp4|webm|avif|woff2?))["'`]/gi)) fila.add(new URL(m[1], e.base).href);
  };
  coletar(html, e.base);
  // baixa tudo o que a página usa (e o que CSS/JS citam)
  while ([...fila].some(u => !feitos.has(u))) {
    for (const u of [...fila]) {
      if (feitos.has(u)) continue;
      feitos.add(u);
      if (!u.startsWith(e.base)) continue;
      const rel = decodeURIComponent(u.slice(e.base.length));
      if (!rel || rel.endsWith('/')) continue;
      const destino = path.join(dir, rel);
      try {
        const buf = await baixar(u);
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        fs.writeFileSync(destino, buf);
        total++;
        if (/\.(css|js)$/i.test(rel)) coletar(buf.toString('utf8'), u);
      } catch (err) { console.log('  falhou', err.message); }
    }
  }
  // ajustes no HTML: endereço canônico no domínio da A6, links internos, sem Vercel Analytics (não existe fora da Vercel)
  const url = `${DOMINIO}/${e.destino}/`;
  for (const [de, para] of TROCAS) html = html.replace(de, para);
  html = html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${url}">`)
    .replace(/(<meta property="og:url" content=")[^"]*/i, `$1${url}`)
    .replace(/<script([^>]*src="rastreio-lp\.js[^"]*")/i, '<script data-vercel-base="off"$1');
  if (!/rel="canonical"/i.test(html)) html = html.replace('</head>', `<link rel="canonical" href="${url}">\n</head>`);
  if (process.argv.includes('--previa')) html = html.replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">');
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  // JS/CSS também podem ter os links absolutos
  for (const f of fs.readdirSync(dir).filter(f => /\.(js|css)$/.test(f))) {
    let t = fs.readFileSync(path.join(dir, f), 'utf8'), o = t;
    for (const [de, para] of TROCAS) t = t.replace(de, para);
    if (t !== o) fs.writeFileSync(path.join(dir, f), t);
  }
  console.log(`espelho /${e.destino}/: ${feitos.size} referências`);
}
console.log('arquivos baixados:', total);
