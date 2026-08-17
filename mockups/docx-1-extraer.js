const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const pg=await b.newPage();
  await pg.goto('http://localhost:8788/mockups/campaign-flash-manual.html',{waitUntil:'networkidle'});
  await pg.waitForTimeout(900);
  const bloques = await pg.evaluate(()=>{
    const out=[];
    const txt = el => (el.textContent||'').replace(/\s+/g,' ').trim();
    // runs con negrita, para no perder el enfasis
    const runs = el => {
      const r=[]; 
      const walk=(n,bold)=>{
        for(const c of n.childNodes){
          if(c.nodeType===3){ const t=c.textContent.replace(/\s+/g,' '); if(t) r.push({t,bold}); }
          else if(c.nodeType===1){
            const b2 = bold || /^(B|STRONG)$/.test(c.tagName) || c.classList.contains('no') || c.classList.contains('si');
            walk(c,b2);
          }
        }
      };
      walk(el,false);
      return r.length? r : [{t:txt(el),bold:false}];
    };
    const wrap=document.querySelector('.wrap');
    // portada
    out.push({tipo:'titulo', texto:'Flash Campaign'});
    out.push({tipo:'subtitulo', texto:'Manual de construcción'});
    const sub=document.querySelector('.sub'); if(sub) out.push({tipo:'p', runs:runs(sub)});
    out.push({tipo:'salto'});

    const visitar = el => {
      const c=el.classList;
      if(el.tagName==='H2'){
        const n=el.querySelector('.n'); const nn=n?txt(n):'';
        if(n) n.remove();
        out.push({tipo:'h1', texto:(nn?nn+' — ':'')+txt(el)}); return;
      }
      if(el.tagName==='H3'){ out.push({tipo:'h2', texto:txt(el)}); return; }
      if(el.tagName==='H4'){ out.push({tipo:'h3', texto:txt(el)}); return; }
      if(el.tagName==='P'){ if(txt(el)) out.push({tipo:'p', runs:runs(el)}); return; }
      if(el.tagName==='UL'||el.tagName==='OL'){
        [...el.children].forEach(li=>out.push({tipo:'li', runs:runs(li)})); return;
      }
      if(c.contains('formula')){
        (el.textContent||'').split('\n').forEach(l=>out.push({tipo:'mono', texto:l})); return;
      }
      if(c.contains('box')){
        const t=el.querySelector('.t'); const tit=t?txt(t):'';
        if(t) t.remove();
        const cuerpo=[];
        [...el.children].forEach(ch=>{
          if(ch.tagName==='P') cuerpo.push({tipo:'p', runs:runs(ch)});
          else if(ch.tagName==='UL') [...ch.children].forEach(li=>cuerpo.push({tipo:'li', runs:runs(li)}));
        });
        out.push({tipo:'aviso', titulo:tit, cuerpo,
          clase: c.contains('no-')?'no':c.contains('si-')?'si':c.contains('wa')?'wa':'info'});
        return;
      }
      if(c.contains('tw')){
        const tb=el.querySelector('table'); if(!tb) return;
        const cab=[...tb.querySelectorAll('thead th')].map(txt);
        const filas=[...tb.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>({
          texto:txt(td), span:parseInt(td.getAttribute('rowspan')||'1',10)
        })));
        out.push({tipo:'tabla', cab, filas}); return;
      }
      if(c.contains('mapa')) return;   // el mapa visual no aporta en Word
      [...el.children].forEach(visitar);
    };
    [...wrap.children].forEach(el=>{
      if(el.tagName==='HEADER'||el.classList.contains('idx')) return;
      if(el.tagName==='FOOTER'){ out.push({tipo:'salto'}); out.push({tipo:'p', runs:[{t:txt(el),bold:false}]}); return; }
      visitar(el);
    });
    return out;
  });
  fs.writeFileSync('bloques.json', JSON.stringify(bloques));
  const n={}; bloques.forEach(b=>n[b.tipo]=(n[b.tipo]||0)+1);
  console.log('bloques extraidos:', bloques.length);
  console.log(Object.entries(n).map(([k,v])=>k+':'+v).join(' · '));
  await b.close();
})().catch(e=>{console.error('CRASH',e);process.exit(1)});
