// raro-zapi-router — roteia os webhooks "message received" da instância Z-API
// do número central do Rafa (554488097549) para os consumidores certos.
// FONTE CANÔNICA: este arquivo (noah-propostas/worker/). A cópia em
// hub_reservas/infra/raro-zapi-router/worker.js deve ser mantida IDÊNTICA —
// em 14/08/2026 as duas linhagens divergiram (Pillar de um lado, QG do outro)
// e as rotas do QG ficaram fora do ar; esta versão funde tudo.
//
// Rotas, na ordem:
//   0. Grupo "Estreia da Pillar" (PILLAR_GROUP_ID) → worker estreia-pillar
//      (página do nascimento) — EXCLUSIVA: nem Radar nem hub veem o grupo;
//      aceita fromMe (testes/avisos pelo número central também aparecem na página).
//   0a. Grupo "📄 Gerador de Propostas RaRo" (PROPOSTAS_GROUP_ID) → Hermes em MODO
//      PROPOSTA (service binding HERMES, header X-Hermes-Modo: proposta) — EXCLUSIVA:
//      nem Radar nem hub veem o grupo; só mensagens do Rafa (RAFA_PERSONAL_IDS)
//      passam; fromMe (respostas do Hermes/robô) e terceiros são engolidos.
//   0c. Grupo "👶 Pillar – Saúde & Agenda" (PILLAR_SAUDE_GROUP_ID) → Hermes em MODO PILLAR
//      (header X-Hermes-Modo: pillar) — EXCLUSIVA; fromMe engolido; o Hermes filtra o
//      remetente (Rafa + Mariane) e atualiza a agenda da filha no Supabase (23/09/2026).
//   0b. Grupo "🎬 Vídeos RaRo & Prontto" (VIDEOS_GROUP_ID) → esteira de vídeos-clone
//      no n8n (VIDEOS_WEBHOOK_URL) — EXCLUSIVA: nem Radar nem hub veem o grupo;
//      fromMe (respostas da própria esteira) e terceiros são engolidos.
//   1. Mensagem de grupo (não fromMe)            → Radar (RADAR_WEBHOOK_URL, secret) [aditivo]
//   1d. Grupos dos perfis Mistérios (MISTERIOS_GROUP_IDS), só mensagem do Rafa → Coletor do grupo
//       (MISTERIOS_GRUPO_URL + secret MISTERIOS_GRUPO_SEGREDO) [aditivo, 14/11/2026]
//   1a. Grupo "📅 Conteúdo - O Butiquim" (STORYMAKER_GROUP_ID): "OK n"/"NÃO n" de
//       STORYMAKER_APROVADORES → butiquim_storymaker_respostas (Supabase) [aditivo]
//   1b. Métricas de campanha QG (status/DM)      → QG_CAMPANHA_WEBHOOK_URL [aditivo]
//   1c. Atendente/avaliação QG (qualquer DM)     → QG_ATENDENTE_WEBHOOK_URL [aditivo,
//       o webhook filtra por conversa de avaliação ativa]
//       ⚠️ 1b e 1c estão DESLIGADOS desde 18/09/2026: os dois secrets foram removidos
//       do worker no ar (código intacto — as funções viram no-op sem a URL). Motivo:
//       milhares de invocações/dia na Vercel (qg-painel) com qg_campanhas vazia e o
//       piloto do atendente parado desde julho — estourava as 4h/mês de CPU do Hobby.
//       Religar = rodar deploy-com-campanha.mjs / deploy-com-atendente.mjs (só o secret).
//   2. Grupo de tráfego (TRAFEGO_GROUP_ID)       → GitHub repository_dispatch
//      (raro-meta-reports, pedidos sob demanda) — EXCLUSIVA: mensagens do
//      grupo nunca seguem pro hub RaRo; só remetentes de
//      TRAFEGO_ALLOWED_SENDERS disparam (bot/fromMe e terceiros são engolidos).
//   3. Grupo de reservas (RESERVAS_GROUP_IDS)    → Hub Reservas (HUB_WEBHOOK_URL + secret)
//   4. DM de consultora Noah (CONSULTORAS_IDS)   → n8n propostas (PROPOSTAS_WEBHOOK_URL)
//      — EXCLUSIVA: não segue para o hub RaRo. Só !fromMe. O número pessoal do
//      Rafa NÃO entra aqui (quebraria os comandos do RaRo Conteúdo).
//   5. DM do número autorizado começando com "qg" → assistente QG do Butiquim
//      (QG_ASSISTENTE_WEBHOOK_URL) — EXCLUSIVA: NÃO segue pro hub RaRo. O prefixo
//      "qg" é removido antes de encaminhar.
//   6. DM do Rafa (RAFA_PERSONAL_IDS)            → Hermes (service binding HERMES + secret)
//      decide sincronamente: assume se a mensagem começa com "hermes" ou se há
//      sessão ativa de 10 min ({handled:true}); caso contrário (ou se falhar) cai na rota 7.
//   7. Todo o resto                              → n8n RaRo hub v5 (RARO_N8N_WEBHOOK_URL)
//
// Deploy: node worker/deploy-worker.mjs (usa token OAuth do wrangler renovado).

function parseIds(csv) {
  return new Set(
    String(csv || '').split(',').map((s) => s.trim()).filter(Boolean)
  );
}

function extrairTexto(body) {
  if (body && body.text && typeof body.text.message === 'string') return body.text.message;
  if (typeof body.message === 'string') return body.message;
  if (body && body.hydratedTemplate && typeof body.hydratedTemplate === 'string') {
    return body.hydratedTemplate;
  }
  return '';
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('ok', { status: 200 });
    }
    const raw = await request.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      ctx.waitUntil(repassarN8n(env, raw));
      return new Response('ok', { status: 200 });
    }
    // Grupo "Estreia da Pillar" → página do nascimento (exclusivo, antes do Radar)
    if (
      body && body.isGroup === true && env.PILLAR_GROUP_ID &&
      typeof body.phone === 'string' && body.phone === env.PILLAR_GROUP_ID
    ) {
      ctx.waitUntil(repassarPillar(env, raw));
      return new Response('ok', { status: 200 });
    }
    // Grupo "📄 Gerador de Propostas RaRo" → Hermes em modo proposta (exclusivo)
    if (
      body && body.isGroup === true && env.PROPOSTAS_GROUP_ID &&
      typeof body.phone === 'string' && body.phone === env.PROPOSTAS_GROUP_ID
    ) {
      const remetente = typeof body.participantPhone === 'string' ? body.participantPhone.replace(/\D/g, '') : '';
      if (body.fromMe !== true && parseIds(env.RAFA_PERSONAL_IDS).has(remetente) && env.HERMES) {
        ctx.waitUntil(repassarHermesProposta(env, raw));
      }
      return new Response('ok', { status: 200 });
    }
    // Grupo "👶 Pillar – Saúde & Agenda" → Hermes em MODO PILLAR (exclusivo): os pais
    // contam o que aconteceu e o Hermes atualiza a agenda da Pillar (o Hermes filtra quem
    // pode falar: Rafa + Mariane). fromMe (respostas do Hermes e resumos do pg_cron) é engolido.
    if (
      body && body.isGroup === true && env.PILLAR_SAUDE_GROUP_ID &&
      typeof body.phone === 'string' && body.phone === env.PILLAR_SAUDE_GROUP_ID
    ) {
      if (body.fromMe !== true && env.HERMES) {
        ctx.waitUntil(repassarHermesModo(env, raw, 'pillar'));
      }
      return new Response('ok', { status: 200 });
    }
    // ESTÚDIO do Butiquim (14/10/2026) → Hermes em MODO ESTUDIO (exclusivo): pedidos de material,
    // noite cancelada e kit de artista. ESTUDIO_GROUP_ID aceita lista (hoje só o "🧪 Estúdio — teste").
    // O Hermes filtra quem pode falar (Victor + Rafa). fromMe (respostas do próprio Hermes) é engolido.
    if (
      body && body.isGroup === true && env.ESTUDIO_GROUP_ID && typeof body.phone === 'string' &&
      String(env.ESTUDIO_GROUP_ID).split(',').map((s) => s.trim()).includes(body.phone)
    ) {
      if (body.fromMe !== true && env.HERMES) {
        ctx.waitUntil(repassarHermesModo(env, raw, 'estudio'));
      }
      return new Response('ok', { status: 200 });
    }
    // Grupo "🎬 Vídeos RaRo & Prontto" → esteira de vídeos-clone (exclusivo):
    // o webhook do n8n filtra o remetente; aqui só barramos fromMe (respostas
    // da própria esteira) pra não criar loop.
    if (
      body && body.isGroup === true && env.VIDEOS_GROUP_ID &&
      typeof body.phone === 'string' && body.phone === env.VIDEOS_GROUP_ID
    ) {
      if (body.fromMe !== true) {
        ctx.waitUntil(repassarVideos(env, raw));
      }
      return new Response('ok', { status: 200 });
    }
    if (body && body.isGroup === true && body.fromMe !== true) {
      ctx.waitUntil(repassarRadar(env, raw));
    }
    // Grupos dos perfis "Mistérios" (MISTERIOS_GROUP_IDS, 14/11/2026): mensagem do Rafa → Coletor do grupo
    // (orafamartinelli.com.br/misterios/grupo, header X-Coletor-Segredo). ADITIVO: não dá return —
    // o grupo segue o caminho de sempre. fromMe (o próprio robô postando) e terceiros não são repassados.
    if (
      body && body.isGroup === true && body.fromMe !== true && env.MISTERIOS_GROUP_IDS &&
      env.MISTERIOS_GRUPO_URL && typeof body.phone === 'string' &&
      parseIds(env.MISTERIOS_GROUP_IDS).has(body.phone) &&
      parseIds(env.RAFA_PERSONAL_IDS).has(String(body.participantPhone || '').replace(/\D/g, ''))
    ) {
      ctx.waitUntil(repassarMisterios(env, raw));
    }
    // Grupo "📅 Conteúdo - O Butiquim" (STORYMAKER_GROUP_ID): resposta "OK 12" / "NÃO 14" de um
    // aprovador vira linha em butiquim_storymaker_respostas (o gatilho do banco agenda/descarta).
    // ADITIVO: não dá return — o grupo segue o caminho de sempre.
    if (
      body && body.isGroup === true && body.fromMe !== true && env.STORYMAKER_GROUP_ID &&
      body.phone === env.STORYMAKER_GROUP_ID
    ) {
      const remetente = typeof body.participantPhone === 'string' ? body.participantPhone.replace(/\D/g, '') : '';
      const texto = extrairTexto(body).trim();
      if (
        parseIds(env.STORYMAKER_APROVADORES).has(remetente) &&
        /^(ok|aprovo|aprovado|aprova|sim|n[aã]o|nao|recuso|recusa)\b/i.test(texto) &&
        typeof body.messageId === 'string' && body.messageId
      ) {
        ctx.waitUntil(gravarStorymaker(env, { message_id: body.messageId, remetente, texto }));
      }
    }
    // Fan-out ADITIVO p/ métricas de campanha do QG: status de entrega/leitura (têm
    // body.status) e respostas de botão (DM, isGroup!=grupo) vão TAMBÉM (fire-and-forget)
    // pro webhook de campanhas do QG, que filtra pelo message_id/telefone e ignora o resto.
    // Rollback: remover este bloco + repassarQgCampanha + deploy.
    if (body && (typeof body.status === 'string' || body.isGroup !== true)) {
      ctx.waitUntil(repassarQgCampanha(env, raw));
    }
    // Atendente/avaliação do QG (PILOTO): fan-out ADITIVO de QUALQUER DM (não-grupo, não-fromMe) pro
    // webhook de avaliação. Quem decide é o WEBHOOK: ele só processa se houver conversa de avaliação
    // ATIVA pra aquele telefone — e isso só existe pros números de teste do Rafa hoje (segurança pela
    // existência da conversa, não por lista de telefone no roteador, que era frágil quanto ao formato).
    // Aditivo (não dá return): não rouba o fluxo normal; a msg também segue pro RaRo Conteúdo (ruído
    // tolerável no piloto; na produção o número oficial da Meta tem webhook próprio e isso não ocorre).
    // Rollback: remover este bloco + repassarAtendente + deploy.
    if (body && body.fromMe !== true && body.isGroup !== true) {
      ctx.waitUntil(repassarAtendente(env, raw));
    }
    const reservasIds = parseIds(env.RESERVAS_GROUP_IDS);
    const isGroup = body && body.isGroup === true;
    const groupId = body && typeof body.phone === 'string' ? body.phone : '';
    // Grupo de tráfego: pedido do Rafa vira repository_dispatch (exclusivo)
    if (isGroup && env.TRAFEGO_GROUP_ID && groupId === env.TRAFEGO_GROUP_ID) {
      const remetente =
        body && typeof body.participantPhone === 'string' ? body.participantPhone : '';
      const permitidos = parseIds(env.TRAFEGO_ALLOWED_SENDERS);
      if (body.fromMe !== true && permitidos.has(remetente)) {
        const messageId = typeof body.messageId === 'string' ? body.messageId : '';
        const texto = extrairTexto(body);
        // Áudio (Fase 2a, 01/10/2026): a URL vai junto e o ondemand transcreve.
        const audioUrl =
          body && body.audio && typeof body.audio.audioUrl === 'string' ? body.audio.audioUrl : '';
        // `momment` da Z-API = epoch em ms; sem ele, o horário do roteador
        // (e a linha fica marcada como não confiável: SIM/NÃO dela não executa).
        const momment = new Date(typeof body.momment === 'number' ? body.momment : Date.now()).toISOString();
        if (texto || audioUrl) {
          ctx.waitUntil((async () => {
            if (messageId) { // sem id da Z-API não dá pra deduplicar: pula a fila, mantém o dispatch
              await gravarFila(env, {
                message_id: messageId, remetente, texto: texto || null,
                audio_url: audioUrl || null, momment,
                momment_confiavel: typeof body.momment === 'number',
              });
            }
            // Só repassa o horário que veio da Z-API: se o ondemand tiver que gravar a fila
            // sozinho (falha acima), sem `momment` ele marca a linha como não confiável.
            const mommentZapi = typeof body.momment === 'number' ? momment : '';
            await dispatchGithub(env, texto, remetente, messageId, mommentZapi, audioUrl);
          })());
        }
      }
      return new Response('ok', { status: 200 });
    }
    if (isGroup && reservasIds.has(groupId)) {
      if (body && body.fromMe === true) {
        return new Response('ok', { status: 200 });
      }
      const payload = {
        grupo_id: groupId,
        remetente: body && typeof body.participantPhone === 'string' ? body.participantPhone : groupId,
        texto: extrairTexto(body),
        from_me: false,
        // messageId da Z-API: o Hub usa p/ descartar re-entrega (dedup).
        message_id: body && typeof body.messageId === 'string' ? body.messageId : '',
      };
      ctx.waitUntil(encaminharHub(env, payload));
      return new Response('ok', { status: 200 });
    }
    // DM de consultora Noah → fluxo de propostas (exclusivo, não vai pro hub RaRo)
    const consultorasIds = parseIds(env.CONSULTORAS_IDS);
    if (!isGroup && body && body.fromMe !== true && consultorasIds.has(groupId)) {
      ctx.waitUntil(repassarPropostas(env, raw));
      return new Response('ok', { status: 200 });
    }
    // Assistente QG (gestão do Butiquim): DM do número autorizado que começa com "qg"
    // vai EXCLUSIVO pro QG (não passa pro RaRo Conteúdo → evita bot duplo). O prefixo
    // "qg" é retirado antes de encaminhar, pra IA receber a pergunta limpa.
    const qgFones = parseIds(env.QG_ASSISTENTE_FONES || '5544984232574');
    if (!isGroup && body && body.fromMe !== true && qgFones.has(groupId)) {
      const texto = extrairTexto(body);
      const m = texto.match(/^\s*qg\b[\s,:.\-]*([\s\S]*)$/i);
      if (m) {
        const limpo = m[1].trim() || texto.trim();
        const payloadQg = { ...body, text: { ...(body.text || {}), message: limpo } };
        ctx.waitUntil(repassarQg(env, JSON.stringify(payloadQg)));
        return new Response('ok', { status: 200 });
      }
    }
    // DM do Rafa: o Hermes decide se assume (prefixo "hermes" ou sessão ativa
    // de 10 min). Chamada via SERVICE BINDING (worker→worker por workers.dev é
    // bloqueado pela Cloudflare). Se não assumir — ou se falhar — segue o fluxo
    // normal pro hub RaRo, então os comandos do RaRo Conteúdo continuam intactos.
    const rafaIds = parseIds(env.RAFA_PERSONAL_IDS);
    if (!isGroup && body && body.fromMe !== true && rafaIds.has(groupId) && env.HERMES) {
      try {
        const decisaoResp = await env.HERMES.fetch('https://hermes-agent/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.HERMES_SECRET || ''}`,
          },
          body: raw,
        });
        if (decisaoResp.ok) {
          const decisao = await decisaoResp.json();
          if (decisao && decisao.handled === true) {
            return new Response('ok', { status: 200 });
          }
        }
      } catch (e) {
        console.log('hermes indisponível, seguindo pro hub RaRo:', String(e));
      }
    }
    ctx.waitUntil(repassarN8n(env, raw));
    return new Response('ok', { status: 200 });
  },
};

async function encaminharHub(env, payload) {
  if (!env.HUB_WEBHOOK_URL) return;
  try {
    await fetch(env.HUB_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GRUPO_WEBHOOK_SECRET || ''}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.log('falha ao encaminhar ao Hub:', String(e));
  }
}

// Spec §3.3 (Central Meta Ads): o roteador grava a mensagem ANTES de acordar
// o GitHub — a fila fica em ordem de chegada mesmo que as execuções acordem
// fora de ordem. Falha aqui nunca impede o dispatch (o ondemand grava sozinho
// como reserva).
async function gravarFila(env, linha) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !linha.message_id) return;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/meta_fila?on_conflict=message_id`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify([linha]),
    });
    if (!r.ok) console.log('meta_fila: HTTP', r.status);
  } catch (e) {
    console.log('falha ao gravar meta_fila:', String(e));
  }
}

// Storymaker (14/10/2026): grava a resposta de aprovação; o gatilho do banco faz o resto.
async function gravarStorymaker(env, linha) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/butiquim_storymaker_respostas?on_conflict=message_id`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify([linha]),
    });
    if (!r.ok) console.log('storymaker: HTTP', r.status);
  } catch (e) {
    console.log('falha ao gravar storymaker:', String(e));
  }
}

async function dispatchGithub(env, texto, remetente, messageId, momment, audioUrl) {
  if (!env.GH_DISPATCH_TOKEN || (!texto && !audioUrl)) return;
  try {
    await fetch(
      'https://api.github.com/repos/orafamartinelli/raro-meta-reports/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'raro-zapi-router',
        },
        body: JSON.stringify({
          event_type: 'whatsapp_request',
          client_payload: {
            text: texto, from: remetente, message_id: messageId,
            momment: momment || '', audio_url: audioUrl || '',
          },
        }),
      }
    );
  } catch (e) {
    console.log('falha no dispatch GitHub:', String(e));
  }
}

async function repassarHermesProposta(env, raw) {
  return repassarHermesModo(env, raw, 'proposta');
}

async function repassarHermesModo(env, raw, modo) {
  try {
    const r = await env.HERMES.fetch('https://hermes-agent/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.HERMES_SECRET || ''}`,
        'X-Hermes-Modo': modo,
      },
      body: raw,
    });
    if (!r.ok) console.log(`hermes (${modo}) respondeu`, r.status);
  } catch (e) {
    console.log(`falha ao repassar ao Hermes (${modo}):`, String(e));
  }
}

async function repassarPillar(env, raw) {
  if (!env.PILLAR_WEBHOOK_URL) return;
  try {
    await fetch(env.PILLAR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar Pillar:', String(e));
  }
}

async function repassarVideos(env, raw) {
  if (!env.VIDEOS_WEBHOOK_URL) return;
  try {
    await fetch(env.VIDEOS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar à esteira de vídeos:', String(e));
  }
}

async function repassarMisterios(env, raw) {
  try {
    const r = await fetch(env.MISTERIOS_GRUPO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Coletor-Segredo': env.MISTERIOS_GRUPO_SEGREDO || '' },
      body: raw,
    });
    if (!r.ok) console.log('coletor Mistérios respondeu', r.status);
  } catch (e) {
    console.log('falha ao repassar ao coletor Mistérios:', String(e));
  }
}

async function repassarRadar(env, raw) {
  if (!env.RADAR_WEBHOOK_URL) return;
  try {
    await fetch(env.RADAR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar ao Radar:', String(e));
  }
}

async function repassarPropostas(env, raw) {
  if (!env.PROPOSTAS_WEBHOOK_URL) return;
  try {
    await fetch(env.PROPOSTAS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar propostas:', String(e));
  }
}

async function repassarQg(env, raw) {
  if (!env.QG_ASSISTENTE_WEBHOOK_URL) return;
  try {
    await fetch(env.QG_ASSISTENTE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar ao QG:', String(e));
  }
}

async function repassarQgCampanha(env, raw) {
  if (!env.QG_CAMPANHA_WEBHOOK_URL) return;
  try {
    await fetch(env.QG_CAMPANHA_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar ao QG campanha:', String(e));
  }
}

async function repassarAtendente(env, raw) {
  if (!env.QG_ATENDENTE_WEBHOOK_URL) return;
  try {
    await fetch(env.QG_ATENDENTE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar ao atendente QG:', String(e));
  }
}

async function repassarN8n(env, raw) {
  if (!env.RARO_N8N_WEBHOOK_URL) return;
  try {
    await fetch(env.RARO_N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
  } catch (e) {
    console.log('falha ao repassar ao n8n:', String(e));
  }
}
