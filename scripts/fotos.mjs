// Fotos da prévia em celular e PC. Uso: NODE_PATH=<algum>/node_modules node scripts/fotos.mjs <base> <pasta>
import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH + '/');
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:18431';
const pasta = process.argv[3] || 'C:/tmp/a6shots';
const paginas = ['/', '/programacao-e-ingressos/', '/imprensa/', '/de-campanha-viral-a-show-confirmado-zeze-di-camargo-chega-a-cascavel-neste-sabado-apos-mobilizacao-dos-fas/', '/contato/'];
const browser = await chromium.launch({ channel: 'chrome' });
for (const [nome, ctxOpt] of [['cel', devices['iPhone 13']], ['pc', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(ctxOpt);
  const page = await ctx.newPage();
  for (const [i, p] of paginas.entries()) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    const estouro = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const quebradas = await page.evaluate(() => [...document.images].filter(im => im.complete && im.naturalWidth === 0).length);
    console.log(nome, p.slice(0, 40), 'estouro lateral:', estouro, 'px | imagens quebradas:', quebradas);
    if (i < 3 || nome === 'cel') await page.screenshot({ path: `${pasta}/${nome}-${i}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
