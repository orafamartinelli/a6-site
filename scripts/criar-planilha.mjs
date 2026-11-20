// Cria (uma vez) a planilha "Agenda do site A6" + pasta "Banners do site" dentro de A6 Produções/Site novo,
// já preenchidas com os 3 eventos atuais. Grava os IDs em conteudo/drive.json.
import fs from 'node:fs';
import path from 'node:path';
import { g, DRIVE, SHEETS, qs } from './google.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const CFG = path.join(RAIZ, 'conteudo', 'drive.json');
if (fs.existsSync(CFG)) { console.log('já existe:', fs.readFileSync(CFG, 'utf8')); process.exit(0); }

const busca = await g(`${DRIVE}/files?` + qs({ q: "name='Site novo' and mimeType='application/vnd.google-apps.folder' and trashed=false", fields: 'files(id,name,parents)' }));
const siteNovo = busca.files[0]; if (!siteNovo) throw new Error('pasta Site novo não encontrada');
console.log('pasta Site novo:', siteNovo.id);

// pasta de banners
const pasta = await g(`${DRIVE}/files?` + qs({ fields: 'id' }), { method: 'POST', body: JSON.stringify({ name: 'Banners do site', mimeType: 'application/vnd.google-apps.folder', parents: [siteNovo.id] }) });

// sobe os banners atuais
const banners = {
  'ce-ta-doido-cascavel.png': 'https://a6producoes.com.br/wp-content/uploads/2026/08/1120X640_CTD.png',
  'zeze-sunset-maringa.webp': 'https://a6producoes.com.br/wp-content/uploads/2026/10/44594.webp',
  'superia-rock-foz.webp': 'https://a6producoes.com.br/wp-content/uploads/2026/10/SUPERIAROCK_1600x900.webp',
};
for (const [nome, url] of Object.entries(banners)) {
  const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
  const meta = JSON.stringify({ name: nome, parents: [pasta.id] });
  const fronteira = 'a6fronteira';
  const corpo = Buffer.concat([
    Buffer.from(`--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${fronteira}\r\nContent-Type: application/octet-stream\r\n\r\n`),
    bin, Buffer.from(`\r\n--${fronteira}--`)]);
  await g('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', { method: 'POST', body: corpo, headers: { 'Content-Type': `multipart/related; boundary=${fronteira}` } });
  console.log('banner enviado:', nome);
}

const CAB = ['No ar?', 'Evento', 'Subtítulo (opcional)', 'Cidade/UF', 'Local', 'Data do show', 'Horário (opcional)', 'Link do ingresso', 'Texto do botão', 'Arquivo do banner (nome na pasta)', 'Entra no site em', 'Sai do site em', 'No carrossel da home?', 'Texto da página do show (opcional)'];
const linhas = [
  ['SIM', 'Cê Tá Doido', '', 'Cascavel/PR', 'Cascavel/PR', '05/12/2026', '', 'https://www.vaideingresso.com.br/ce-ta-doido-cascavel', 'Compre seu ingresso', 'ce-ta-doido-cascavel.png', '01/11/2026 00:00', '06/12/2026 06:00', 'SIM', ''],
  ['SIM', 'Sunset Experience — Zezé Di Camargo & Luciano', 'Na Represa · First Edition · a partir das 16h', 'Maringá/PR', 'Represa Sendeski, Maringá/PR', '05/12/2026', '16:00', 'https://q2ingressos.com.br/events/sunset-experience-na-represa-com-zeze-di-camargo-luciano', 'Compre seu ingresso', 'zeze-sunset-maringa.webp', '01/11/2026 00:00', '06/12/2026 06:00', 'SIM', ''],
  ['SIM', 'Superia Rock — Humberto Gessinger', 'Experiência imersiva no Wish Foz do Iguaçu', 'Foz do Iguaçu/PR', 'Wish Foz do Iguaçu', '11/12/2026', '', 'https://superia-gessinger.vercel.app/imersiva', 'Garanta sua vaga', 'superia-rock-foz.webp', '01/11/2026 00:00', '12/12/2026 06:00', 'SIM', ''],
];
const CAB_B = ['No ar?', 'Texto do botão', 'Link', 'Cor (vinho, magenta, agua, roxo)', 'Entra no site em', 'Sai do site em'];
const BOT = [['SIM', 'Viva Superia 2027', 'https://vivasuperia-site.vercel.app/', 'magenta', '01/11/2026 00:00', '01/03/2027 00:00']];
const LEIA = [
  ['Como usar esta planilha'],
  ['1. Cada linha da aba Agenda é um show. Preencha e o site se atualiza sozinho em até ~3 minutos.'],
  ['2. Suba a arte do banner na pasta "Banners do site" (mesma pasta desta planilha) e escreva o nome do arquivo na coluna "Arquivo do banner". Tamanho ideal 1120 x 640.'],
  ['3. "Entra no site em" e "Sai do site em": dia e hora (horário de Brasília) em que o show aparece e some da agenda. Formato 05/12/2026 18:00.'],
  ['4. "No ar?" = NÃO tira o show do site na hora, sem apagar a linha.'],
  ['5. "No carrossel da home?" = SIM coloca o banner grande no topo da página inicial.'],
  ['6. Cada show ganha uma página própria (a6producoes.com.br/eventos/nome-do-show/). Depois da data ela continua no ar como "evento realizado".'],
  ['7. Aba Botões: botões coloridos da home (ex.: Viva Superia), também com data de entrada e saída.'],
  ['Não mude a ordem nem o nome das colunas.'],
];

const plan = await g(SHEETS, { method: 'POST', body: JSON.stringify({
  properties: { title: 'Agenda do site A6', locale: 'pt_BR', timeZone: 'America/Sao_Paulo' },
  sheets: [{ properties: { title: 'Agenda', gridProperties: { frozenRowCount: 1 } } }, { properties: { title: 'Botões', gridProperties: { frozenRowCount: 1 } } }, { properties: { title: 'Leia-me' } }],
}) });
const id = plan.spreadsheetId;
const sid = Object.fromEntries(plan.sheets.map(s => [s.properties.title, s.properties.sheetId]));
await g(`${SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: [
  { range: 'Agenda!A1', values: [CAB, ...linhas] }, { range: 'Botões!A1', values: [CAB_B, ...BOT] }, { range: 'Leia-me!A1', values: LEIA }] }) });

const simNao = (sheetId, col) => ({ setDataValidation: { range: { sheetId, startRowIndex: 1, endRowIndex: 200, startColumnIndex: col, endColumnIndex: col + 1 }, rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'SIM' }, { userEnteredValue: 'NÃO' }] }, showCustomUi: true, strict: true } } });
const negritoCab = sheetId => ({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, backgroundColor: { red: 0.196, green: 0.067, blue: 0.4 }, wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(textFormat,backgroundColor,wrapStrategy)' } });
const largura = (sheetId, n, px) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: n }, properties: { pixelSize: px }, fields: 'pixelSize' } });
await g(`${SHEETS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [
  negritoCab(sid.Agenda), negritoCab(sid['Botões']), simNao(sid.Agenda, 0), simNao(sid.Agenda, 12), simNao(sid['Botões'], 0),
  largura(sid.Agenda, 14, 170), largura(sid['Botões'], 6, 190), largura(sid['Leia-me'], 1, 900),
  { repeatCell: { range: { sheetId: sid['Leia-me'], startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 14 } } }, fields: 'userEnteredFormat.textFormat' } },
] }) });

// move a planilha para a pasta Site novo
const atual = await g(`${DRIVE}/files/${id}?` + qs({ fields: 'parents' }));
await g(`${DRIVE}/files/${id}?` + qs({ addParents: siteNovo.id, removeParents: (atual.parents || []).join(','), fields: 'id' }), { method: 'PATCH', body: '{}' });

const out = { planilha: id, pastaBanners: pasta.id, pastaSiteNovo: siteNovo.id, criadoEm: new Date().toISOString() };
fs.writeFileSync(CFG, JSON.stringify(out, null, 2));
console.log(out, `\nhttps://docs.google.com/spreadsheets/d/${id}/edit`);
