// โหลดสคริปต์จริงของเว็บ palangtuaylek มารันในเซิร์ฟเวอร์ ผลจึงตรงกับเว็บทุกตัว
const vm=require("vm");
function stub(){const f=function(){return stub();};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>"";if(k==="then")return undefined;if(k==="length")return 0;if(k==="value"||k==="textContent"||k==="innerHTML"||k==="search"||k==="hash")return "";if(k==="checked"||k==="hidden")return false;if(k==="dataset"||k==="style")return {};if(k==="classList")return {add(){},remove(){},toggle(){},contains(){return false}};if(k==="querySelectorAll"||k==="getElementsByTagName")return ()=>[];if(k==="forEach")return ()=>{};return stub();},set(){return true;},apply(){return stub();}});}
function makeCtx(){
  const store={};
  const ls={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},key:()=>null,length:0};
  const doc=stub();
  const win={document:doc,localStorage:ls,sessionStorage:ls,location:{search:"",hash:"",href:"https://www.palangtuaylek.com/",pathname:"/",origin:"https://www.palangtuaylek.com",host:"www.palangtuaylek.com"},navigator:{userAgent:"node",language:"th"},
    addEventListener(){},removeEventListener(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},requestAnimationFrame:()=>0,
    fetch:()=>new Promise(()=>{}),matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}),history:{replaceState(){},pushState(){}},
    scrollTo(){},alert(){},confirm:()=>false,console:{log(){},warn(){},error(){},info(){}},getComputedStyle:()=>stub(),
    Intl,Date,Math,JSON,URLSearchParams,TextEncoder,TextDecoder,encodeURIComponent,decodeURIComponent,escape,unescape,btoa:s=>Buffer.from(s,"binary").toString("base64"),atob:s=>Buffer.from(s,"base64").toString("binary"),
    Image:function(){return stub();},FileReader:function(){return stub();},Blob:function(){},URL,crypto:globalThis.crypto,performance};
  win.window=win;win.self=win;win.globalThis=win;
  return vm.createContext(win);
}
let CTX=null,LOADED_AT=0;
function load(src){
  const ctx=makeCtx();
  vm.runInContext(src+`
;globalThis.__run=function(inp){inp.job=jobOf(inp.jobText);inp.jobs=matchJobs(inp.jobText);const r=analyze(inp);finalScore(inp,r);const NM=analyzeName(inp,r);
 const good=[],bad=[];for(let d=0;d<10;d++){if(r.ds.cls[d]==="g")good.push(d);if(r.ds.cls[d]==="b")bad.push(d);}
 return {s1000:r.s1000,level:r.level,sum:r.sum,sumInfo:r.sumInfo,lag:r.ds.lag,good,bad,html:simpleSummary(inp,r,NM)};};
globalThis.__prov=PROV;`,ctx,{timeout:20000});
  CTX=ctx;LOADED_AT=Date.now();return ctx;
}
function strip(h){return String(h).replace(/<br\s*\/?>/gi,"\n").replace(/<\/(p|div|li|h\d)>/gi,"\n").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n\n").trim();}
function provList(){return CTX.__prov;}
function run(inp){const r=CTX.__run(JSON.parse(JSON.stringify(inp)));r.text=strip(r.html);delete r.html;return JSON.parse(JSON.stringify(r));}
module.exports={load,run,provList,strip,loadedAt:()=>LOADED_AT};
