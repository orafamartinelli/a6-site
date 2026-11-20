// Ensaio das tags da versão OFICIAL sem sujar nada: carrega gtag/fbevents/rastreio, mas BLOQUEIA os envios
// (google-analytics collect, facebook.com/tr, supabase lp_eventos) e só registra o que iria.
// Uso: NODE_PATH=<projeto com playwright>/node_modules node scripts/ensaio-tags.mjs http://127.0.0.1:18432
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/');
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:18432';
const enviados = [];
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false })); // o pixel se cala com robô
await ctx.route(/google-analytics\.com\/.*collect|googletagmanager\.com\/.*collect|facebook\.com\/tr|supabase\.co\/rest/, async route => {
  const u = new URL(route.request().url());
  const corpo = route.request().postData() || '';
  if (u.host.includes('facebook')) enviados.push(`META   ${u.searchParams.get('ev')} id=${u.searchParams.get('id')}${u.searchParams.get('eid') ? ' eid=' + u.searchParams.get('eid') : ''}`);
  else if (u.host.includes('supabase')) { try { const j = JSON.parse(corpo); enviados.push(`FUNIL  ${j.evento} ${j.valor ?? ''} ${j.rotulo ?? ''} site=${j.site}`); } catch { enviados.push('FUNIL ?'); } }
  else { const linhas = (u.search + '\n' + corpo).split('\n'); for (const l of linhas) { const p = new URLSearchParams(l.replace(/^\?/, '')); if (p.get('en')) enviados.push(`GA4    ${p.get('en')} tid=${p.get('tid') || u.searchParams.get('tid')}`); } }
  await route.fulfill({ status: 204, body: '' });
});
const page = await ctx.newPage();
page.on('popup', p => p.close());
page.on('requestfailed', r => { if (/facebook|fbevents/.test(r.url())) enviados.push('FALHOU ' + r.url().slice(0, 90) + ' ' + r.failure()?.errorText); });
page.on('response', r => { if (/fbevents|signals\/config/.test(r.url())) enviados.push(`CARREGOU ${r.status()} ${r.url().slice(0, 80)}`); });
await page.goto(base + '/?rastreio_teste=1', { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelectorAll('a[target=_blank]').forEach(a => a.addEventListener('click', e => e.preventDefault())));
await page.mouse.wheel(0, 3000); await page.waitForTimeout(800);
await page.click('.wa-flutuante'); await page.waitForTimeout(600);
await page.click('.evento .bt'); await page.waitForTimeout(1500);
await page.goto(base + '/contato/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const tags = await page.evaluate(() => ({ gtag: typeof gtag, fbq: typeof fbq, fbqCarregado: !!(window.fbq && fbq.loaded && fbq.getState), pixels: window.fbq && fbq.getState ? fbq.getState().pixels.map(p => p.id) : null, rastreio: window.RastreioLP && RastreioLP.site, fbp: document.cookie.includes('_fbp') }));
await browser.close();
console.log('tags na página:', JSON.stringify(tags));
console.log([...new Set(enviados)].join('\n'));
