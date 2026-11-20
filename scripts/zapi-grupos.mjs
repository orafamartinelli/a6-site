// Só leitura: lista grupos da central (Z-API) cujo nome bate com o filtro e mostra a config de webhook.
import fs from 'node:fs';
const Z = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/z-api-rafa-pessoal.json', 'utf8'));
const B = `https://api.z-api.io/instances/${Z.instance_id}/token/${Z.instance_token}`;
const H = { 'Client-Token': Z.client_token };
const filtro = new RegExp(process.argv[2] || 'impren|a6|assessoria|wallace', 'i');
const me = await (await fetch(B + '/me', { headers: H })).json();
console.log('central conectada:', me.connected, '| webhook recebido ->', me.receivedCallbackUrl);
let pagina = 1, achados = [];
while (pagina < 15) {
  const r = await (await fetch(`${B}/groups?page=${pagina}&pageSize=100`, { headers: H })).json();
  if (!Array.isArray(r) || !r.length) break;
  achados.push(...r.filter(g => filtro.test(g.name || '')));
  pagina++;
}
for (const g of achados) {
  const m = await (await fetch(`${B}/group-metadata/${g.phone}`, { headers: H })).json();
  const wallace = (m.participants || []).some(p => String(p.phone).includes('88704900'));
  console.log(`- ${g.name} | ${g.phone} | ${m.participants?.length} pessoas | Wallace no grupo: ${wallace} | só admin fala: ${m.adminOnlyMessage}`);
}
if (!achados.length) console.log('nenhum grupo com esse nome onde a central participa');
