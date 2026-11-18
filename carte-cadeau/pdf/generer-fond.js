const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:816,height:1056},deviceScaleFactor:1});
await p.goto('file:///home/claude/georama-outil/carte-cadeau/pdf/modele.html');await p.waitForTimeout(800);
const ch=await p.$$eval('[data-champ]',e=>e.map(x=>{const r=x.getBoundingClientRect();return{n:x.dataset.champ,m:!!x.dataset.multi,x:r.x,y:r.y,w:r.width,h:r.height}}));
fs.writeFileSync(process.argv[2]+'/champs.json',JSON.stringify(ch));
console.log(await p.evaluate(()=>document.querySelector('.p').getBoundingClientRect().bottom));
await p.pdf({path:process.argv[2]+'/fond.pdf',width:'8.5in',height:'11in',printBackground:true});
await p.screenshot({path:process.argv[2]+'/pdf-apercu.png'});await b.close()})()
