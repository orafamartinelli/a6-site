// Abre as páginas espelhadas no celular simulado, rola até o fim e lista arquivos que faltaram (404) e imagens quebradas.
// Bloqueia envios de pixel/GA/CRM para não sujar nada. Uso: NODE_PATH=... node scripts/conferir-espelho.mjs <base>
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/');
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:18433';
const browser = await chromium.launch({ channel: 'chrome' });
for (const p of ['/vivasuperia/', '/superia-rock/']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  await ctx.route(/facebook\.com\/tr|google-analytics|supabase\.co|crm\/api|nicochat/, r => r.fulfill({ status: 204, body: '' }));
  const page = await ctx.newPage();
  const falta = new Set();
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) falta.add(r.status() + ' ' + r.url().slice(base.length)); });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message.slice(0, 120)));
  await page.goto(base + p, { waitUntil: 'networkidle' });
  for (let y = 0; y < 30; y++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(120); }
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ titulo: document.title, canonical: document.querySelector('link[rel=canonical]')?.href, quebradas: [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.src).map(i => i.src.split('/').slice(-3).join('/')), botoesForm: document.querySelectorAll('[data-modal-open], form').length }));
  await page.screenshot({ path: `C:/tmp/a6shots/espelho${p.replaceAll('/', '-')}.png` });
  console.log(`\n${p} — ${info.titulo}\n  canonical: ${info.canonical}\n  formulários/botões: ${info.botoesForm}\n  404: ${[...falta].join(', ') || 'nenhum'}\n  imagens quebradas: ${info.quebradas.join(', ') || 'nenhuma'}\n  erros JS: ${erros.join(' | ') || 'nenhum'}`);
  await ctx.close();
}
await browser.close();
