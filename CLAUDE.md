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
Só na versão oficial (`node scripts/gerar.mjs` sem `--previa`): GA4 `G-RB7JHJNKMY` (propriedade da A6, direto; desde 20/11/2026 — antes usava a tag `GT-NC6TWLTK` do WP, que repassava para ela), pixel "Camarote A6" `729649615336498` (Lead no formulário, Contact no WhatsApp, `clique_ingresso` custom) e kit rastreio-lp (`a6-site`, view `lp_funil`). Prévia: só com `?rastreio_teste=1` (grava como `a6-site-teste`).

## Scripts
`gerar.mjs [--previa]` · `importar.mjs` (reimporta do WP) · `fotos.mjs` (celular/PC, NODE_PATH com playwright) · `publicar-previa.mjs` · `criar-planilha.mjs` / `reestruturar-planilha.mjs` (já rodados) · `teste-celula.mjs` / `teste-noticia.mjs` (testes) · `zapi-grupos.mjs` (só leitura).

## Espelhos Viva Superia / Superia Rock (20/11/2026)
`scripts/espelhar-superia.mjs` copia `vivasuperia-site.vercel.app` → `/vivasuperia/` (Superia Rock/imersiva cancelado em 20/11/2026: espelho removido, /superia-rock/ → 301 /vivasuperia/) (roda em toda rodada do robô; canonical no domínio da A6; links entre eles reescritos; Vercel Analytics desligado). Motivo: anúncio direto na página final, SEM redirecionamento (redirecionamento derrubava o "acesso à página" da Meta). Os originais continuam sendo editados nos repos superia-site / superia-gessinger — o espelho só copia. Conferência: `scripts/conferir-espelho.mjs`.

## Página para cidades
`/leve-um-show-para-sua-cidade/` (prefeituras, festas, exposições, patrocinadores). Conteúdo só com fatos do próprio site (números de "A empresa", artistas/cidades das matérias, 6 matérias como casos). Formulário → mesmo `/contato` do vigia com `origem=show-cidade-site` (assunto "Proposta de show", Lead com content_name `show-cidade-site`). /comercial/, /artistas-e-projetos/, /precos/, /servicos/, /projetos/ → 301 para ela.

## Feito em 20/11/2026
- Formulário OFICIAL (`MODO_TESTE = "0"`, teste validado pelo Rafa).
- Pasta "Agenda do site A6" compartilhada com bianca.gimenes@a6producoes.com.br (editora).

## Hostinger — preparado em 20/11/2026 (Homer), troca fica para fazer COM o Wallace
- Acesso: hPanel do Rafa → "Compartilhados com você" → a6producoes.com.br (dono dupoiares@a6producoes.com.br, plano Cloud Startup). Base `/home/u926519350/domains/a6producoes.com.br`.
- ✅ FTP do robô: `u926519350.robositenovo`, presa à pasta `/site-novo` (FORA do public_html → não aparece na internet, não enxerga o WordPress). Host = IP `76.13.89.220` (o `ftp.a6producoes.com.br` NÃO resolve: o DNS da A6 não está na Hostinger — NÃO mexer no DNS, os e-mails são Google Workspace, MX smtp.google.com). Senha no cofre do OpenBot (Homer) `HOSTINGER_FTP_PASS_A6`.
- ✅ Segredos `HOSTINGER_FTP_HOST/USER/PASS` + variável `HOSTINGER_DIR=.` + `HOSTINGER_ATIVO=1`: todo `atualizar` espelha a versão OFICIAL (indexável, com medição) em `/site-novo`. 1ª publicação 20/11 11h22: 57 páginas, conferido por FTP; WordPress segue no ar.
- Backup: Hostinger tem backup completo de 20/11 10h31 + automático diário. Download só por e-mail ao dono (não pedido).

### Troca (dia combinado com o Wallace) — NÃO fazer sozinho
1. Backup MANUAL na hora (hPanel → Backups → criar; 1 a cada 24 h).
2. No Gerenciador de arquivos: renomear `public_html` → `public_html-wordpress` e `site-novo` → `public_html` (ou mover o conteúdo). O FTP do robô está preso a `/site-novo`: depois da troca, editar a conta FTP para o diretório `/public_html` (ou recriar).
3. `gh workflow run atualizar.yml -R orafamartinelli/a6-site -f motivo=oficial`. Volta atrás = renomear de volta.
4. NÃO tocar em DNS/MX/registros do e-mail.
5. Conferir páginas com barra final, 301 do `.htaccess`, GA4/pixel disparando (Test Events da Meta), Search Console (reenviar sitemap).
6. Depois que `clique_ingresso` aparecer no pixel 729649615336498: pedir ao Gestor a conversão "Clique ingresso – Site A6" (categoria Outro). A API recusou antes (erro 100/1760020) porque o pixel nunca recebeu o evento; se recusar de novo, criar à mão no Gerenciador de Eventos. Já existe "Lead – Site A6" (id 2409271213142281, Lead + content_name contém "-site").
