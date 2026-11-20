import fs from 'node:fs';
const pags = JSON.parse(fs.readFileSync(new URL('../referencia/paginas.json', import.meta.url), 'utf8'));
const home = fs.readFileSync(new URL('../referencia/home.html', import.meta.url), 'utf8');
const wa = [...new Set([...home.matchAll(/(?:wa\.me\/|phone=)(\d{10,13})/g)].map(m => m[1]))];
console.log('WHATS na home:', wa, '| instagram:', [...new Set([...home.matchAll(/instagram\.com\/[A-Za-z0-9_.]+/g)].map(m => m[0]))], '| facebook:', [...new Set([...home.matchAll(/facebook\.com\/[A-Za-z0-9_.]+/g)].map(m => m[0]))]);
for (const p of pags) {
  if (p.slug === 'home') continue;
  const txt = p.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(s => s.length > 1);
  const links = [...new Set([...p.html.matchAll(/href="([^"#]+)"/g)].map(m => m[1]))].filter(u => !/wp-content/.test(u));
  const imgs = [...new Set([...p.html.matchAll(/(?:src|url\()"?(https:\/\/a6producoes[^"') ]+\.(?:png|jpe?g|webp))/g)].map(m => m[1]).filter(u => !/-\d+x\d+\./.test(u)))];
  console.log(`\n=== /${p.slug}/ — ${p.titulo}`);
  console.log('TXT:', [...new Set(txt)].join(' | ').slice(0, 1400));
  console.log('LINKS:', links.join(' , ').slice(0, 900));
  console.log('IMGS:', imgs.join(' , ').slice(0, 900));
}
