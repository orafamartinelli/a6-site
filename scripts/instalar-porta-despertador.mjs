// Uma vez: cria a chave A6_DISPARO_KEY (cofre a6-site-robo.json), grava como segredo do worker butiquim-reguas e publica ele.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
const COFRE = 'C:/Users/User/Documents/projetos/.credentials/a6-site-robo.json';
const cofre = fs.existsSync(COFRE) ? JSON.parse(fs.readFileSync(COFRE, 'utf8')) : {};
if (!cofre.a6_disparo_key) {
  cofre.a6_disparo_key = crypto.randomBytes(24).toString('hex');
  cofre.servico = 'Robô do site A6: porta /disparar-a6-site no worker butiquim-reguas (despertador) + vigia a6-site-robo';
  cofre.criado_em = new Date().toISOString();
  fs.writeFileSync(COFRE, JSON.stringify(cofre, null, 2));
}
const token = execSync('node C:/Users/User/Documents/projetos/butiquim-lista/renova-token.mjs', { encoding: 'utf8' }).trim().split(/\r?\n/).pop();
const env = { ...process.env, CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: '57200dd7ed7c5dfbbd795fdf1956bd36' };
const tmp = 'C:/tmp/a6-segredo.json';
fs.writeFileSync(tmp, JSON.stringify({ A6_DISPARO_KEY: cofre.a6_disparo_key }));
const DIR = 'C:/Users/User/Documents/projetos/butiquim-reguas';
try {
  execSync(`npx --yes wrangler@4 secret bulk ${tmp}`, { cwd: DIR, env, stdio: 'inherit' });
} finally { fs.rmSync(tmp, { force: true }); }
execSync('npx --yes wrangler@4 deploy', { cwd: DIR, env, stdio: 'inherit' });
