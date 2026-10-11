const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const p=await b.newPage();
 await p.route(u=>!u.href.startsWith('http://localhost'),r=>r.abort());
 await p.goto('http://localhost:8790/unicode.html'); await p.waitForTimeout(1500);
 const out=await p.evaluate(()=>{
  const D=JSON.parse(document.getElementById('qatt-data').textContent);
  const res={};
  const cells=[...document.querySelectorAll('#chart td')];
  // glyph order: chart cell o
  cells.forEach((td,o)=>{
    const svg=td.querySelector('svg'); if(!svg) return;
    const uses=[...svg.querySelectorAll('use')].map(u=>u.getAttribute('href').slice(1));
    res[o]={t:D.chars[o]&&D.chars[o].t,n:D.chars[o]&&D.chars[o].n,uses,
      defs:uses.map(id=>{const e=document.getElementById(id);return e?{tag:e.tagName,d:e.getAttribute('d'),tr:e.getAttribute('transform'),st:e.getAttribute('style'),cx:e.getAttribute('cx'),cy:e.getAttribute('cy'),r:e.getAttribute('r')}:null})};
  });
  return {svgvb:document.querySelector('#chart svg').getAttribute('viewBox'),res};
 });
 fs.writeFileSync('glyphs.json',JSON.stringify(out,null,0));
 const k=Object.keys(out.res); console.log(k.length, out.svgvb);
 for (const o of [0,1,22,23,156,157,160]) console.log(o,JSON.stringify(out.res[o]));
 await b.close();
})();
