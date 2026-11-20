// Robô da agenda: lê a planilha "Agenda do site A6" + pasta "Banners do site" (Drive)
// e grava conteudo/agenda.json + conteudo/eventos-historico.json + banners WebP.
// Saída extra: conteudo/agenda-relatorio.json (avisos de linha com problema).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { g, DRIVE, SHEETS, qs } from './google.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const C = f => path.join(RAIZ, 'conteudo', f);
const drive = JSON.parse(fs.readFileSync(C('drive.json'), 'utf8'));
const PASTA_IMG = path.join(RAIZ, 'site', 'assets', 'img', 'eventos');
fs.mkdirSync(PASTA_IMG, { recursive: true });

const avisos = [];
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = s => semAcento(s).toLowerCase().replace(/&/g, ' e ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const sim = v => /^s/i.test(String(v || '').trim());

// "05/12/2026", "05/12/2026 18:00", "05/12/2026 18:00:00", "2026-12-05"
function dataBR(v, horaPadrao = '00:00') {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const a = m[3].length === 2 ? '20' + m[3] : m[3];
    const h = m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : horaPadrao;
    return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${h}:00-03:00`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${horaPadrao}:00-03:00`;
  return null;
}
const somaDias = (iso, d) => new Date(Date.parse(iso) + d * 864e5).toISOString();

// lê a aba e devolve cada linha como objeto pelo NOME da coluna (a ordem pode mudar sem quebrar)
async function aba(...nomes) {
  for (const nome of nomes) {
    try {
      const r = await g(`${SHEETS}/${drive.planilha}/values/${encodeURIComponent(nome)}?valueRenderOption=FORMATTED_VALUE`);
      const [cab = [], ...linhas] = r.values || [];
      const chaves = cab.map(c => semAcento(String(c)).toLowerCase());
      return linhas.map((l, i) => ({ n: i + 2, l, col: (...termos) => { const j = chaves.findIndex(c => termos.every(t => c.includes(t))); return j < 0 ? '' : String(l[j] ?? '').trim(); } }));
    } catch (e) { if (nome === nomes.at(-1)) throw e; }
  }
}
const marcado = v => /^(true|verdadeiro|sim|x|1)$/i.test(String(v || '').trim());
const fimDoDia = v => /\d{1,2}:\d{2}/.test(String(v)) ? dataBR(v) : dataBR(v, '23:59');

// banners da pasta
const arquivos = (await g(`${DRIVE}/files?` + qs({ q: `'${drive.pastaBanners}' in parents and trashed=false`, fields: 'files(id,name,mimeType,modifiedTime,md5Checksum)', pageSize: '500' }))).files;
const porNome = new Map(arquivos.map(a => [semAcento(a.name).toLowerCase().trim(), a]));
const porId = new Map(arquivos.map(a => [a.id, a]));
async function banner(nomeArquivo, base, linha) {
  const chave = semAcento(String(nomeArquivo || '')).toLowerCase().trim();
  if (!chave) { avisos.push(`Linha ${linha}: sem nome de banner — usei a arte padrão.`); return null; }
  const idLink = String(nomeArquivo).match(/(?:\/d\/|[?&]id=)([\w-]{20,})/)?.[1]; // aceita também o link do Drive
  let arq = idLink && porId.get(idLink);
  if (idLink && !arq) arq = await g(`${DRIVE}/files/${idLink}?` + qs({ fields: 'id,name,modifiedTime' })).catch(() => null);
  arq = arq || porNome.get(chave) || [...porNome.entries()].find(([k]) => k.replace(/\.\w+$/, '') === chave.replace(/\.\w+$/, ''))?.[1];
  if (!arq) { avisos.push(`Linha ${linha}: banner "${nomeArquivo}" não está na pasta "Banners do site".`); return null; }
  const h = crypto.createHash('md5').update(arq.id + arq.modifiedTime).digest('hex').slice(0, 8);
  const nome = `${base}-${h}.webp`;
  const destino = path.join(PASTA_IMG, nome);
  if (!fs.existsSync(destino)) {
    const r = await g(`${DRIVE}/files/${arq.id}?alt=media&supportsAllDrives=true`);
    const buf = Buffer.from(await r.arrayBuffer());
    await sharp(buf).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(destino);
    // apaga versões velhas do mesmo show
    for (const f of fs.readdirSync(PASTA_IMG)) if (f.startsWith(base + '-') && f !== nome) fs.rmSync(path.join(PASTA_IMG, f));
  }
  return `/assets/img/eventos/${nome}`;
}

const eventos = [];
for (const { n, col } of await aba('Agenda')) {
  const titulo = col('evento'), cidade = col('cidade'), local = col('local'), data = col('data do show'), horario = col('horario');
  const link = col('link'), arqBanner = col('banner'), entra = col('aparece'), sai = col('sai do site'), pausar = col('pausar');
  const subtitulo = col('subtitulo'), botao = col('texto do botao'), texto = col('texto da pagina');
  const noAr = !marcado(pausar), carrossel = col('carrossel') === '' ? true : /^s/i.test(col('carrossel'));
  if (!titulo) continue;
  if (!link) { avisos.push(`Linha ${n} (${titulo}): falta o link do ingresso.`); continue; }
  const dataShow = dataBR(data, horario && /^\d{1,2}:\d{2}/.test(horario) ? horario.slice(0, 5).padStart(5, '0') : '00:00');
  if (!dataShow) { avisos.push(`Linha ${n} (${titulo}): data do show "${data}" não entendida — use 05/12/2026.`); continue; }
  if (link && !/^https?:\/\//.test(link)) { avisos.push(`Linha ${n} (${titulo}): link do ingresso precisa começar com https://`); continue; }
  const id = slug(`${titulo} ${(cidade || '').split('/')[0]}`);
  const ev = {
    id, titulo, subtitulo, cidade: cidade || local, local: local || cidade,
    data: horario ? dataShow : dataShow.slice(0, 10), horario: horario || '',
    link, botao: botao || 'Compre seu ingresso',
    banner: await banner(arqBanner, id, n),
    entra: dataBR(entra) || '2000-01-01T00:00:00-03:00',
    sai: fimDoDia(sai) || somaDias(dataShow.slice(0, 10) + 'T06:00:00-03:00', 1),
    carrossel, noAr, texto,
  };
  if (!dataBR(sai) && sai) avisos.push(`Linha ${n} (${titulo}): "Sai do site em" não entendido — usei o dia seguinte ao show.`);
  if (entra && !dataBR(entra)) avisos.push(`Linha ${n} (${titulo}): "Aparece no site a partir de" não entendido — mostrei já.`);
  eventos.push(ev);
}

const botoes = [];
for (const { col } of await aba('Botões da home (avançado)', 'Botões')) {
  const noAr = col('no ar'), texto = col('texto'), link = col('link'), cor = col('cor'), entra = col('entra'), sai = col('sai');
  if (!texto || !link) continue;
  if (noAr && !sim(noAr)) continue;
  botoes.push({ id: slug(texto), texto, link, cor: (cor || '').toLowerCase(), entra: dataBR(entra) || '2000-01-01T00:00:00-03:00', sai: dataBR(sai) || '2100-01-01T00:00:00-03:00' });
}

// histórico: todo show que já passou pela planilha fica guardado (página "realizado" continua no ar)
const HIST = C('eventos-historico.json');
const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, 'utf8')) : {};
for (const e of eventos) if (e.noAr) hist[e.id] = { ...e, vistoEm: new Date().toISOString() };
fs.writeFileSync(HIST, JSON.stringify(hist, null, 2));

const anterior = fs.existsSync(C('agenda.json')) ? JSON.parse(fs.readFileSync(C('agenda.json'), 'utf8')) : {};
const novo = { _fonte: `Planilha "Agenda do site A6" (${drive.planilha}) — gerado por scripts/agenda-drive.mjs. Não editar à mão.`, eventos: eventos.filter(e => e.noAr), botoes };
fs.writeFileSync(C('agenda.json'), JSON.stringify(novo, null, 2));
fs.writeFileSync(C('agenda-relatorio.json'), JSON.stringify({ quando: new Date().toISOString(), eventos: novo.eventos.length, botoes: botoes.length, avisos }, null, 2));
const mudou = JSON.stringify({ ...anterior, _fonte: '' }) !== JSON.stringify({ ...novo, _fonte: '' });
console.log(`agenda: ${novo.eventos.length} shows no ar, ${botoes.length} botões, ${avisos.length} aviso(s)${mudou ? ' — MUDOU' : ''}`);
avisos.forEach(a => console.log('  ⚠ ' + a));
