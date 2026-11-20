// A6 Produções — menu, agenda por data, carrossel, vídeos leves, "carregar mais".
(function () {
  // menu do celular
  var hamb = document.querySelector('.hamb'), menu = document.querySelector('.menu');
  if (hamb) hamb.addEventListener('click', function () {
    var aberto = menu.classList.toggle('aberto');
    hamb.setAttribute('aria-expanded', aberto);
  });

  // agenda: cada item com data-entra/data-sai só aparece dentro da janela
  var agora = Date.now();
  document.querySelectorAll('[data-sai]').forEach(function (el) {
    var entra = Date.parse(el.dataset.entra || 0), sai = Date.parse(el.dataset.sai);
    if (agora < entra || agora >= sai) el.classList.add('fora-do-ar');
  });
  document.querySelectorAll('[data-lista-agenda]').forEach(function (lista) {
    if (!lista.querySelector('[data-sai]:not(.fora-do-ar)')) {
      var v = lista.parentNode.querySelector('.vazio'); if (v) v.hidden = false;
    }
  });

  // carrossel
  var trilho = document.querySelector('.trilho');
  if (trilho) {
    var slides = [].slice.call(trilho.querySelectorAll('.slide:not(.fora-do-ar)'));
    var pontos = document.querySelector('.pontos');
    if (slides.length < 2) { var s = document.querySelector('.setas'); if (s) s.remove(); }
    var atual = 0;
    slides.forEach(function (sl, i) {
      if (slides.length < 2) return;
      var b = document.createElement('button');
      b.setAttribute('aria-label', 'Banner ' + (i + 1));
      b.onclick = function () { ir(i); };
      pontos.appendChild(b);
    });
    function marcar() {
      [].forEach.call(pontos.children, function (b, i) { b.setAttribute('aria-current', i === atual); });
    }
    function ir(i) {
      atual = (i + slides.length) % slides.length;
      var sl = slides[atual];
      trilho.scrollTo({ left: sl.offsetLeft - (trilho.clientWidth - sl.clientWidth) / 2, behavior: 'smooth' });
      marcar();
    }
    var ant = document.querySelector('.setas .ant'), prox = document.querySelector('.setas .prox');
    if (ant) ant.onclick = function () { ir(atual - 1); pausa(); };
    if (prox) prox.onclick = function () { ir(atual + 1); pausa(); };
    trilho.addEventListener('scroll', function () {
      var meio = trilho.scrollLeft + trilho.clientWidth / 2, melhor = 0, dist = 1e9;
      slides.forEach(function (sl, i) { var d = Math.abs(sl.offsetLeft + sl.clientWidth / 2 - meio); if (d < dist) { dist = d; melhor = i; } });
      if (melhor !== atual) { atual = melhor; marcar(); }
    }, { passive: true });
    var timer = null;
    function roda() { if (slides.length > 1) timer = setInterval(function () { ir(atual + 1); }, 5500); }
    function pausa() { clearInterval(timer); timer = null; setTimeout(function () { if (!timer) roda(); }, 12000); }
    trilho.addEventListener('pointerdown', pausa);
    marcar(); roda();
  }

  // vídeos: só carrega o YouTube quando clica
  document.querySelectorAll('.yt').forEach(function (b) {
    b.addEventListener('click', function () {
      b.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + b.dataset.id + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Vídeo A6"></iframe>';
    }, { once: true });
  });

  // medição: um ponto só manda pro GA4, pixel e funil (cada um só existe na versão oficial)
  window.a6Evento = function (nome, dados) {
    dados = dados || {};
    try { if (window.gtag) gtag('event', nome, dados); } catch (e) {}
    try {
      if (window.fbq) {
        if (nome === 'form_enviado') fbq('track', 'Lead', { content_name: 'contato-site' }, dados.eid ? { eventID: dados.eid } : undefined);
        else if (nome === 'clique_whatsapp') fbq('track', 'Contact', { content_name: dados.origem || '' });
        else fbq('trackCustom', nome, dados);
      }
    } catch (e) {}
    try { if (window.RastreioLP && nome === 'form_enviado') RastreioLP.evento('form_enviado', null, dados.formulario || 'contato'); } catch (e) {}
  };
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a');
    if (!a) return;
    if (/wa\.me\/\d/.test(a.href)) a6Evento('clique_whatsapp', { origem: a.getAttribute('data-wa') || 'link' });
    else if (a.hasAttribute('data-ingresso')) a6Evento('clique_ingresso', { evento: a.getAttribute('data-ingresso'), lugar: a.getAttribute('data-lugar') || '' });
  }, true);

  // formulário de contato: envia sem sair da página
  var form = document.querySelector('[data-contato]');
  if (form) {
    form.t.value = Date.now();
    var status = form.querySelector('[data-status]');
    if (/[?&]enviado=1/.test(location.search)) status.textContent = '✅ Mensagem enviada! Vamos responder em breve.';
    form.addEventListener('submit', function (ev) {
      if (!window.fetch) return;
      ev.preventDefault();
      var bt = form.querySelector('button[type=submit]');
      bt.disabled = true; bt.textContent = 'Enviando…';
      if (window.RastreioLP && RastreioLP.sessao) form.pagina.value = RastreioLP.pagina + ' · sessão ' + RastreioLP.sessao;
      // dados para a Meta casar o Lead do navegador com o do servidor (CAPI)
      var eid = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      var cookie = function (n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; };
      var fd = new FormData(form);
      fd.append('eid', eid); fd.append('fbp', cookie('_fbp')); fd.append('fbc', cookie('_fbc')); fd.append('url', location.href.split('#')[0]);
      fetch(form.action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          status.textContent = (j.ok ? '✅ ' : '⚠️ ') + j.msg;
          status.style.color = j.ok ? '#0a7a3d' : '#a7054b';
          if (j.ok) { form.reset(); form.t.value = Date.now(); }
          if (j.ok && window.a6Evento) window.a6Evento('form_enviado', { formulario: 'contato', eid: eid });
        })
        .catch(function () { status.textContent = '⚠️ Não conseguimos enviar agora. Fale pelo WhatsApp (44) 3101-1045.'; })
        .then(function () { bt.disabled = false; bt.textContent = 'Enviar mensagem'; });
    });
  }

  // notícias: carregar mais
  var botaoMais = document.querySelector('[data-carregar-mais]');
  if (botaoMais) {
    var ocultos = function () { return document.querySelectorAll('.card[hidden]'); };
    botaoMais.addEventListener('click', function () {
      [].slice.call(ocultos(), 0, 12).forEach(function (c) { c.hidden = false; });
      if (!ocultos().length) botaoMais.remove();
    });
  }
})();
