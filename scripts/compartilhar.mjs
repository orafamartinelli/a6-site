// Compartilha a pasta "Agenda do site A6" (planilha + banners) como editora. Uso: node scripts/compartilhar.mjs email@dominio
import fs from 'node:fs';
import path from 'node:path';
import { g, DRIVE, qs } from './google.mjs';
const drive = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'conteudo', 'drive.json'), 'utf8'));
const email = process.argv[2];
if (!/^[^@\s]+@[^@\s]+$/.test(email || '')) throw new Error('informe o e-mail');
const atuais = await g(`${DRIVE}/files/${drive.pastaAgenda}/permissions?` + qs({ fields: 'permissions(emailAddress,role)' }));
if (atuais.permissions.some(p => p.emailAddress?.toLowerCase() === email.toLowerCase())) { console.log('já tinha acesso:', email); process.exit(0); }
const p = await g(`${DRIVE}/files/${drive.pastaAgenda}/permissions?` + qs({ sendNotificationEmail: 'true', fields: 'id,role,emailAddress' }), { method: 'POST', body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email }) });
console.log('compartilhado:', p.emailAddress, p.role);
