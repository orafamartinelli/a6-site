# a6-site — novo site da A6 Produções (a6producoes.com.br)

Site estático (HTML/CSS/JS puro, sem WordPress) gerado por script. Vai substituir o WordPress/Elementor que o Wallace montou na Hostinger. **Hospedagem final: Hostinger** (decisão do Rafa, 17/11/2026). Prévia: https://a6-site-previa.pages.dev/ (Cloudflare Pages, noindex).

## Como funciona
- `conteudo/site.json` — dados fixos (contatos, endereço, vídeos do YouTube).
- `conteudo/agenda.json` — eventos e botões com `entra`/`sai` (horário de Brasília). Expirado não entra no HTML; futuro entra escondido e o `site.js` libera na hora. `carrossel: true` = banner grande da home. Links ganham UTM `utm_source=site_a6`.
- `conteudo/noticias.json` — as 47 matérias importadas do WP (mesmos slugs na raiz `/<slug>/` — preserva o Google).
- `scripts/gerar.mjs [--previa]` — gera `site/`. `--previa` = noindex + faixa amarela + robots bloqueado + formulário desligado.
- `scripts/importar.mjs` — reimporta do WP antigo (API pública) e converte imagens para WebP.
- `scripts/fotos.mjs` — fotos celular/PC + checa estouro lateral e imagem quebrada (NODE_PATH de um projeto com playwright).
- `scripts/publicar-previa.mjs` — publica a prévia (token do cofre `cloudflare-api-token.json`).
- `site/.htaccess` (Hostinger) e `site/_redirects` (prévia) — 301 dos endereços antigos (/precos, /servicos, /projetos, /mesas-e-lounges…).

## Pendente (fase 2, precisa do acesso Hostinger do Wallace)
- Painel com login para o Wallace publicar notícias (PHP na Hostinger grava em `conteudo/` e regera).
- Robô diário: banners/agenda a partir de pasta + planilha no Drive.
- Formulário de contato (`/enviar-contato.php`), GA4 (tag atual `GT-NC6TWLTK`) + pixel Meta + kit rastreio-lp — prévia não mede.
- Dados que faltam: WhatsApp oficial (o site atual usa número de modelo 550900000000), telefone do contato (atual é (44) 0000-0000), Instagram/Facebook.
