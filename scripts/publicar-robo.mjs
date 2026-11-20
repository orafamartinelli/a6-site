// Publica o vigia a6-site-robo (Cloudflare Worker) com os segredos do cofre. Uso: node scripts/publicar-robo.mjs [--segredos]
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execSync } from 'node:child_process';
const D = 'C:/Users/User/Documents/projetos/.credentials/';
const j = f => JSON.parse(fs.readFileSync(D + f, 'utf8'));
const cofre = j('a6-site-robo.json');
if (!cofre.link_key) { cofre.link_key = crypto.randomBytes(12).toString('hex'); fs.writeFileSync(D + 'a6-site-robo.json', JSON.stringify(cofre, null, 2)); }
const token = execSync('node C:/Users/User/Documents/projetos/butiquim-lista/renova-token.mjs', { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
const env = { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: '57200dd7ed7c5dfbbd795fdf1956bd36' };
const DIR = path.resolve(import.meta.dirname, '..', 'robo');
execSync('npx --yes wrangler@4 deploy', { cwd: DIR, env, stdio: 'inherit' });
if (process.argv.includes('--segredos')) {
  const o = j('google-butiquim-oauth.json'), cal = j('google-calendar-rafa.json');
  const tmp = 'C:/tmp/a6-robo-segredos.json';
  fs.writeFileSync(tmp, JSON.stringify({
    GOOGLE_CLIENT_ID: cal.client_id || cal.installed?.client_id || cal.web?.client_id,
    GOOGLE_CLIENT_SECRET: cal.client_secret || cal.installed?.client_secret || cal.web?.client_secret,
    GOOGLE_REFRESH_TOKEN: o.refresh_token, A6_DISPARO_KEY: cofre.a6_disparo_key, LINK_KEY: cofre.link_key,
    META_CAPI_TOKEN: j('meta-capi-a6-q2.json').token_capi,
    RESEND_KEY: (r => r.api_key?.key || r.api_key || r.key)(j('resend.json')),
    ZAPI_INSTANCE_ID: j('z-api-rafa-pessoal.json').instance_id, ZAPI_TOKEN: j('z-api-rafa-pessoal.json').instance_token, ZAPI_CLIENT_TOKEN: j('z-api-rafa-pessoal.json').client_token,
  }));
  try { execSync(`npx --yes wrangler@4 secret bulk ${tmp}`, { cwd: DIR, env, stdio: 'inherit' }); } finally { fs.rmSync(tmp, { force: true }); }
}
