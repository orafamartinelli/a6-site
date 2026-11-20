# a6-site — novo site da A6 Produções (a6producoes.com.br)

Site estático (HTML/CSS/JS puro, sem WordPress) gerado por script. Vai substituir o WordPress/Elementor da Hostinger. **Hospedagem final: Hostinger** (decisão do Rafa, 17/11/2026). Prévia: https://a6-site-previa.pages.dev/ (Cloudflare Pages, noindex).

## Conteúdo (quem alimenta o quê)
- **Agenda/banners → Bianca**, pela planilha "Agenda do site A6" + pasta "Banners do site", na pasta do Drive "Agenda do site A6" (conta rafa@obutiquim; IDs em `conteudo/drive.json`). Colunas lidas pelo NOME (`scripts/agenda-drive.mjs`): Evento, Cidade, Data do show, Link do ingresso, Banner (nome do arquivo ou link do Drive) + opcionais Local, Horário, Aparece a partir de, Sai do site em, Pausar (caixinha). Aba "Botões da home (avançado)" = botões coloridos da home.
- **Notícias → Wallace**, mandando foto + texto (≥ 280 caracteres) nos grupos "A6 IMPRENSA 📲🚀" e "IMPRENSA A6". Título = 1ª linha; foto = capa. Autores aceitos: `NOTICIA_AUTORES` no `robo/wrangler.toml` (Wallace + Rafa).
- `conteudo/agenda.json` e `conteudo/noticias.json` são gerados — não editar agenda à mão; notícia pode ser corrigida no JSON.

## Robôs (como a mudança chega no site)
```
Planilha/banners mudou ──┐                                     ┌─> GitHub Actions "atualizar" (a6-site)
                         ├─> despertador butiquim-reguas (5/5 min) ─> a6-site-robo /vigiar ─┤   lê planilha + notícias, gera, publica prévia
Wallace no grupo ─> raro-zapi-router (bloco A6, aditivo) ─> a6-site-robo /noticia (KV) ─────┘   avisa Rafa (link da matéria / linha com problema / falha)
```
- **a6-site-robo** (`robo/`, Cloudflare Worker, sem cron próprio — conta sem vaga): `/vigiar` (chamado pelo despertador), `/atualizar?k=LINK_KEY` (link "Atualizar agora" na aba Leia-me), `/noticia` + `/pendentes` + `/confirmar` (notícias do WhatsApp), `/contato` (formulário). Publicar: `node scripts/publicar-robo.mjs [--segredos]`. ⚠️ toda variável dentro de `[vars]`, ANTES dos blocos `[[...]]`.
- **Despertador** (`butiquim-reguas`): porta só-disparo `/disparar-a6-site` (chave `A6_DISPARO_KEY`, não roda o tick), linha `a6-site-atualizar` 06:05 diária, cutucada no vigia a cada 5 min (service binding `A6_ROBO`). Publicar: `node scripts/instalar-porta-despertador.mjs`.
- **raro-zapi-router**: bloco aditivo dos grupos da imprensa (`A6_IMPRENSA_GROUP_IDS`, binding `A6_ROBO`). Publicado por `node scripts/roteador-imprensa.mjs publicar`, que parte do código NO AR (a cópia em hub_reservas/infra está desatualizada) e mantém todas as ligações. Backup do código anterior: `referencia/raro-zapi-router-no-ar-antes.js`.
- Workflow `.github/workflows/atualizar.yml` (só workflow_dispatch). Segredos: `node scripts/configurar-segredos.mjs`.
- Ponta a ponta medido em 20/11/2026: planilha → site em ~3 min; matéria do grupo → site em ~1,5 min.

## Formulário de contato
POST no `a6-site-robo/contato` → WhatsApp + e-mail (Resend, remetente avisos@orafamartinelli.com.br, reply-to = quem preencheu). **`MODO_TESTE = "1"`** no `robo/wrangler.toml` = vai pro Rafa com [TESTE]; trocar para "0" depois do OK do Rafa → WhatsApp (44) 3101-1045 + contato@a6producoes.com.br. Armadilha anti-robô (campo oculto + tempo mínimo) e limite de 5 envios/hora por IP.

## Medição
Só na versão oficial (`node scripts/gerar.mjs` sem `--previa`): GA4 `GT-NC6TWLTK` (tag do site atual), pixel "Camarote A6" `729649615336498` (Lead no formulário, Contact no WhatsApp, `clique_ingresso` custom) e kit rastreio-lp (`a6-site`, view `lp_funil`). Prévia: só com `?rastreio_teste=1` (grava como `a6-site-teste`).

## Scripts
`gerar.mjs [--previa]` · `importar.mjs` (reimporta do WP) · `fotos.mjs` (celular/PC, NODE_PATH com playwright) · `publicar-previa.mjs` · `criar-planilha.mjs` / `reestruturar-planilha.mjs` (já rodados) · `teste-celula.mjs` / `teste-noticia.mjs` (testes) · `zapi-grupos.mjs` (só leitura).

## Feito em 20/11/2026
- Formulário OFICIAL (`MODO_TESTE = "0"`, teste validado pelo Rafa).
- Pasta "Agenda do site A6" compartilhada com bianca.gimenes@a6producoes.com.br (editora).

## Pendente — Hostinger (acesso do Wallace, segunda 23/11)
1. Backup completo do WordPress atual (arquivos + banco) ANTES de tudo.
2. Segredos `HOSTINGER_FTP_HOST/USER/PASS` (+ variável `HOSTINGER_DIR` se não for public_html).
3. Tirar o WordPress do public_html (o espelho FTP não apaga arquivos antigos; `index.php` do WP venceria o `index.html`).
4. `gh variable set HOSTINGER_ATIVO -R orafamartinelli/a6-site --body 1` e rodar `gh workflow run atualizar.yml -f motivo=oficial`.
5. Conferir páginas com barra final, 301 do `.htaccess`, GA4/pixel disparando, Search Console (reenviar sitemap).
