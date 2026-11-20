// a6-site-robo — vigia da planilha "Agenda do site A6" e da pasta "Banners do site" (Drive da conta rafa@obutiquim).
// A cada minuto: se algo nas duas pastas mudou e a pessoa parou de mexer há ~45 s, pede ao despertador
// (butiquim-reguas /disparar-a6-site) para rodar o robô do site no GitHub. Sem banco: usa a janela de tempo.
// GET /atualizar?k=<LINK_KEY>  → dispara na hora (link "Atualizar agora" da planilha).
// GET /estado?k=<LINK_KEY>     → mostra o que ele vê (diagnóstico).

// Sem cron próprio (limite da conta): o despertador butiquim-reguas chama GET /vigiar a cada 5 min.
const VOLTA_MS = 300_000;   // intervalo entre as chamadas do despertador
const QUIETO_MS = 45_000;   // espera a pessoa parar de editar
const JANELA_MS = VOLTA_MS + QUIETO_MS; // cada mudança cai em exatamente uma volta

async function tokenGoogle(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('google token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

async function mudancasRecentes(env, agora) {
  const desde = new Date(agora - JANELA_MS).toISOString();
  const q = `('${env.PASTA_SITE_NOVO}' in parents or '${env.PASTA_BANNERS}' in parents) and modifiedTime > '${desde}' and trashed=false`;
  const u = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q, fields: 'files(id,name,modifiedTime,parents)', pageSize: '50', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + await tokenGoogle(env) } });
  if (!r.ok) throw new Error('drive ' + r.status + ' ' + (await r.text()).slice(0, 200));
  // só interessa a planilha da agenda e os banners (ignora outros arquivos da pasta Site novo)
  return (await r.json()).files.filter(f => f.id === env.PLANILHA || (f.parents || []).includes(env.PASTA_BANNERS));
}

async function disparar(env, motivo) {
  const u = `${env.DESPERTADOR_URL}/disparar-a6-site?key=${env.A6_DISPARO_KEY}&motivo=${encodeURIComponent(motivo)}`;
  const r = env.DESPERTADOR ? await env.DESPERTADOR.fetch(u) : await fetch(u);
  return `${r.status} ${await r.text()}`;
}

async function vigiar(env, agora = Date.now()) {
  const arqs = await mudancasRecentes(env, agora);
  if (!arqs.length) return { acao: 'nada mudou' };
  const ultima = Math.max(...arqs.map(f => Date.parse(f.modifiedTime)));
  if (agora - ultima < QUIETO_MS) return { acao: 'esperando parar de editar', arqs: arqs.map(f => f.name) };
  if (agora - ultima >= QUIETO_MS + VOLTA_MS) return { acao: 'já disparado na volta anterior', arqs: arqs.map(f => f.name) };
  return { acao: 'disparou', arqs: arqs.map(f => f.name), github: await disparar(env, 'planilha') };
}

// ── Formulário de contato do site ──────────────────────────────────────────
// POST /contato (FormData). MODO_TESTE=1 → WhatsApp do Rafa com [TESTE] + e-mail de teste; senão → A6.
const ORIGENS = ['https://a6-site-previa.pages.dev', 'https://a6producoes.com.br', 'https://www.a6producoes.com.br', 'http://127.0.0.1:18431'];
const cors = req => {
  const o = req.headers.get('origin') || '';
  return ORIGENS.includes(o) || /^https:\/\/[a-z0-9]+\.a6-site-previa\.pages\.dev$/.test(o) ? { 'Access-Control-Allow-Origin': o, 'Vary': 'Origin' } : {};
};
const limpa = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function limiteIp(req) {
  // até 5 envios por IP por hora, contado no cache do Cloudflare (sem banco)
  const ip = req.headers.get('cf-connecting-ip') || 'x';
  const chave = new Request(`https://limite.a6/${ip}/${Math.floor(Date.now() / 3600e3)}`);
  const cache = caches.default;
  const atual = Number((await (await cache.match(chave))?.text()) || 0);
  if (atual >= 5) return false;
  await cache.put(chave, new Response(String(atual + 1), { headers: { 'Cache-Control': 'max-age=3600' } }));
  return true;
}

async function contato(req, env) {
  const h = cors(req);
  const responder = (ok, msg, status = 200) => {
    if ((req.headers.get('accept') || '').includes('application/json')) return Response.json({ ok, msg }, { status, headers: h });
    const volta = (req.headers.get('referer') || 'https://a6-site-previa.pages.dev/contato/').split('?')[0];
    return Response.redirect(`${volta}?${ok ? 'enviado=1' : 'erro=1'}`, 303);
  };
  const f = await req.formData();
  if (f.get('site')) return responder(true, 'ok'); // armadilha de robô: finge que deu certo
  const t = Number(f.get('t') || 0);
  if (t && Date.now() - t < 2500) return responder(true, 'ok'); // preenchido rápido demais = robô
  const d = { nome: limpa(f.get('nome'), 80), email: limpa(f.get('email'), 120), telefone: limpa(f.get('telefone'), 30), perfil: limpa(f.get('perfil'), 60), mensagem: limpa(f.get('mensagem'), 2000), pagina: limpa(f.get('pagina'), 120) };
  if (!d.nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || d.telefone.replace(/\D/g, '').length < 10 || !d.mensagem) return responder(false, 'Confira nome, e-mail, telefone e mensagem.', 400);
  if (!(await limiteIp(req))) return responder(false, 'Muitos envios seguidos. Tente de novo mais tarde.', 429);

  const teste = env.MODO_TESTE === '1';
  const pre = teste ? '[TESTE] ' : '';
  const foneLimpo = d.telefone.replace(/\D/g, '');
  const waLead = 'https://wa.me/' + (foneLimpo.length <= 11 ? '55' + foneLimpo : foneLimpo);
  const textoWa = `${pre}📩 *Novo contato pelo site da A6*\n\n*Nome:* ${d.nome}\n*Perfil:* ${d.perfil}\n*WhatsApp:* ${d.telefone} (${waLead})\n*E-mail:* ${d.email}\n\n${d.mensagem}`;
  const resultados = await Promise.allSettled([
    fetch(`https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`, { method: 'POST', headers: { 'Client-Token': env.ZAPI_CLIENT_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ phone: teste ? env.WA_TESTE : env.WA_A6, message: textoWa }) }).then(r => { if (!r.ok) throw new Error('zap ' + r.status); }),
    fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_KEY, 'content-type': 'application/json' }, body: JSON.stringify({
      from: 'Site A6 Produções <avisos@orafamartinelli.com.br>', to: [teste ? env.EMAIL_TESTE : env.EMAIL_A6], reply_to: d.email,
      subject: `${pre}Contato pelo site: ${d.nome} (${d.perfil})`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:15px"><h2 style="color:#321166">Novo contato pelo site</h2><p><b>Nome:</b> ${escHtml(d.nome)}<br><b>Perfil:</b> ${escHtml(d.perfil)}<br><b>WhatsApp:</b> <a href="${waLead}">${escHtml(d.telefone)}</a><br><b>E-mail:</b> ${escHtml(d.email)}</p><p style="white-space:pre-wrap;background:#f2f2f2;padding:14px;border-radius:10px">${escHtml(d.mensagem)}</p><p style="color:#777;font-size:12px">Enviado da página ${escHtml(d.pagina)}. Responda este e-mail para falar direto com a pessoa.</p></div>`,
    }) }).then(r => { if (!r.ok) throw new Error('email ' + r.status); }),
  ]);
  const falhas = resultados.filter(r => r.status === 'rejected').map(r => r.reason.message);
  console.log('contato', JSON.stringify({ teste, falhas }));
  if (falhas.length === 2) return responder(false, 'Não conseguimos enviar agora. Fale pelo WhatsApp (44) 3101-1045.', 502);
  return responder(true, 'Mensagem enviada! Vamos responder em breve.');
}

// ── Notícias pelo grupo da imprensa (WhatsApp) ─────────────────────────────
// O raro-zapi-router repassa para POST /noticia?key=A6_DISPARO_KEY o webhook Z-API das mensagens do grupo da imprensa.
// Regra: só mensagens de AUTORES (env.NOTICIA_AUTORES, ex. Wallace) com foto + texto longo (legenda ≥ 280 caracteres,
// ou foto e, em até 15 min, um texto ≥ 280). Vira pendência no KV; o robô do site (GitHub) busca em GET /pendentes.
const MIN_TEXTO = 280;
async function noticiaRecebida(req, env) {
  const m = await req.json();
  if (!m || m.fromMe || !m.isGroup) return 'ignorado';
  const grupos = (env.NOTICIA_GRUPOS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (grupos.length && !grupos.includes(String(m.phone))) return 'outro grupo';
  const autor = String(m.participantPhone || '').replace(/\D/g, '');
  const autores = (env.NOTICIA_AUTORES || '').split(',').map(s => s.replace(/\D/g, '')).filter(Boolean);
  if (!autores.some(a => autor.endsWith(a.slice(-8)))) return 'autor não autorizado';
  const foto = m.image?.imageUrl || null;
  const texto = (m.image?.caption || m.text?.message || '').trim();
  const chaveFoto = `foto:${autor}`;
  if (foto && texto.length < MIN_TEXTO) { await env.KV.put(chaveFoto, JSON.stringify({ foto, em: Date.now() }), { expirationTtl: 900 }); return 'foto guardada, esperando texto'; }
  let capa = foto;
  if (!capa && texto.length >= MIN_TEXTO) { const f = await env.KV.get(chaveFoto, 'json'); if (f) { capa = f.foto; await env.KV.delete(chaveFoto); } }
  if (!capa || texto.length < MIN_TEXTO) return 'não é matéria (precisa foto + texto longo)';
  const id = `n:${Date.now()}:${(m.messageId || '').slice(-8)}`;
  await env.KV.put(id, JSON.stringify({ id, texto, capa, autor: m.senderName || autor, recebidoEm: new Date().toISOString(), messageId: m.messageId }), { expirationTtl: 14 * 86400 });
  await disparar(env, 'noticia');
  return 'matéria recebida';
}

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(vigiar(env).then(r => console.log(JSON.stringify(r))).catch(e => console.log('ERRO ' + e.message)));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/contato') {
      if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors(req), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Accept' } });
      if (req.method === 'POST') { try { return await contato(req, env); } catch (e) { console.log('contato ERRO ' + e.message); return Response.json({ ok: false, msg: 'Erro ao enviar.' }, { status: 500, headers: cors(req) }); } }
    }
    const chaveRobo = url.searchParams.get('key') === env.A6_DISPARO_KEY;
    if (url.pathname === '/noticia' && req.method === 'POST' && chaveRobo) {
      try { const r = await noticiaRecebida(req, env); console.log('noticia', r); return new Response(r); } catch (e) { console.log('noticia ERRO ' + e.message); return new Response('erro', { status: 200 }); }
    }
    if (url.pathname === '/pendentes' && chaveRobo) {
      const lista = await env.KV.list({ prefix: 'n:' });
      const itens = (await Promise.all(lista.keys.map(k => env.KV.get(k.name, 'json')))).filter(Boolean);
      return Response.json(itens);
    }
    if (url.pathname === '/confirmar' && req.method === 'POST' && chaveRobo) {
      const ids = await req.json();
      await Promise.all(ids.map(id => env.KV.delete(id)));
      return Response.json({ apagados: ids.length });
    }
    const ok = url.searchParams.get('k') === env.LINK_KEY;
    if (url.pathname === '/vigiar' && url.searchParams.get('key') === env.A6_DISPARO_KEY) {
      try { const r = await vigiar(env); console.log(JSON.stringify(r)); return Response.json(r); } catch (e) { console.log('ERRO ' + e.message); return new Response(e.message, { status: 500 }); }
    }
    if (url.pathname === '/atualizar' && ok) {
      const res = await disparar(env, 'botao');
      const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:40px;text-align:center;background:#321166;color:#fff">
<h2>${res.startsWith('200') ? '✅ Atualização pedida!' : '⚠️ Não consegui pedir agora'}</h2><p>O site da A6 fica pronto em cerca de 2 minutos.</p>
<p><a style="color:#ffd1ff" href="https://a6-site-previa.pages.dev/">Abrir o site</a></p></body>`;
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname === '/estado' && ok) {
      try { return Response.json(await mudancasRecentes(env, Date.now())); } catch (e) { return new Response(e.message, { status: 500 }); }
    }
    return new Response('a6-site-robo ok');
  },
};
