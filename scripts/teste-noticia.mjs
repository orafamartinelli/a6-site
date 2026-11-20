// Simula uma mensagem do grupo IMPRENSA A6 (foto + texto longo) direto no vigia, para testar o robô de notícias.
import fs from 'node:fs';
const k = JSON.parse(fs.readFileSync('C:/Users/User/Documents/projetos/.credentials/a6-site-robo.json', 'utf8')).a6_disparo_key;
const texto = `*[TESTE] Matéria de teste do robô do site — pode apagar*

Esta é uma matéria de teste enviada para conferir se o robô transforma foto e texto do grupo da imprensa em notícia no site novo da A6 Produções.

O título vem da primeira linha. A foto vira a capa. Os parágrafos seguintes viram o corpo da matéria, com *negrito* preservado.

Se você está lendo isto no site, o caminho WhatsApp → site funcionou de ponta a ponta.`;
const corpo = { isGroup: true, fromMe: false, phone: '120363423540446837-group', participantPhone: '5544984232574', senderName: 'Rafa (teste)', messageId: 'TESTE' + Date.now(),
  image: { imageUrl: 'https://a6-site-previa.pages.dev/assets/img/banners/zeze-sunset.webp', caption: texto } };
const r = await fetch(`https://a6-site-robo.rafa-572.workers.dev/noticia?key=${k}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
console.log(r.status, await r.text());
