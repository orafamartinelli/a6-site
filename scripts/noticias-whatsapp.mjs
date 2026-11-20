// Notícias vindas do grupo da imprensa (WhatsApp). Montado na etapa do robô de notícias.
// Sem NOTICIAS_URL configurado, não faz nada.
if (!process.env.NOTICIAS_URL) { console.log('robô de notícias ainda não ligado'); process.exit(0); }
