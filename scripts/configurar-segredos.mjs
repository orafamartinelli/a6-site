// Grava os segredos do robô no repositório (lê do cofre local; usa --body, nunca pipe).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const D = 'C:/Users/User/Documents/projetos/.credentials/';
const j = f => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const o = j('google-butiquim-oauth.json'), cal = j('google-calendar-rafa.json'), cf = j('cloudflare-api-token.json'), z = j('z-api-rafa-pessoal.json');
const seg = {
  GOOGLE_CLIENT_ID: cal.client_id || cal.installed?.client_id || cal.web?.client_id,
  GOOGLE_CLIENT_SECRET: cal.client_secret || cal.installed?.client_secret || cal.web?.client_secret,
  GOOGLE_REFRESH_TOKEN: o.refresh_token,
  CLOUDFLARE_API_TOKEN: cf.token || cf.api_token || cf.CLOUDFLARE_API_TOKEN || cf.value,
  CLOUDFLARE_ACCOUNT_ID: cf.account_id || cf.accountId || '57200dd7ed7c5dfbbd795fdf1956bd36',
  ZAPI_INSTANCE_ID: z.instance_id, ZAPI_TOKEN: z.instance_token, ZAPI_CLIENT_TOKEN: z.client_token,
};
for (const [k, v] of Object.entries(seg)) {
  if (!v) { console.log('FALTA', k); continue; }
  execFileSync('gh', ['secret', 'set', k, '-R', 'orafamartinelli/a6-site', '--body', String(v).trim()], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log('ok', k);
}
