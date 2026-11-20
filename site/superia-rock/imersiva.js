// Imersão — câmera controlada pelo scroll (variante /imersiva). Independente do script.js.
(function(){
  const $ = id => document.getElementById(id);
  const trilho=$('imersao'); if(!trilho) return;
  const c1=$('cena1'), c2=$('cena2'), c3=$('cena3'), veu=$('imveu');
  const pesq=$('pesq'), pdir=$('pdir'), fresta=$('fresta'), flash=$('flash');
  const feixes=$('feixes'), fa=$('fa'), fb=$('fb'), fc=$('fc'), particulas=$('particulas');
  const dica=$('imdica'), caps=[...$('caps').children], cena4=$('cena4'), credito=$('imcredito');
  const beats=['b1','b2','b3','b4','b5'].map(id=>$(id));
  const linhas=beats.map(b=>[...b.querySelectorAll('.l, p, .btn, .im-eyebrow')]);

  // grão de filme (SVG de ruído gerado aqui)
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>";
  $('grao').style.backgroundImage = "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")";

  // partículas douradas
  for(let i=0;i<22;i++){ const d=document.createElement('i');
    d.style.left=(Math.random()*100)+'%'; d.style.setProperty('--dx',(Math.random()*60-30)+'px');
    d.style.animationDuration=(7+Math.random()*7)+'s'; d.style.animationDelay=(-Math.random()*12)+'s';
    d.style.width=d.style.height=(3+Math.random()*4)+'px'; particulas.appendChild(d); }

  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const fase=(p,a,b)=>clamp((p-a)/(b-a),0,1);
  const suave=t=>t*t*(3-2*t);
  const janela=(p,a,b,IN=.05,OUT=.05)=>{ if(p<a||p>b) return 0; if(p<a+IN) return suave((p-a)/IN); if(p>b-OUT) return suave((b-p)/OUT); return 1; };

  // inércia: a câmera persegue o scroll
  let alvo=0, atual=0, rodando=false;
  // métrica: até onde a pessoa assistiu a abertura (25/50/75/100) — kit rastreio-lp.js
  function medirImersao(p){ if(!window.RastreioLP) return; [25,50,75,100].forEach(m=>{ if(p*100>=m-0.5) RastreioLP.evento('imersao',m); }); }
  function medir(){ const total=trilho.offsetHeight-innerHeight; alvo=clamp((scrollY-trilho.offsetTop)/total,0,1); medirImersao(alvo); if(!rodando){ rodando=true; requestAnimationFrame(loop); } }
  function loop(){ atual+=(alvo-atual)*0.14; if(Math.abs(alvo-atual)<0.0004){ atual=alvo; rodando=false; } render(atual); if(rodando) requestAnimationFrame(loop); }

  function render(p){
    const f1=suave(fase(p,0,.30));
    c1.style.transform=`scale(${1+f1*1.5}) translate(${-f1*3}%, ${f1*7}%)`;
    const sai1=suave(fase(p,.24,.32));
    c1.style.opacity=1-sai1; c1.style.filter=`blur(${sai1*6}px)`;

    const f2=suave(fase(p,.26,.58));
    c2.style.opacity=suave(fase(p,.24,.32));
    c2.style.transform=`scale(${1.12+f2*.5}) translate(${f2*2}%, ${-f2*3}%)`;

    const fecha=suave(fase(p,.52,.60)), abre=suave(fase(p,.66,.76));
    const pos=fecha*(1-abre);
    pesq.style.transform=`translateX(${-102+pos*102}%)`;
    pdir.style.transform=`translateX(${102-pos*102}%)`;
    fresta.style.opacity=fecha*(1-suave(fase(p,.74,.80)));
    fresta.style.transform=`scaleX(${1+abre*40})`;
    flash.style.opacity=Math.sin(fase(p,.64,.76)*Math.PI)*.9;

    c3.style.opacity=suave(fase(p,.58,.66));
    c3.style.transform=`scale(${1.05+suave(fase(p,.66,1))*.28}) translateY(${-suave(fase(p,.66,1))*2}%)`;
    veu.style.opacity=suave(fase(p,.60,.70))*.55;

    // CENA 4 — a câmera chega ao palco: crossfade do salão pro artista, avançando devagar
    const art=suave(fase(p,.82,.90));
    cena4.style.opacity=art; credito.style.opacity=art*.8;
    cena4.style.transform=`scale(${1.04+suave(fase(p,.82,1))*.14})`;
    veu.style.opacity=Math.max(parseFloat(veu.style.opacity)||0, art*.25);

    const show=suave(fase(p,.70,.80));
    feixes.style.opacity=show; particulas.style.opacity=show;
    const t=p*40;
    fa.style.transform=`rotate(${-28+Math.sin(t)*22}deg)`;
    fb.style.transform=`rotate(${18+Math.sin(t*.8+1.2)*20}deg)`;
    fc.style.transform=`rotate(${Math.sin(t*1.1+2.4)*30}deg)`;

    const jan=[[.00,.22],[.28,.50],[.56,.68],[.74,.86],[.89,1.0]];
    beats.forEach((el,i)=>{ const o=janela(p,jan[i][0],jan[i][1],.05, i===beats.length-1 ? 0 : .05); el.style.opacity=o; // a última batida (artista + CTA) não some no fim
      linhas[i].forEach((ln,k)=>{ ln.style.transform=`translateY(${(1-o)*(16+k*12)}px)`; ln.style.opacity=o; }); });

    dica.style.visibility=p>.06?'hidden':'';
    const cap=p<.26?0:p<.58?1:p<.86?2:3; caps.forEach((c,i)=>c.classList.toggle('on',i===cap));
  }
  // pausa visual da imersão enquanto um modal (orçamento/vídeo) está aberto
  document.querySelectorAll('.modal').forEach(m=>{ m.addEventListener('modal:opened',()=>trilho.classList.add('im-pausa')); m.addEventListener('modal:closed',()=>trilho.classList.remove('im-pausa')); });
  addEventListener('scroll',medir,{passive:true}); addEventListener('resize',medir,{passive:true}); medir();
})();
