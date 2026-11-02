import fs from 'node:fs/promises';
const url='https://www.gazzettaufficiale.it/rss/SG';
const terms=/scuol|istruzion|dirigent|docent|ministero dell.istruzione|formazione professionale|contratt|pubblic.?amministraz|disabilit|inclusion|valutazion/i;
const decode=s=>s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'').trim();
const field=(s,tag)=>decode(s.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||'');
const response=await fetch(url,{headers:{'User-Agent':'AccademiaDS-normative-monitor/1.0'},signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error('Gazzetta Ufficiale RSS HTTP '+response.status);
const xml=await response.text();
if(!xml.includes('<rss')&&!xml.includes('<feed'))throw new Error('Feed non riconosciuto');
const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>({title:field(m[1],'title'),url:field(m[1],'link'),date:field(m[1],'pubDate'),description:field(m[1],'description')})).filter(x=>x.title&&x.url&&x.url.startsWith('https://www.gazzettaufficiale.it/')).filter(x=>terms.test(x.title+' '+x.description));
let previous={items:[]};try{previous=JSON.parse(await fs.readFile('data/normativa-status.json','utf8'))}catch{}
const byUrl=new Map((previous.items||[]).map(x=>[x.url,x]));
for(const i of items)if(!byUrl.has(i.url))byUrl.set(i.url,{...i,status:'da_verificare',source:'Gazzetta Ufficiale'});
const kept=[...byUrl.values()].slice(-180);
await fs.writeFile('data/normativa-status.json',JSON.stringify({lastChecked:new Date().toISOString(),source:url,status:'feed consultato; vigenza NON verificata',items:kept},null,2)+'\n');
console.log('Feed consultato. Elementi candidati:',items.length,'Catalogo:',kept.length);
