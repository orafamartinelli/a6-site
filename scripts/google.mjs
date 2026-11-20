// Acesso Google (Drive + Sheets) da conta rafa@obutiquim.com.br.
// No GitHub Actions vem de GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN;
// localmente lê do cofre (.credentials).
import fs from 'node:fs';

function credenciais() {
  if (process.env.GOOGLE_REFRESH_TOKEN) return { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, refresh: process.env.GOOGLE_REFRESH_TOKEN };
  const D = 'C:/Users/User/Documents/projetos/.credentials/';
  const o = JSON.parse(fs.readFileSync(D + 'google-butiquim-oauth.json', 'utf8'));
  const c = JSON.parse(fs.readFileSync(D + 'google-calendar-rafa.json', 'utf8'));
  return { id: c.client_id || c.installed?.client_id || c.web?.client_id, secret: c.client_secret || c.installed?.client_secret || c.web?.client_secret, refresh: o.refresh_token };
}

let cache = null;
export async function token() {
  if (cache && cache.ate > Date.now()) return cache.t;
  const c = credenciais();
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: c.refresh, grant_type: 'refresh_token' }) })).json();
  if (!r.access_token) throw new Error('Google recusou o token: ' + JSON.stringify(r));
  cache = { t: r.access_token, ate: Date.now() + (r.expires_in - 120) * 1000 };
  return cache.t;
}

export async function g(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + await token(), ...(opt.body && typeof opt.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${opt.method || 'GET'} ${url.slice(0, 120)} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.headers.get('content-type')?.includes('json') ? r.json() : r;
}

export const DRIVE = 'https://www.googleapis.com/drive/v3';
export const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const qs = o => new URLSearchParams({ supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', ...o });
