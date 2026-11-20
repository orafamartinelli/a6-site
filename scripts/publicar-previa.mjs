// Publica site/ como prévia no Cloudflare Pages (projeto a6-site-previa), com o token do cofre.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const cofre = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/cloudflare-api-token.json', 'utf8'));
const token = cofre.token || cofre.api_token || cofre.CLOUDFLARE_API_TOKEN || cofre.value;
const conta = cofre.account_id || cofre.accountId || cofre.CLOUDFLARE_ACCOUNT_ID || '57200dd7ed7c5dfbbd795fdf1956bd36';
if (!token) { console.error('token não encontrado; campos:', Object.keys(cofre)); process.exit(1); }
const env = { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: conta };
const site = path.resolve(import.meta.dirname, '..', 'site');
const PROJ = 'a6-site-previa';
// cria o projeto se ainda não existe
const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/pages/projects/${PROJ}`, { headers: { Authorization: 'Bearer ' + token } });
if (r.status === 404) {
  const c = await fetch(`https://api.cloudflare.com/client/v4/accounts/${conta}/pages/projects`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: PROJ, production_branch: 'main' }) });
  console.log('projeto criado:', c.status, (await c.json()).success);
} else console.log('projeto existe:', r.status);
execSync(`npx --yes wrangler@4 pages deploy . --project-name=${PROJ} --branch=main --commit-dirty=true`, { cwd: site, env, stdio: 'inherit' });
