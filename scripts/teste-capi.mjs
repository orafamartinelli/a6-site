// Testa o token CAPI do pixel "Camarote A6" com um Lead marcado como TESTE (não conta nos relatórios).
import fs from 'node:fs';
import crypto from 'node:crypto';
const c = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/meta-capi-a6-q2.json', 'utf8'));
const h = s => crypto.createHash('sha256').update(s).digest('hex');
const corpo = { data: [{ event_name: 'Lead', event_time: Math.floor(Date.now() / 1000), event_id: 'teste-' + Date.now(), action_source: 'website',
  event_source_url: 'https://a6-site-previa.pages.dev/contato/', user_data: { em: [h('teste@exemplo.com')], country: [h('br')], client_user_agent: 'teste-homer' },
  custom_data: { content_name: 'contato-site' } }], test_event_code: 'TEST_A6SITE' };
const r = await fetch(`https://graph.facebook.com/v21.0/${c.pixel_id}/events?access_token=${c.token_capi}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
console.log(r.status, JSON.stringify(await r.json()));
