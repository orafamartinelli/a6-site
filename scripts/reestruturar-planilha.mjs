// Simplifica a planilha para a Bianca: pasta própria "Agenda do site A6" (planilha + Banners do site),
// aba Agenda com 5 colunas obrigatórias + 5 opcionais, calendário nas datas, caixinha "Pausar" e Leia-me curto.
import fs from 'node:fs';
import path from 'node:path';
import { g, DRIVE, SHEETS, qs } from './google.mjs';

const CFG = path.resolve(import.meta.dirname, '..', 'conteudo', 'drive.json');
const drive = JSON.parse(fs.readFileSync(CFG, 'utf8'));

// 1) pasta própria
if (!drive.pastaAgenda) {
  const p = await g(`${DRIVE}/files?` + qs({ fields: 'id' }), { method: 'POST', body: JSON.stringify({ name: 'Agenda do site A6', mimeType: 'application/vnd.google-apps.folder', parents: [drive.pastaSiteNovo] }) });
  drive.pastaAgenda = p.id;
  for (const id of [drive.planilha, drive.pastaBanners]) {
    const atual = await g(`${DRIVE}/files/${id}?` + qs({ fields: 'parents' }));
    await g(`${DRIVE}/files/${id}?` + qs({ addParents: p.id, removeParents: (atual.parents || []).join(','), fields: 'id' }), { method: 'PATCH', body: '{}' });
  }
  fs.writeFileSync(CFG, JSON.stringify(drive, null, 2));
  console.log('pasta criada e itens movidos:', p.id);
}

// 2) aba Agenda simplificada
const CAB = ['Evento', 'Cidade', 'Data do show', 'Link do ingresso', 'Banner (nome do arquivo)', 'Local (opcional)', 'Horário (opcional)', 'Aparece no site a partir de (opcional)', 'Sai do site em (opcional)', 'Pausar'];
const NOTAS = [
  'Nome do show, como deve aparecer no site.', 'Ex.: Maringá/PR', 'Dê dois cliques para abrir o calendário.', 'Link oficial de venda (começa com https://).',
  'Nome do arquivo que você subiu na pasta "Banners do site". Tamanho ideal 1120 x 640.', 'Ex.: Represa Sendeski. Se vazio, usa a cidade.', 'Ex.: 20:00',
  'Vazio = aparece já. Use para programar a entrada.', 'Vazio = sai sozinho no dia seguinte ao show.', 'Marque para esconder o show do site na hora, sem apagar a linha.',
];
const linhas = [
  ['Cê Tá Doido', 'Cascavel/PR', '05/12/2026', 'https://www.vaideingresso.com.br/ce-ta-doido-cascavel', 'ce-ta-doido-cascavel.png', '', '', '01/11/2026', '', false],
  ['Sunset Experience — Zezé Di Camargo & Luciano', 'Maringá/PR', '05/12/2026', 'https://q2ingressos.com.br/events/sunset-experience-na-represa-com-zeze-di-camargo-luciano', 'zeze-sunset-maringa.webp', 'Represa Sendeski, Maringá/PR', '16:00', '01/11/2026', '', false],
  ['Superia Rock — Humberto Gessinger', 'Foz do Iguaçu/PR', '11/12/2026', 'https://superia-gessinger.vercel.app/imersiva', 'superia-rock-foz.webp', 'Wish Foz do Iguaçu', '', '01/11/2026', '', false],
];
const LEIA = [
  ['Como colocar um show no site da A6'],
  ['1. Suba a arte do banner na pasta "Banners do site" (fica ao lado desta planilha).'],
  ['2. Na aba Agenda, preencha uma linha: Evento, Cidade, Data, Link do ingresso e o nome do arquivo do banner.'],
  ['3. Pronto. Em até ~5 minutos o show aparece no site, com página própria, e sai sozinho depois da data.'],
  ['Para tirar do ar na hora: marque a caixinha "Pausar". Para programar a entrada: preencha "Aparece no site a partir de".'],
  ['As colunas cinzas são opcionais. Não mude a ordem nem o nome das colunas.'],
  [''],
  [''],
];

const info = await g(`${SHEETS}/${drive.planilha}?fields=sheets.properties`);
const sid = Object.fromEntries(info.sheets.map(s => [s.properties.title, s.properties.sheetId]));
await g(`${SHEETS}/${drive.planilha}/values:batchClear`, { method: 'POST', body: JSON.stringify({ ranges: ['Agenda!A1:Z500', 'Leia-me!A1:A10'] }) });
await g(`${SHEETS}/${drive.planilha}/values:batchUpdate`, { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: [
  { range: 'Agenda!A1', values: [CAB, ...linhas] }, { range: 'Leia-me!A1', values: LEIA }] }) });

const A = sid.Agenda, rng = (c1, c2, r1 = 1, r2 = 300) => ({ sheetId: A, startRowIndex: r1, endRowIndex: r2, startColumnIndex: c1, endColumnIndex: c2 });
const cor = (r, gg, b) => ({ red: r, green: gg, blue: b });
await g(`${SHEETS}/${drive.planilha}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [
  // limpa validações antigas e cria as novas
  { setDataValidation: { range: rng(0, 26, 1, 500) } },
  { setDataValidation: { range: rng(2, 3), rule: { condition: { type: 'DATE_IS_VALID' }, strict: true, inputMessage: 'Dois cliques abrem o calendário' } } },
  { setDataValidation: { range: rng(7, 9), rule: { condition: { type: 'DATE_IS_VALID' }, strict: true, inputMessage: 'Dois cliques abrem o calendário' } } },
  { setDataValidation: { range: rng(9, 10), rule: { condition: { type: 'BOOLEAN' } } } },
  { repeatCell: { range: rng(2, 3), cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } },
  { repeatCell: { range: rng(7, 9), cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd/mm/yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } },
  // cabeçalho: obrigatórias roxas, opcionais cinzas
  { repeatCell: { range: rng(0, 5, 0, 1), cell: { userEnteredFormat: { backgroundColor: cor(0.196, 0.067, 0.4), textFormat: { bold: true, foregroundColor: cor(1, 1, 1) }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)' } },
  { repeatCell: { range: rng(5, 10, 0, 1), cell: { userEnteredFormat: { backgroundColor: cor(0.85, 0.85, 0.87), textFormat: { bold: true, foregroundColor: cor(0.2, 0.2, 0.2) }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)' } },
  { updateDimensionProperties: { range: { sheetId: A, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 }, properties: { pixelSize: 180 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: A, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 300 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: A, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 300 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: A, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 80 }, fields: 'pixelSize' } },
  { updateDimensionProperties: { range: { sheetId: A, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
  { updateCells: { range: rng(0, 10, 0, 1), rows: [{ values: NOTAS.map(n => ({ note: n })) }], fields: 'note' } },
  { updateSheetProperties: { properties: { sheetId: A, index: 0 }, fields: 'index' } },
  { updateSheetProperties: { properties: { sheetId: sid['Leia-me'], index: 1 }, fields: 'index' } },
  { updateSheetProperties: { properties: { sheetId: sid['Botões'], title: 'Botões da home (avançado)', index: 2 }, fields: 'title,index' } },
] }) });
console.log('planilha simplificada. pasta:', `https://drive.google.com/drive/folders/${drive.pastaAgenda}`);
