// Gera o site estático da A6 em site/ a partir de conteudo/*.json.
// Uso: node scripts/gerar.mjs            (produção: indexável)
//      node scripts/gerar.mjs --previa   (prévia: noindex + faixa amarela)
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SITE = path.join(RAIZ, 'site');
const PREVIA = process.argv.includes('--previa');
const ler = f => JSON.parse(fs.readFileSync(path.join(RAIZ, 'conteudo', f), 'utf8'));
const cfg = ler('site.json');
const agenda = ler('agenda.json');
const noticias = ler('noticias.json');
const D = cfg.dominio;
const AGORA = Date.now();
const VERSAO = Date.now().toString(36);

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const diaMes = iso => { const [a, m, d] = iso.slice(0, 10).split('-'); return { d: +d, m: MESES[+m - 1], ml: MESES_L[+m - 1], a }; };
const dataLonga = iso => { const x = diaMes(iso); return `${x.d} de ${x.ml} de ${x.a}`; };
const comUtm = (link, campanha) => {
  const u = new URL(link);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith('utm_')) u.searchParams.delete(k);
  u.searchParams.set('utm_source', 'site_a6'); u.searchParams.set('utm_medium', 'site'); u.searchParams.set('utm_campaign', campanha);
  return u.toString();
};
const vivo = it => Date.parse(it.sai) > AGORA; // expirado nem entra no HTML; futuros entram e o JS segura até a hora
const eventos = agenda.eventos.filter(vivo).sort((a, b) => a.data.localeCompare(b.data));
const botoes = agenda.botoes.filter(vivo);

const MENU = [
  ['/', 'Home'], ['/programacao-e-ingressos/', 'Agenda'], ['/imprensa/', 'Notícias'],
  ['/camarote-a6/', 'Camarote A6'], ['/sobre/', 'A empresa'], ['/contato/', 'Contato'],
];

function layout({ titulo, descricao, caminho, corpo, og, jsonld = [], tipo = 'website' }) {
  const url = D + caminho;
  const imagem = D + (og || '/assets/img/banners/zeze-sunset.webp');
  const ld = [{
    '@context': 'https://schema.org', '@type': 'Organization', name: cfg.nome, url: D, logo: D + '/assets/img/logo-a6.png',
    address: { '@type': 'PostalAddress', streetAddress: 'R. Santos Dumont, 3317, Sala 1304 - Zona 01', addressLocality: 'Maringá', addressRegion: 'PR', postalCode: '87013-050', addressCountry: 'BR' },
    email: cfg.email, sameAs: [cfg.youtube, cfg.instagram, cfg.facebook].filter(Boolean),
  }, ...jsonld];
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
${PREVIA ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<link rel="canonical" href="${url}">
<meta property="og:type" content="${tipo}">
<meta property="og:site_name" content="${esc(cfg.nome)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${imagem}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#321166">
<link rel="icon" href="/assets/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=Space+Grotesk:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=${VERSAO}">
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
<!-- MEDICAO: GA4 + pixel entram na publicação oficial (prévia não mede) -->
</head>
<body>
<a class="pular" href="#conteudo">Ir para o conteúdo</a>
${PREVIA ? '<div class="previa">PRÉVIA do novo site da A6 — não é o site oficial</div>' : ''}
<header class="topo"><div class="cx"><div class="barra">
<a class="logo" href="/" aria-label="A6 Produções — início"><img src="/assets/img/logo-a6.png" alt="A6 Produções" width="260" height="172"></a>
<button class="hamb" aria-label="Abrir menu" aria-expanded="false">☰</button>
<nav aria-label="Principal"><ul class="menu">
${MENU.map(([h, t]) => `<li><a href="${h}"${h === caminho ? ' aria-current="page"' : ''}>${t}</a></li>`).join('\n')}
</ul></nav>
</div></div></header>
<main id="conteudo">
${corpo}
</main>
<footer class="rodape"><div class="cx">
<div><img src="/assets/img/logo-a6.png" alt="A6 Produções" width="90" height="60" style="width:90px;margin-bottom:14px" loading="lazy">
<p>${esc(cfg.slogan)}</p><p>${esc(cfg.endereco)}</p></div>
<div><h4>Navegue</h4><ul>${MENU.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}</ul></div>
<div><h4>Fale com a A6</h4><ul>
<li><a href="mailto:${cfg.email}">${cfg.email}</a></li>
<li>Imprensa: <a href="mailto:${cfg.imprensa.email}">${cfg.imprensa.email}</a></li>
<li><a href="${cfg.youtube}" target="_blank" rel="noopener">YouTube</a></li>
${cfg.instagram ? `<li><a href="${cfg.instagram}" target="_blank" rel="noopener">Instagram</a></li>` : ''}
${cfg.facebook ? `<li><a href="${cfg.facebook}" target="_blank" rel="noopener">Facebook</a></li>` : ''}
</ul></div>
<div class="fim">© ${new Date().getFullYear()} ${esc(cfg.nome)} — Maringá/PR · CNPJ ${cfg.cnpj} · ${esc(cfg.razao)}</div>
</div></footer>
<script src="/assets/js/site.js?v=${VERSAO}" defer></script>
</body>
</html>`;
}

const janela = it => `data-entra="${esc(it.entra)}" data-sai="${esc(it.sai)}"`;

function cardEvento(e) {
  const x = diaMes(e.data);
  return `<article class="evento" ${janela(e)}>
<a class="img" href="${esc(comUtm(e.link, e.id))}" target="_blank" rel="noopener"><img src="${e.banner}" alt="${esc(e.titulo)} — ${esc(e.cidade)}" loading="lazy" width="1120" height="640">
<span class="data"><b>${x.d}</b><span>${x.m}</span></span></a>
<div class="corpo"><h3>${esc(e.titulo)}</h3>
${e.subtitulo ? `<div>${esc(e.subtitulo)}</div>` : ''}
<div class="onde">📍 ${esc(e.local)} · ${x.d} de ${x.ml}</div>
<a class="bt peq" href="${esc(comUtm(e.link, e.id))}" target="_blank" rel="noopener">${esc(e.botao || 'Compre seu ingresso')}</a></div>
</article>`;
}
const blocoAgenda = () => `<div class="agenda" data-lista-agenda>${eventos.map(cardEvento).join('\n')}</div>
<div class="vazio" hidden>Novas datas em breve. Acompanhe as notícias da A6.</div>`;

const jsonldEventos = () => eventos.map(e => ({
  '@context': 'https://schema.org', '@type': 'Event', name: e.titulo, startDate: e.data,
  eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  location: { '@type': 'Place', name: e.local, address: { '@type': 'PostalAddress', addressLocality: e.cidade.split('/')[0], addressRegion: 'PR', addressCountry: 'BR' } },
  image: [D + e.banner], organizer: { '@type': 'Organization', name: cfg.nome, url: D },
  offers: { '@type': 'Offer', url: e.link, availability: 'https://schema.org/InStock' },
}));

function cardNoticia(n, oculto = false) {
  return `<a class="card" href="/${n.slug}/"${oculto ? ' hidden' : ''}>
<div class="img">${n.capa ? `<img src="${n.capa}" alt="${esc(n.capaAlt)}" loading="lazy">` : ''}</div>
<div class="corpo"><time datetime="${n.data}">${dataLonga(n.data)}</time><h3>${esc(n.titulo)}</h3></div></a>`;
}

const paginas = [];
const grava = (caminho, html) => {
  const dest = path.join(SITE, caminho, caminho.endsWith('.html') ? '' : 'index.html');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  if (!caminho.endsWith('.html')) paginas.push(caminho);
};

// HOME
const slides = eventos.filter(e => e.carrossel);
grava('/', layout({
  titulo: `${cfg.nome} — ${cfg.slogan}`, descricao: cfg.descricao, caminho: '/', jsonld: jsonldEventos(),
  corpo: `
<section class="carrossel" aria-label="Destaques">
<div class="trilho">${slides.map((e, i) => `<a class="slide" ${janela(e)} href="${esc(comUtm(e.link, e.id + '_banner'))}" target="_blank" rel="noopener">
<img src="${e.banner}" alt="${esc(e.titulo)} — ${esc(e.cidade)}" width="1120" height="640" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
<span class="selo">${diaMes(e.data).d} de ${diaMes(e.data).ml} · ${esc(e.cidade)}</span></a>`).join('\n')}</div>
<div class="setas"><button class="ant" aria-label="Anterior">‹</button><button class="prox" aria-label="Próximo">›</button></div>
<div class="pontos"></div>
</section>
<section class="faixa"><div class="cx">
<h1>${esc(cfg.slogan)}</h1>
<div class="botoes"><a class="bt" href="/programacao-e-ingressos/">Compre seu ingresso!</a>
${botoes.map(b => `<a class="bt ${b.cor || ''}" ${janela(b)} href="${esc(comUtm(b.link, b.id))}" target="_blank" rel="noopener">${esc(b.texto)}</a>`).join('\n')}</div>
</div></section>
<section class="secao"><div class="cx">
<div class="titulo-sec"><h2>Agenda</h2><a class="ver-mais" href="/programacao-e-ingressos/">Ver agenda completa →</a></div>
${blocoAgenda()}
</div></section>
<section class="secao cinza"><div class="cx">
<div class="titulo-sec"><h2>Por dentro de tudo!</h2><a class="ver-mais" href="/imprensa/">Todas as notícias →</a></div>
<div class="grade destaque">${noticias.slice(0, 7).map(n => cardNoticia(n)).join('\n')}</div>
</div></section>
<section class="secao"><div class="cx">
<div class="titulo-sec"><h2>Vídeos</h2><a class="bt roxo peq" href="${cfg.youtube}" target="_blank" rel="noopener">Todos os vídeos</a></div>
<div class="videos">${cfg.videos.map(id => `<button class="yt" data-id="${id}" aria-label="Assistir vídeo"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360"></button>`).join('')}</div>
</div></section>
<section class="secao" style="padding-top:0"><div class="cx">
<div class="camarote"><img class="logo-cam" src="/assets/img/banners/camarote-2027.webp" alt="Camarote A6" loading="lazy">
<div><div class="tag">#2027</div><h2>Próximo encontro é na ExpoUmuarama 2027</h2>
<p>O Camarote A6 é a experiência premium dos nossos grandes eventos.</p>
<a class="bt branco" href="/camarote-a6/">Conheça o Camarote A6</a></div></div>
</div></section>`,
}));

// AGENDA
grava('/programacao-e-ingressos/', layout({
  titulo: `Agenda e ingressos — ${cfg.nome}`, descricao: 'Próximos shows e eventos da A6 Produções no Sul do Brasil, com link oficial para comprar ingresso.',
  caminho: '/programacao-e-ingressos/', jsonld: jsonldEventos(),
  corpo: `<section class="cab-pag"><div class="cx"><h1>Agenda e ingressos</h1><p>Os próximos shows e eventos da A6. Compre sempre pelo link oficial.</p></div></section>
<section class="secao"><div class="cx">${blocoAgenda()}
<div class="caixa" style="margin-top:40px"><h3>Viva Superia</h3><p>Pacotes de viagem para os grandes shows, com hospedagem e experiência completa.</p>
<a class="bt magenta" href="${comUtm('https://vivasuperia-site.vercel.app/', 'agenda_viva_superia')}" target="_blank" rel="noopener">Conhecer o Viva Superia</a></div>
</div></section>`,
}));

// NOTÍCIAS (imprensa)
grava('/imprensa/', layout({
  titulo: `Notícias e imprensa — ${cfg.nome}`, descricao: 'Notícias dos shows e eventos da A6 Produções e credenciamento de imprensa.',
  caminho: '/imprensa/',
  corpo: `<section class="cab-pag"><div class="cx"><h1>Notícias e imprensa</h1><p>Tudo o que acontece nos eventos da A6, pela nossa assessoria de imprensa.</p></div></section>
<section class="secao"><div class="cx duas">
<div><div class="grade">${noticias.map((n, i) => cardNoticia(n, i >= 12)).join('\n')}</div>
${noticias.length > 12 ? '<div class="mais-wrap"><button class="bt roxo" data-carregar-mais>Carregar mais notícias</button></div>' : ''}</div>
<aside class="caixa"><h3>Credenciamento de imprensa</h3>
<p>Para cobrir um evento da A6, fale com a assessoria de imprensa:</p>
<p><b>${esc(cfg.imprensa.nome)}</b><br><a href="mailto:${cfg.imprensa.email}">${cfg.imprensa.email}</a><br>${esc(cfg.imprensa.telefone)}</p>
<p>Só aceitamos credenciamento de jornalistas com e-mail corporativo do veículo. As respostas são enviadas por e-mail.</p>
<a class="bt peq" href="mailto:${cfg.imprensa.email}?subject=Credenciamento%20de%20imprensa">Pedir credenciamento</a></aside>
</div></section>`,
}));
// a lista de notícias tem 2 colunas só no desktop largo; no resto fica grade simples
// MATÉRIAS — mesmos endereços do WordPress (preserva o Google)
for (const [i, n] of noticias.entries()) {
  const relacionadas = noticias.filter(o => o.slug !== n.slug).slice(0, 3);
  const url = `${D}/${n.slug}/`;
  const wpp = 'https://wa.me/?text=' + encodeURIComponent(n.titulo + ' ' + url);
  grava(`/${n.slug}/`, layout({
    titulo: `${n.titulo} — ${cfg.nome}`, descricao: n.descricao, caminho: `/${n.slug}/`, og: n.capa, tipo: 'article',
    jsonld: [{
      '@context': 'https://schema.org', '@type': 'NewsArticle', headline: n.titulo.slice(0, 110), datePublished: n.data + '-03:00', dateModified: n.atualizado + '-03:00',
      image: n.capa ? [D + n.capa] : undefined, author: { '@type': 'Person', name: 'Wallace Machado' },
      publisher: { '@type': 'Organization', name: cfg.nome, logo: { '@type': 'ImageObject', url: D + '/assets/img/logo-a6.png' } }, mainEntityOfPage: url,
    }, {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: D + '/' }, { '@type': 'ListItem', position: 2, name: 'Notícias', item: D + '/imprensa/' }, { '@type': 'ListItem', position: 3, name: n.titulo }],
    }],
    corpo: `<section class="cab-pag"><div class="cx"><div class="migalha"><a href="/">Home</a> › <a href="/imprensa/">Notícias</a></div>
<h1>${esc(n.titulo)}</h1><div class="meta-materia"><time datetime="${n.data}">${dataLonga(n.data)}</time><span>Por Wallace Machado · Assessoria de Imprensa A6</span></div></div></section>
<section class="secao" style="padding-top:0"><div class="cx">
${n.capa ? `<div class="materia-capa" style="max-width:980px"><img src="${n.capa}" alt="${esc(n.capaAlt)}" fetchpriority="high"></div>` : '<div style="height:40px"></div>'}
<article class="texto">${n.html}</article>
<div class="compartilhar"><a class="bt agua peq" href="${wpp}" target="_blank" rel="noopener">Compartilhar no WhatsApp</a><a class="bt roxo peq" href="/programacao-e-ingressos/">Ver agenda</a></div>
<h2 style="margin-top:40px">Leia também</h2><div class="grade">${relacionadas.map(r => cardNoticia(r)).join('')}</div>
</div></section>`,
  }));
}

// A EMPRESA
grava('/sobre/', layout({
  titulo: `A empresa — ${cfg.nome}`, descricao: 'A A6 Produções cria, produz e gerencia eventos e shows no Sul do Brasil, do planejamento à execução.',
  caminho: '/sobre/',
  corpo: `<section class="cab-pag"><div class="cx"><h1>Quem somos</h1><p>A6 Produções. Onde grandes eventos acontecem.</p></div></section>
<section class="secao"><div class="cx"><div class="texto">
<p>A A6 Produções é especializada na criação, produção e gestão de eventos e shows. Atuamos do planejamento à execução, com foco em qualidade, organização e grandes experiências para o público. Nosso compromisso é transformar projetos em espetáculos de sucesso em todo o Sul do Brasil.</p>
<p>Nosso compromisso é transformar ideias em grandes espetáculos, gerar valor para marcas, parceiros e patrocinadores, e levar alegria para milhares de pessoas em todo o Sul do Brasil.</p></div>
<div class="numeros"><div><b>+400</b>eventos</div><div><b>+25</b>anos de experiência</div><div><b>Sul</b>do Brasil</div><div><b>Grandes</b>festivais</div></div>
<div style="margin-top:40px" class="botoes"><a class="bt" href="/contato/">Leve um evento para sua cidade</a><a class="bt roxo" href="/programacao-e-ingressos/">Ver agenda</a></div>
</div></section>`,
}));

// CONTATO
grava('/contato/', layout({
  titulo: `Contato — ${cfg.nome}`, descricao: 'Quer levar um grande evento para sua cidade ou fechar parceria com a A6 Produções? Fale com a gente.',
  caminho: '/contato/',
  corpo: `<section class="cab-pag"><div class="cx"><h1>Entre em contato</h1><p>Quer levar um grande evento para sua cidade ou fechar uma parceria com a A6 Produções? Estamos prontos para atender artistas, produtores, marcas, patrocinadores e gestores públicos.</p></div></section>
<section class="secao"><div class="cx duas">
<form class="contato" action="/enviar-contato.php" method="post" ${PREVIA ? 'onsubmit="alert(\'Prévia: o envio será ligado na versão oficial.\');return false"' : ''}>
<label>Nome *<input name="nome" required autocomplete="name"></label>
<label>E-mail *<input name="email" type="email" required autocomplete="email"></label>
<label>Telefone / WhatsApp *<input name="telefone" type="tel" required autocomplete="tel"></label>
<label>Você é<select name="perfil"><option>Gestor público / prefeitura</option><option>Marca ou patrocinador</option><option>Artista ou produtor</option><option>Outro</option></select></label>
<label>Conte pra nós *<textarea name="mensagem" required></textarea></label>
<input type="text" name="site" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<button class="bt" type="submit">Enviar mensagem</button>
<p class="aviso-form">Respondemos pelo e-mail ou telefone informado.</p>
</form>
<aside class="caixa"><h3>Informações de contato</h3>
<p><b>E-mail:</b><br><a href="mailto:${cfg.email}">${cfg.email}</a></p>
${cfg.telefone ? `<p><b>Telefone:</b><br>${esc(cfg.telefone)}</p>` : ''}
<p><b>Imprensa:</b><br><a href="mailto:${cfg.imprensa.email}">${cfg.imprensa.email}</a></p>
<p><b>Endereço:</b><br>${esc(cfg.endereco)}</p></aside>
</div></section>`,
}));

// CAMAROTE
grava('/camarote-a6/', layout({
  titulo: `Camarote A6 — ${cfg.nome}`, descricao: 'Camarote A6: a experiência premium dos grandes eventos da A6 Produções. Próximo encontro na ExpoUmuarama 2027.',
  caminho: '/camarote-a6/',
  corpo: `<section class="cab-pag"><div class="cx"><h1>Camarote A6</h1><p>#2027 — Próximo encontro é na ExpoUmuarama 2027.</p></div></section>
<section class="secao"><div class="cx duas"><img src="/assets/img/banners/camarote-2027.webp" alt="Camarote A6" style="border-radius:22px;background:#fff">
<div><h2>Por dentro de tudo!</h2><div class="grade">${noticias.slice(0, 2).map(n => cardNoticia(n)).join('')}</div></div></div></section>`,
}));

// 404
grava('/404.html', layout({
  titulo: `Página não encontrada — ${cfg.nome}`, descricao: 'Página não encontrada.', caminho: '/404.html',
  corpo: `<section class="cab-pag"><div class="cx"><h1>Ops, essa página não existe</h1><p>Veja a agenda ou as últimas notícias da A6.</p></div></section>
<section class="secao"><div class="cx botoes"><a class="bt" href="/programacao-e-ingressos/">Agenda</a><a class="bt roxo" href="/imprensa/">Notícias</a><a class="bt agua" href="/">Home</a></div></section>`,
}));

// redirecionamentos dos endereços antigos que não existem mais (301)
const REDIR = {
  '/eventos/': '/programacao-e-ingressos/', '/mesas/': '/programacao-e-ingressos/', '/mesas-e-lounges/': '/programacao-e-ingressos/',
  '/precos/': '/contato/', '/servicos/': '/contato/', '/projetos/': '/sobre/', '/comercial/': '/contato/', '/artistas-e-projetos/': '/sobre/',
  '/home/': '/', '/category/destaque/': '/imprensa/', '/category/shows/': '/imprensa/', '/category/uncategorized/': '/imprensa/',
};
fs.writeFileSync(path.join(SITE, '_redirects'), Object.entries(REDIR).map(([de, para]) => `${de} ${para} 301\n${de.slice(0, -1)} ${para} 301`).join('\n') + '\n');
fs.writeFileSync(path.join(SITE, '.htaccess'), `# Gerado por scripts/gerar.mjs — Hostinger (Apache)
Options -Indexes
ErrorDocument 404 /404.html
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]
RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]
# endereços antigos do WordPress
${Object.entries(REDIR).map(([de, para]) => `RewriteRule ^${de.slice(1).replace(/\/$/, '')}/?$ ${para} [L,R=301]`).join('\n')}
RewriteRule ^wp-admin/?.*$ / [L,R=302]
RewriteRule ^feed/?$ /imprensa/ [L,R=301]
<IfModule mod_expires.c>
ExpiresActive On
ExpiresByType image/webp "access plus 30 days"
ExpiresByType image/png "access plus 30 days"
ExpiresByType text/css "access plus 30 days"
ExpiresByType application/javascript "access plus 30 days"
</IfModule>
`);
if (PREVIA) fs.writeFileSync(path.join(SITE, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
else if (fs.existsSync(path.join(SITE, '_headers'))) fs.rmSync(path.join(SITE, '_headers'));

fs.writeFileSync(path.join(SITE, 'robots.txt'), PREVIA ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${D}/sitemap.xml\n`);
const hoje = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(p => { const n = noticias.find(x => `/${x.slug}/` === p); return `<url><loc>${D}${p}</loc><lastmod>${n ? n.atualizado.slice(0, 10) : hoje}</lastmod></url>`; }).join('\n')}
</urlset>
`);
console.log(`${PREVIA ? 'PRÉVIA' : 'PRODUÇÃO'}: ${paginas.length} páginas, ${eventos.length} eventos na agenda, ${slides.length} banners, ${botoes.length} botões`);
