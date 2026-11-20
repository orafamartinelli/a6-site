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
