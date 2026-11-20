// Copia notícias, páginas e mídia do WordPress atual (API pública) para referencia/
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://a6producoes.com.br/wp-json/wp/v2';
const OUT = path.resolve(import.meta.dirname, '..', 'referencia');
fs.mkdirSync(OUT, { recursive: true });

async function pega(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

const posts = await pega(`${BASE}/posts?per_page=100&_embed=wp:featuredmedia,wp:term`);
const pages = await pega(`${BASE}/pages?per_page=100`);
const cats = await pega(`${BASE}/categories?per_page=100`);

const noticias = posts.map(p => ({
  id: p.id,
  slug: p.slug,
  data: p.date,
  modificado: p.modified,
  titulo: p.title.rendered,
  resumo: p.excerpt.rendered,
  html: p.content.rendered,
  imagem: p._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
  imagemAlt: p._embedded?.['wp:featuredmedia']?.[0]?.alt_text || '',
  categorias: (p.categories || []).map(id => cats.find(c => c.id === id)?.name).filter(Boolean),
  yoast: p.yoast_head_json?.description || null,
  rank: p.rank_math_description || null,
}));

fs.writeFileSync(path.join(OUT, 'noticias.json'), JSON.stringify(noticias, null, 2));
fs.writeFileSync(path.join(OUT, 'paginas.json'), JSON.stringify(pages.map(p => ({ slug: p.slug, titulo: p.title.rendered, html: p.content.rendered, link: p.link })), null, 2));
console.log('noticias', noticias.length, 'com imagem', noticias.filter(n => n.imagem).length, 'paginas', pages.length);
console.log('categorias', cats.map(c => c.name + '(' + c.count + ')').join(', '));
