/* ===== Jood ALabbas Store — App Logic ===== */
'use strict';

/* ==================== STATE ==================== */
const API = 'https://script.google.com/macros/s/AKfycbwK-ocQW5eO9n0_8qKy2o34dVjFT2Qyb2vE5HWVIoAU6KrwqwbcDiVT8dhmXOtGs3eEBw/exec';
const PLACEHOLDER = 'https://placehold.co/300x300?text=?';

/* ==================== إعدادات الخصم والتوصيل ====================
   مكان واحد للتحكم — أي تغيير هنا ينعكس على كل الموقع */
const DISCOUNT_PCT   = 40;      // نسبة الخصم (%)
const PAY_RATE       = 0.6;     // ما يدفعه الزبون = 60% (بعد خصم 40%)
const SHIP_COST      = 5000;    // تكلفة التوصيل (دينار)
const FREE_SHIP_QTY  = 6;       // عدد القطع للتوصيل المجاني

/* سعر القطعة بعد الخصم */
function discPrice(orig){ return Math.round(Number(orig) * PAY_RATE); }

/* تكلفة التوصيل حسب عدد القطع — مجاني عند 6 قطع أو أكثر */
function calcShip(items){
  const n = Array.isArray(items) ? items.length : Number(items||0);
  return n >= FREE_SHIP_QTY ? 0 : SHIP_COST;
}
/* هل التوصيل مجاني؟ */
function isFreeShip(items){ return calcShip(items) === 0; }
let allData = [], cart = [], lang = 'ar';
let fSea = '', fTyp = '', fSort = '';

function t(k){ return (L[lang]&&L[lang][k]) ? L[lang][k] : (L.ar[k]||k); }

/* ==================== SECURITY UTILS ==================== */
function sanitize(str){ const d=document.createElement('div'); d.appendChild(document.createTextNode(String(str==null?'':str))); return d.innerHTML; }
function safeImgSrc(url){ if(!url||typeof url!=='string') return PLACEHOLDER; try{ const u=new URL(url); return (u.protocol==='https:'||u.protocol==='http:') ? url : PLACEHOLDER; } catch(_){ return PLACEHOLDER; } }

/* ==================== LANGUAGE ==================== */
function setLang(l){
  lang=l;
  const root=document.getElementById('htmlRoot');
  root.lang=l; root.dir=L[l].dir;
  document.querySelectorAll('.lopt').forEach(b=>b.classList.toggle('on',b.dataset.lang===l));
  applyTrans();
  updateFilterCounts();
  doFilter();
}
function applyTrans(){
  const map={
    hTitle:'hTitle',hSub:'hSub',welcomeEl:'welcome',promoTxt:'promo',
    rstBtn:'rst',fltBtnLbl:'fltBtn',applyFltLbl:'applyFlt',resetFltLbl:'resetFlt',
    fSeaLbl:'seaLbl',fTypLbl:'typLbl',fSortLbl:'sortLbl',
    filterShTitle:'fltBtn',
    rcount:'',navHome:'navHome',navSearch:'navSearch',navCart:'navCart',
    navTrack:'navTrack',trackShTitle:'trackShTitle',trIntro:'trIntro',
    navWish:'navWish',navContact:'navContact',
    fpTitle:'fpTitle',fpClose:'fpClose',footerEl:'footer',
    cartShTitle:'cartT',checkoutLbl:'checkout',clearCartLbl:'clearCart',shareCartLbl:'shareCart',
    wishShTitle:'wishT',contactShTitle:'contactT',
    ckTitle:'ckTitle',ckConfirmLbl:'confirmOrder',ckNote:'orderNoteNew',ckCancel:'back',
    szTitle:'szTitle',pwaTxt:'pwaTxt',pwaInstBtn:'pwaInst',pwaSkip:'pwaSkip',
    offlineTxt:'offline',ptrTxt:'ptrTxt'
  };
  for(const [id,key] of Object.entries(map)){
    const el=document.getElementById(id);
    if(el&&key) el.textContent=t(key);
  }
  document.getElementById('searchIn').placeholder=t('search');
  document.getElementById('ckName').placeholder=t('namePh');
  document.getElementById('ckPhone').placeholder=t('phonePh');
  document.getElementById('ckAddr').placeholder=t('addrPh');
  ['55','60','65','70','75','80','90','100','110','120','130','140','150','160','170'].forEach(s=>{
    const el=document.getElementById('s'+s); if(el) el.textContent=t('s'+s);
  });
  // Filter sheet tabs
  const seaTabs=document.querySelectorAll('#fSeaTabs .filt-tab');
  const seaVals=['all','sum','win','spr'];
  seaTabs.forEach((b,i)=>{ if(seaVals[i]) b.childNodes[0].textContent=t(seaVals[i]); });
  const typTabs=document.querySelectorAll('#fTypTabs .filt-tab');
  const typVals=['all','out','hom'];
  typTabs.forEach((b,i)=>{ if(typVals[i]) b.childNodes[0].textContent=t(typVals[i]); });
  const srtTabs=document.querySelectorAll('#fSortTabs .filt-tab');
  [t('sortDef'),t('sortAsc'),t('sortDesc')].forEach((tx,i)=>{ if(srtTabs[i]) srtTabs[i].textContent=tx; });
  // Contact sheet links text
  const clinks=document.querySelectorAll('.contact-sheet-link span');
  const cnames=['واتساب','تليجرام','انستقرام','فيسبوك'];
  const cnamesEn=['WhatsApp','Telegram','Instagram','Facebook'];
  const cnamesKu=['واتساپ','تێلێگرام','ئینستاگرام','فەیسبووک'];
  const cmap={ar:cnames,en:cnamesEn,ku:cnamesKu};
  clinks.forEach((el,i)=>{ if(cmap[lang]&&cmap[lang][i]) el.textContent=cmap[lang][i]; });
}
document.querySelectorAll('.lopt').forEach(btn=>btn.addEventListener('click',()=>setLang(btn.dataset.lang)));

/* ==================== DARK MODE ==================== */
document.getElementById('darkBtn').addEventListener('click',()=>{
  document.body.classList.toggle('dark');
  const d=document.body.classList.contains('dark');
  document.getElementById('darkBtn').innerHTML=d?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>';
  localStorage.setItem('dk',d?'1':'0');
});

/* ==================== RIPPLE ==================== */
document.querySelectorAll('.bnavbtn').forEach(btn=>{
  btn.addEventListener('click',function(e){
    const r=document.createElement('span'); r.className='ripple';
    const rect=this.getBoundingClientRect();
    const size=Math.max(rect.width,rect.height);
    r.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;`;
    this.appendChild(r); setTimeout(()=>r.remove(),500);
  });
});

/* ==================== NAV ACTIVE ==================== */
function setNavActive(id){
  document.querySelectorAll('.bnavbtn').forEach(b=>b.classList.remove('on'));
  const el=document.getElementById(id); if(el) el.classList.add('on');
}

/* ==================== COUNTDOWN ==================== */
function startCountdown(){
  const upd=()=>{
    const now=new Date(),end=new Date(); end.setHours(23,59,59,999);
    let diff=Math.max(0,end-now);
    document.getElementById('cdH').textContent=String(Math.floor(diff/3600000)).padStart(2,'0'); diff%=3600000;
    document.getElementById('cdM').textContent=String(Math.floor(diff/60000)).padStart(2,'0');
    document.getElementById('cdS').textContent=String(Math.floor((diff%60000)/1000)).padStart(2,'0');
  }; upd(); setInterval(upd,1000);
}

/* ==================== PULL TO REFRESH ==================== */
function initPTR(){
  let sy=0,active=false,triggered=false;
  document.addEventListener('touchstart',e=>{
    if(window.scrollY===0){ sy=e.touches[0].clientY; active=true; triggered=false; }
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!active) return;
    const dy=e.touches[0].clientY-sy;
    if(dy>50){ document.getElementById('ptrBar').classList.add('show'); }
    if(dy>100&&!triggered){ triggered=true; document.getElementById('ptrBar').classList.add('loading'); }
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(!active) return; active=false;
    if(triggered){ fetchData(); }
    setTimeout(()=>{ document.getElementById('ptrBar').classList.remove('show','loading'); },600);
  });
}

/* ==================== SCROLL ==================== */
document.getElementById('bnHome').addEventListener('click',()=>{ window.scrollTo({top:0,behavior:'smooth'}); setNavActive('bnHome'); });
document.getElementById('bnSearch').addEventListener('click',()=>{
  const el=document.getElementById('searchIn'); el.focus();
  window.scrollTo({top:document.querySelector('.srch-wrap').offsetTop-60,behavior:'smooth'});
  setNavActive('bnSearch');
});
const _stBtn = document.getElementById('stBtn');
if (_stBtn) {
  _stBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  window.addEventListener('scroll',()=>{ _stBtn.classList.toggle('show',window.scrollY>300); },{passive:true});
}

/* ==================== HELP BUTTON (tutorial on demand) ==================== */
const _helpBtn = document.getElementById('helpBtn');
if (_helpBtn) _helpBtn.addEventListener('click',()=>{
  localStorage.removeItem('tut');
  showTutorial();
});

/* ==================== COPY ORDER TEXT (اختياري) ==================== */
const _ckCopyBtn = document.getElementById('ckCopy');
if (_ckCopyBtn) _ckCopyBtn.addEventListener('click',()=>{
  const name=document.getElementById('ckName').value.trim();
  const phone=document.getElementById('ckPhone').value.trim();
  const addr=document.getElementById('ckAddr').value.trim();
  let totO=0,totD=0;
  let msg='مرحباً، أرغب بشراء المنتجات التالية:\n';
  cart.forEach(i=>{ msg+='- ID: '+sanitize(String(i.id))+'، القياس: '+sanitize(String(i.size))+'، السعر الأصلي: '+Number(i.orig).toLocaleString()+' دينار، بعد الخصم '+DISCOUNT_PCT+'%: '+Number(i.disc).toLocaleString()+' دينار\n'; totO+=Number(i.orig); totD+=Number(i.disc); });
  const ship=calcShip(cart),total=totD+ship;
  msg+='\nالمجموع الأصلي: '+totO.toLocaleString()+' دينار\n';
  msg+='المجموع بعد الخصم '+DISCOUNT_PCT+'%: '+totD.toLocaleString()+' دينار\n';
  msg+='تكلفة النقل: '+(ship===0 ? 'مجاني 🎉' : ship.toLocaleString()+' دينار')+'\n';
  msg+='المجموع النهائي: '+total.toLocaleString()+' دينار\n\n';
  msg+='معلومات الزبون:\nالاسم: '+(name||'—')+'\nالهاتف: '+(phone||'—')+'\nالعنوان: '+(addr||'—');
  if(navigator.clipboard){
    navigator.clipboard.writeText(msg).then(()=>notify(t('copySuccess'),'s')).catch(()=>fallbackCopy(msg));
  } else { fallbackCopy(msg); }
});
function fallbackCopy(text){ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); notify(t('copySuccess'),'s'); }catch(_){ notify(t('copyFail'),'w'); } document.body.removeChild(ta); }

/* ==================== MEASUREMENTS ==================== */
document.getElementById('measBtn').addEventListener('click',()=>document.getElementById('fpanel').classList.toggle('open'));
document.getElementById('fpClose').addEventListener('click',()=>document.getElementById('fpanel').classList.remove('open'));

/* ==================== LIGHTBOX ==================== */
function openLB(src,productId,price){
  document.getElementById('LB-img').src=src;
  document.getElementById('LB').classList.add('open');
  document.body.style.overflow='hidden';
  try{
    // نستخدم meta.js (يمنع القيم الصفرية ويضيف بيانات أدق)
    if(typeof metaViewContent==='function' && productId){
      const prod = allData.find(p=>String(p.Id)===String(productId));
      metaViewContent(productId, price, prod&&prod.season, prod&&prod.type);
    }
  }catch(_){}
}
function closeLB(){ document.getElementById('LB').classList.remove('open'); document.body.style.overflow=''; }
document.getElementById('LB').addEventListener('click',closeLB);
document.getElementById('LB-x').addEventListener('click',e=>{e.stopPropagation();closeLB();});

/* ==================== NOTIFY ==================== */
function notify(msg,type){
  document.querySelectorAll('.notif').forEach(n=>n.remove());
  const d=document.createElement('div');
  const cls={s:'#E8F5E9:#1B5E20:#A5D6A7',w:'#FFF8E1:#E65100:#FFCC02',i:'#E3F2FD:#0D47A1:#90CAF9'}[type||'i'].split(':');
  d.style.cssText=`position:fixed;top:68px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:12px;z-index:4000;opacity:0;transition:opacity .3s;font-size:13px;font-weight:700;max-width:85vw;text-align:center;box-shadow:var(--sh);background:${cls[0]};color:${cls[1]};border:1px solid ${cls[2]};pointer-events:none;`;
  d.textContent=msg; document.body.appendChild(d);
  setTimeout(()=>d.style.opacity='1',40);
  setTimeout(()=>{d.style.opacity='0';setTimeout(()=>d.remove(),300);},3000);
}

/* ==================== CUSTOM DIALOG ==================== */
function showDlg(title,msg,btns){
  document.getElementById('dlgTitle').textContent=title;
  document.getElementById('dlgMsg').textContent=msg;
  const acts=document.getElementById('dlgActs'); acts.innerHTML='';
  btns.forEach(b=>{ const btn=document.createElement('button'); btn.className='dlg-btn '+(b.cls||'dlg-ok'); btn.textContent=b.lbl; btn.addEventListener('click',()=>{ closeDlg(); if(b.fn) b.fn(); }); acts.appendChild(btn); });
  document.getElementById('dlgOv').classList.add('open'); document.body.style.overflow='hidden';
}
function closeDlg(){ document.getElementById('dlgOv').classList.remove('open'); document.body.style.overflow=''; }

/* ==================== SHEETS ==================== */
function openSheet(id){
  if(id==='cartSheet') renderCart();
  else if(id==='filterSheet') updateFilterCounts();
  document.getElementById('shOv').classList.add('open');
  document.getElementById(id).classList.add('open');
  document.body.style.overflow='hidden';
  const navMap={cartSheet:'bnCart',contactSheet:'bnContact',filterSheet:''};
  if(navMap[id]) setNavActive(navMap[id]);
}
function closeSheets(){
  ['cartSheet','filterSheet','contactSheet'].forEach(s=>document.getElementById(s).classList.remove('open'));
  document.getElementById('shOv').classList.remove('open');
  document.body.style.overflow='';
  setNavActive('bnHome');
}
document.getElementById('shOv').addEventListener('click',closeSheets);
['cartDrag','wishDrag','filterDrag','contactDrag','cartShClose','wishShClose','filterShClose','contactShClose'].forEach(id=>{
  const el=document.getElementById(id); if(el) el.addEventListener('click',closeSheets);
});
document.getElementById('bnCart').addEventListener('click',()=>openSheet('cartSheet'));
document.getElementById('bnContact').addEventListener('click',()=>{openSheet('contactSheet');});
document.getElementById('fltOpenBtn').addEventListener('click',()=>openSheet('filterSheet'));

/* ==================== FILTERS ==================== */
function updateFilterCounts(){
  const seaCounts={},typCounts={};
  allData.forEach(item=>{
    if(item.season) seaCounts[item.season]=(seaCounts[item.season]||0)+1;
    if(item.type)   typCounts[item.type]  =(typCounts[item.type]  ||0)+1;
  });
  const seaMap={'صيفي':'sum','شتوي':'win','بهاري':'spr'};
  const typMap={'طلعة':'out','تركات منزلية':'hom'};
  document.querySelectorAll('#fSeaTabs .filt-tab').forEach(b=>{
    const v=b.dataset.v; if(!v){ b.childNodes[0].textContent=t('all'); return; }
    const cnt=seaCounts[v]||0;
    b.innerHTML=''; b.appendChild(document.createTextNode(t(seaMap[v]||v)+' '));
    const sp=document.createElement('span'); sp.className='filt-count'; sp.textContent='('+cnt+')'; b.appendChild(sp);
    b.dataset.v=v;
  });
  document.querySelectorAll('#fTypTabs .filt-tab').forEach(b=>{
    const v=b.dataset.v; if(!v){ b.childNodes[0].textContent=t('all'); return; }
    const cnt=typCounts[v]||0;
    b.innerHTML=''; b.appendChild(document.createTextNode(t(typMap[v]||v)+' '));
    const sp=document.createElement('span'); sp.className='filt-count'; sp.textContent='('+cnt+')'; b.appendChild(sp);
    b.dataset.v=v;
  });
}
function updateFltBadge(){
  const cnt=[fSea,fTyp,fSort].filter(Boolean).length;
  const badge=document.getElementById('fltBadge');
  const btn=document.getElementById('fltOpenBtn');
  const clrBtn=document.getElementById('fltClearBtn');
  badge.textContent=cnt; badge.style.display=cnt?'inline-flex':'none';
  btn.classList.toggle('active-filters',cnt>0);
  clrBtn.classList.toggle('show',cnt>0);
}
// Filter sheet tab clicks
document.querySelectorAll('#fSeaTabs .filt-tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#fSeaTabs .filt-tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); fSea=btn.dataset.v;
}));
document.querySelectorAll('#fTypTabs .filt-tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#fTypTabs .filt-tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); fTyp=btn.dataset.v;
}));
document.querySelectorAll('#fSortTabs .filt-tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('#fSortTabs .filt-tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); fSort=btn.dataset.v;
}));
document.getElementById('applyFltBtn').addEventListener('click',()=>{ closeSheets(); updateFltBadge(); doFilter(); });
document.getElementById('resetFltBtn').addEventListener('click',()=>{ fSea='';fTyp='';fSort=''; document.querySelectorAll('.filt-tab').forEach(b=>b.classList.toggle('on',b.dataset.v==='')); updateFltBadge(); doFilter(); closeSheets(); });
document.getElementById('fltClearBtn').addEventListener('click',()=>{ fSea='';fTyp='';fSort=''; document.querySelectorAll('.filt-tab').forEach(b=>b.classList.toggle('on',b.dataset.v==='')); updateFltBadge(); doFilter(); });
document.getElementById('searchIn').addEventListener('input', doFilter);
let _fbqSearchTimer=null;
document.getElementById('searchIn').addEventListener('input', function(){
  clearTimeout(_fbqSearchTimer);
  const q=this.value.trim();
  if(q.length<2) return;
  _fbqSearchTimer=setTimeout(()=>{
    try{
      if(typeof fbq==='function'){
        if(typeof metaSearch==='function') metaSearch(q);
      }
    }catch(_){}
  }, 1500); // انتظر 1.5 ثانية بعد توقف الكتابة
});
document.getElementById('rstBtn').addEventListener('click',()=>{ document.getElementById('searchIn').value=''; fSea='';fTyp='';fSort=''; document.querySelectorAll('.filt-tab').forEach(b=>b.classList.toggle('on',b.dataset.v==='')); updateFltBadge(); doFilter(); });

function doFilter(scrollTop=true){
  const q=document.getElementById('searchIn').value.trim().toLowerCase();
  let f=[...allData];
  if(fSea) f=f.filter(i=>i.season===fSea);
  if(fTyp) f=f.filter(i=>i.type===fTyp);
  if(q) f=f.filter(i=>String(i.Id||'').toLowerCase().includes(q)||String(i.sizes||'').toLowerCase().includes(q));
  if(fSort==='asc') f.sort((a,b)=>parseFloat(a.price)-parseFloat(b.price));
  else if(fSort==='desc') f.sort((a,b)=>parseFloat(b.price)-parseFloat(a.price));
  displayProducts(f);
  if(scrollTop) window.scrollTo({top:0,behavior:'smooth'});
}

/* ==================== HELPERS ==================== */
function parseSizes(s){ if(!s&&s!==0) return []; if(typeof s==='number') return [String(s)]; if(Array.isArray(s)) return s.map(x=>String(x).trim()).filter(Boolean); return String(s).split(/[-,،\s]+/).map(x=>x.trim()).filter(x=>x&&!isNaN(x)); }
function getSzLbl(sz){ const k='s'+sz; return L[lang][k] ? sz+'('+L[lang][k]+')' : sz; }

/* ==================== SWIPE TO DELETE ==================== */
function addSwipe(el,onDelete){
  const isRTL=()=>document.getElementById('htmlRoot').dir==='rtl';
  let sx=0,sy=0,tracking=false;
  el.addEventListener('touchstart',e=>{ sx=e.touches[0].clientX; sy=e.touches[0].clientY; tracking=true; el.style.transition='none'; },{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!tracking) return;
    const dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)+5){ tracking=false; return; }
    const rtl=isRTL();
    const validSwipe=rtl?(dx>5):(dx<-5);
    if(!validSwipe&&Math.abs(dx)>10){ tracking=false; return; }
    const shift=rtl?Math.min(120,Math.max(0,dx)):Math.max(-120,Math.min(0,dx));
    el.style.transform='translateX('+shift+'px)';
    el.style.opacity=String(Math.max(0.3,1-Math.abs(shift)/120));
  },{passive:true});
  el.addEventListener('touchend',e=>{
    if(!tracking) return; tracking=false;
    el.style.transition='transform .25s,opacity .25s';
    const dx=e.changedTouches[0].clientX-sx;
    if(Math.abs(dx)>80){ const rtl=isRTL(); el.style.transform='translateX('+(rtl?'110%':'-110%')+')'; el.style.opacity='0'; setTimeout(onDelete,260); }
    else{ el.style.transform=''; el.style.opacity=''; }
  });
}

/* ==================== FETCH & DISPLAY ==================== */
async function fetchData(){
  showSkeleton();
  try{
    const r=await fetch(API,{mode:'cors'}); if(!r.ok) throw new Error('HTTP '+r.status);
    allData=await r.json();
    localStorage.setItem('pc',JSON.stringify({d:allData,ts:Date.now()}));
    document.getElementById('offlineBar').classList.remove('show');
    addJsonLD(allData); updateFilterCounts(); doFilter(false);
    cleanCart(false); // حذف ما نفد من السلة وتنبيه الزبون
  }catch(e){
    try{
      const c=localStorage.getItem('pc');
      if(c){ const parsed=JSON.parse(c); allData=parsed.d||parsed; const age=parsed.ts?Math.round((Date.now()-parsed.ts)/60000):0; document.getElementById('offlineTxt').textContent=t('offline')+(age>0?' ('+age+' min)':''); document.getElementById('offlineBar').classList.add('show'); updateFilterCounts(); doFilter(false); }
      else showError();
    }catch(_){ showError(); }
  }
}
function showSkeleton(){ const c=document.getElementById('prodCont'); const g=document.createElement('div'); g.className='skel-grid'; for(let i=0;i<6;i++){ const d=document.createElement('div'); d.className='skel-card'; d.innerHTML='<div class="skel skel-img"></div><div class="skel skel-ln w60"></div><div class="skel skel-ln w80"></div><div class="skel skel-ln w60"></div>'; g.appendChild(d); } c.innerHTML=''; c.appendChild(g); document.getElementById('rcount').textContent=''; }
function showError(){ const c=document.getElementById('prodCont'); c.innerHTML=''; const b=document.createElement('div'); b.className='errbox'; const ic=document.createElement('i'); ic.className='fas fa-wifi erricon'; const txt=document.createElement('div'); txt.textContent=t('errMsg'); const btn=document.createElement('button'); btn.className='retry'; btn.textContent=t('retry'); btn.addEventListener('click',fetchData); b.appendChild(ic); b.appendChild(txt); b.appendChild(btn); c.appendChild(b); document.getElementById('rcount').textContent=''; }

function addJsonLD(products){
  const old=document.getElementById('jld'); if(old) old.remove();
  const safe=products.filter(p=>parseSizes(p.sizes).length>0).slice(0,20);
  const schema={'@context':'https://schema.org','@type':'ItemList',name:'متجر جود العباس - ملابس أطفال',itemListElement:safe.map((item,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Product',name:'منتج # '+item.Id,image:item.picture||'',offers:{'@type':'Offer',price:discPrice(item.price),priceCurrency:'IQD',availability:'https://schema.org/InStock'}}}))};
  const sc=document.createElement('script'); sc.id='jld'; sc.type='application/ld+json'; sc.textContent=JSON.stringify(schema); document.head.appendChild(sc);
}

function createCard(item){
  const orig=parseFloat(item.price), disc=discPrice(orig);
  const sizes=parseSizes(item.sizes), isLast=sizes.length===1;
  const imgSrc=safeImgSrc(item.picture);
  const card=document.createElement('div'); card.className='pcard';
  // Badges
  const badges=document.createElement('div'); badges.className='cbadges';
  const bdis=document.createElement('span'); bdis.className='badge bdis'; bdis.textContent=t('discount'); badges.appendChild(bdis);
  if(isLast){ const bl=document.createElement('span'); bl.className='badge blast'; bl.textContent=t('lastSize'); badges.appendChild(bl); }
  // Wish
  // Image
  const iw=document.createElement('div'); iw.className='cimg-w'; iw.appendChild(badges);
  const img=document.createElement('img'); img.className='cimg'; img.src=imgSrc; img.alt=String(item.Id); img.loading='lazy'; img.decoding='async'; img.fetchPriority='low'; img.onerror=function(){this.src=PLACEHOLDER;}; img.addEventListener('click',function(){openLB(this.src, item.Id, disc);}); iw.appendChild(img);
  // Body
  const body=document.createElement('div'); body.className='cbody';
  // ID + copy
  const idEl=document.createElement('div'); idEl.className='cid'; idEl.title=t('copyId');
  const idSpan=document.createElement('span'); idSpan.textContent='# '+item.Id;
  const cpIco=document.createElement('i'); cpIco.className='far fa-copy cid-icon';
  idEl.appendChild(idSpan); idEl.appendChild(cpIco);
  idEl.addEventListener('click',function(){ const txt=String(item.Id); if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(()=>notify(t('copyId')+': '+txt,'i')).catch(()=>{}); } else{ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');notify(t('copyId')+': '+txt,'i');}catch(_){} document.body.removeChild(ta); } });
  // Prices
  const pr=document.createElement('div'); pr.className='cprices';
  const op=document.createElement('span'); op.className='pold'; op.textContent=orig.toLocaleString()+' '+t('dinar');
  const np=document.createElement('span'); np.className='pnew'; np.textContent=disc.toLocaleString()+' '+t('dinar');
  pr.appendChild(op); pr.appendChild(np);
  // Savings
  const sv=document.createElement('div'); sv.className='savings'; sv.textContent=t('saved')+' '+(orig-disc).toLocaleString()+' '+t('dinar')+' 💚';
  // Size pills
  // تسمية توضيحية فوق الحبوب
  const pillsLbl=document.createElement('div');
  pillsLbl.className='sz-pills-lbl';
  pillsLbl.textContent='👇 ' + t('tapSizeToAdd');
  const pills=document.createElement('div'); pills.className='sz-pills';
  sizes.forEach(sz=>{ const p=document.createElement('button'); p.className='sz-pill'; p.textContent=getSzLbl(sz); p.addEventListener('click',()=>addToCart(item.Id,sz,orig,disc)); pills.appendChild(p); });
  // زر إضافة للسلة الواضح - يفتح نافذة اختيار القياس
  // Share button removed - card actions limited to size pills only
  body.appendChild(idEl); body.appendChild(pr); body.appendChild(sv); body.appendChild(pillsLbl); body.appendChild(pills);
  card.appendChild(iw); card.appendChild(body);
  return card;
}
function displayProducts(arr){
  const cont=document.getElementById('prodCont');
  const filtered=arr.filter(i=>parseSizes(i.sizes).length>0);
  document.getElementById('rcount').textContent=filtered.length+' '+t('res');
  cont.innerHTML='';
  if(!filtered.length){ const n=document.createElement('div'); n.className='nores'; n.innerHTML='<i class="fas fa-search"></i>'; n.appendChild(document.createTextNode(t('noRes'))); cont.appendChild(n); return; }
  const grid=document.createElement('div'); grid.className='pgrid';
  filtered.forEach(item=>grid.appendChild(createCard(item)));
  cont.appendChild(grid);
}

/* ==================== SHARE ==================== */
function shareProduct(id,price){ const txt='🛍️ '+t('hTitle')+'\n📌 ID: '+id+'\n💰 '+t('discount')+': '+price.toLocaleString()+' '+t('dinar')+'\n🔗 '+window.location.href; if(navigator.share) navigator.share({title:t('hTitle'),text:txt,url:window.location.href}).catch(()=>{}); else window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'); }
function shareCart(){ if(!cart.length){notify(t('cartEmpty'),'w');return;} let msg='🛍️ '+t('hTitle')+'\n\n'; let totD=0; cart.forEach(ci=>{ msg+='• #'+sanitize(String(ci.id))+' (Q:'+sanitize(String(ci.size))+') — '+Number(ci.disc).toLocaleString()+' '+t('dinar')+'\n'; totD+=Number(ci.disc); }); msg+='\n'+t('tot')+': '+(totD+calcShip(cart)).toLocaleString()+' '+t('dinar'); if(navigator.share) navigator.share({title:t('hTitle'),text:msg}).catch(()=>{}); else window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); }
function shareCart(){ /* removed */ }
// Translation for copy button
const _ckCopyLblEl=document.getElementById('ckCopyLbl');
if(_ckCopyLblEl) _ckCopyLblEl.textContent=t('copyBtn');

/* ==================== WISHLIST ==================== */

/* ==================== CART ==================== */
function loadCart(){ cart=JSON.parse(localStorage.getItem('ct')||'[]'); updateCartBadge(); }
function saveCart(){ localStorage.setItem('ct',JSON.stringify(cart)); }
function updateCartBadge(){ const dot=document.getElementById('cdot'); dot.textContent=cart.length; dot.classList.toggle('show',cart.length>0); }
function bounceCart(){ const w=document.querySelector('#bnCart .cnav-wrap'); if(w){w.classList.remove('cart-bounce');void w.offsetWidth;w.classList.add('cart-bounce');} }


/* ==================== VALIDATE CART ====================
   التحقق أن كل منتج في السلة ما زال متوفراً بقياسه
   يمنع طلب منتجات نفدت أو حُذفت من قبل زبائن آخرين */
function isItemAvailable(item){
  const prod = allData.find(p=>String(p.Id)===String(item.id));
  if(!prod) return false;                       // المنتج نفسه غير موجود
  const sizes = parseSizes(prod.sizes);
  if(sizes.length === 0) return false;          // لا قياسات متبقية
  return sizes.some(s=>String(s)===String(item.size)); // القياس متوفر؟
}

/* تنظيف السلة من المنتجات غير المتوفرة — يُرجع عدد المحذوف */
function cleanCart(silent){
  if(!allData || allData.length===0) return 0;  // البيانات لم تُحمّل بعد
  const before = cart.length;
  const removed = cart.filter(i=>!isItemAvailable(i));
  if(removed.length === 0) return 0;
  cart = cart.filter(i=>isItemAvailable(i));
  saveCart(); updateCartBadge();
  if(!silent){
    const ids = removed.map(i=>'#'+i.id+' (Q:'+i.size+')').join('، ');
    notify(t('itemsRemoved')+': '+ids, 'w');
  }
  // إعادة رسم السلة إن كانت مفتوحة
  const cartSheet = document.getElementById('cartSheet');
  if(cartSheet && cartSheet.classList.contains('open')) renderCart();
  return before - cart.length;
}

function addToCart(id,size,orig,disc){
  if(cart.find(i=>i.id===id&&i.size===size)){notify(t('already'),'w');return;}
  cart.push({id,size,orig,disc}); saveCart(); updateCartBadge(); bounceCart();
  notify(t('cartAdded')+' — '+t('saved')+' '+(Number(orig)-Number(disc)).toLocaleString()+' '+t('dinar')+' 💚','s');
  try{
    // نستخدم meta.js (safeValue يمنع القيم الصفرية)
    if(typeof metaAddToCart==='function'){
      const prod = allData.find(p=>String(p.Id)===String(id));
      metaAddToCart(id, disc, size, prod&&prod.season, prod&&prod.type);
    }
  }catch(_){}
}

function renderCart(){
  const body=document.getElementById('cartBody'), totEl=document.getElementById('cartTot');
  body.innerHTML='';
  if(!cart.length){
    body.innerHTML='<div class="sh-empty" style="display:flex;flex-direction:column;align-items:center;gap:12px;"><i class="fas fa-shopping-cart" style="font-size:40px;opacity:.3;"></i><span>'+t('cartEmpty')+'</span></div>';
    totEl.innerHTML='';return;
  }
  // تلميح السحب - مرة واحدة فقط
  if(!sessionStorage.getItem('swHint')){
    const hint=document.createElement('div'); hint.className='swipe-hint';
    const isRTL=document.getElementById('htmlRoot').dir==='rtl';
    hint.innerHTML='<i class="fas fa-hand-point-'+(isRTL?'right':'left')+'"></i> <span>'+t('swipeHint')+'</span>';
    body.appendChild(hint);
    sessionStorage.setItem('swHint','1');
  }
  let totO=0,totD=0;
  cart.forEach(item=>{
    const prod=allData.find(p=>String(p.Id)===String(item.id));
    const available = isItemAvailable(item);
    const div=document.createElement('div'); div.className='ci' + (available ? '' : ' ci-unavailable');
    const img=document.createElement('img'); img.className='ci-img'; img.loading='lazy'; img.decoding='async'; img.src=safeImgSrc(prod&&prod.picture?prod.picture:''); img.alt='';
    const info=document.createElement('div'); info.className='ci-info';
    const ciId=document.createElement('div'); ciId.className='ci-id'; ciId.textContent='# '+item.id;
    const ciSz=document.createElement('div'); ciSz.className='ci-sz'; ciSz.textContent='Q: '+item.size;
    const ciOld=document.createElement('div'); ciOld.className='ci-old'; ciOld.textContent=Number(item.orig).toLocaleString()+' '+t('dinar');
    const ciNew=document.createElement('div'); ciNew.className='ci-new'; ciNew.textContent=Number(item.disc).toLocaleString()+' '+t('dinar');
    info.appendChild(ciId); info.appendChild(ciSz); info.appendChild(ciOld); info.appendChild(ciNew);
    const del=document.createElement('button'); del.className='ci-del'; del.innerHTML='<i class="fas fa-trash"></i>';
    del.addEventListener('click',()=>delCartItem(item.id,item.size));
    div.appendChild(img); div.appendChild(info); div.appendChild(del);
    addSwipe(div,()=>{ cart=cart.filter(i=>!(i.id===item.id&&i.size===item.size)); saveCart(); updateCartBadge(); renderCart(); });
    body.appendChild(div); totO+=Number(item.orig); totD+=Number(item.disc);
  });
  const ship=calcShip(cart), total=totD+ship;
  const r1=document.createElement('div'); r1.textContent=t('sub')+': '+totO.toLocaleString()+' '+t('dinar');
  const r2=document.createElement('div'); r2.textContent=t('subDisc')+': '+totD.toLocaleString()+' '+t('dinar');
  const r3=document.createElement('div');
  if(ship===0){ r3.className='ctot-free'; r3.textContent=t('ship')+': '+t('freeShip')+' 🎉'; }
  else { r3.textContent=t('ship')+': '+ship.toLocaleString()+' '+t('dinar'); }
  const r4=document.createElement('div'); r4.className='ctot-final'; r4.textContent=t('tot')+': '+total.toLocaleString()+' '+t('dinar');
  const rows=[r1,r2,r3,r4];
  /* تلميح: كم قطعة باقية للتوصيل المجاني */
  if(ship>0){
    const need=FREE_SHIP_QTY-cart.length;
    const hint=document.createElement('div'); hint.className='ctot-hint';
    hint.textContent='🚚 '+t('freeShipHint').replace('{n}', need);
    rows.splice(3,0,hint);
  }
  totEl.innerHTML=''; rows.forEach(r=>totEl.appendChild(r));
}
function delCartItem(id,size){ showDlg('🗑️',t('delQ'),[{lbl:t('yes'),cls:'dlg-yes',fn:()=>{cart=cart.filter(i=>!(i.id===id&&i.size===size));saveCart();updateCartBadge();renderCart();}},{lbl:t('no'),cls:'dlg-no'}]); }
document.getElementById('clearCartBtn').addEventListener('click',()=>showDlg('🗑️',t('clrQ'),[{lbl:t('yes'),cls:'dlg-yes',fn:()=>{cart=[];saveCart();updateCartBadge();renderCart();}},{lbl:t('no'),cls:'dlg-no'}]));

/* ==================== SIZE DIALOG ==================== */
let _cid,_csz,_cor,_cdc;
function showSizeDlg(id,szRaw,orig,disc){ _cid=id;_csz=parseSizes(szRaw);_cor=orig;_cdc=disc; document.getElementById('szTitle').textContent=t('szTitle'); document.getElementById('szCancel').textContent=t('cancel'); const g=document.getElementById('szGrid'); g.innerHTML=''; _csz.forEach(sz=>{ const b=document.createElement('button'); b.className='sz-btn'; b.textContent=getSzLbl(sz); b.addEventListener('click',()=>{addToCart(_cid,sz,_cor,_cdc);closeSzDlg();}); g.appendChild(b); }); document.getElementById('szOv').classList.add('open'); document.body.style.overflow='hidden'; }
function closeSzDlg(){ document.getElementById('szOv').classList.remove('open'); document.body.style.overflow=''; }
document.getElementById('szCancel').addEventListener('click',closeSzDlg);
document.getElementById('szOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeSzDlg();});

/* ==================== SAVING OVERLAY ==================== */
function showSavingOverlay() {
  let ov = document.getElementById('savingOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'savingOverlay';
    ov.innerHTML =
      '<div class="saving-box">' +
        '<div class="saving-spinner"></div>' +
        '<div class="saving-text">' + t('savingOrder') + '</div>' +
        '<div class="saving-sub">' + t('savingSub') + '</div>' +
      '</div>';
    document.body.appendChild(ov);
  }
  ov.classList.add('show');
  document.body.style.overflow = 'hidden';
}
function hideSavingOverlay() {
  const ov = document.getElementById('savingOverlay');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
}

/* ==================== SAVE ORDER TO GAS ==================== */
/* تسجيل الطلب في Google Sheets فور الضغط على زر الإرسال.
   نستخدم نفس طريقة موقع التجهيز الناجحة: fetch بسيط بدون no-cors
   حتى نتمكن من قراءة رد GAS والتأكد من نجاح التسجيل.
   الطلب يُسجَّل حتى لو لم يُكمل الزبون الإرسال (مقصود). */
const _sentOrderIds = new Set();

async function saveOrderToGAS(orderData) {
  // منع إرسال نفس الطلب أكثر من مرة
  if (orderData.orderId && _sentOrderIds.has(orderData.orderId)) {
    console.log('⏭️ Order already sent:', orderData.orderId);
    return { success: true, cached: true };
  }
  if (orderData.orderId) _sentOrderIds.add(orderData.orderId);

  try {
    const response = await fetch(API, {
      method:    'POST',
      body:      JSON.stringify(orderData),
      keepalive: true
    });
    const result = await response.json();
    if (result.success) {
      console.log('✅ Order saved:', orderData.orderId, result.duplicate ? '(duplicate)' : '');
      return result;
    } else {
      console.warn('⚠️ GAS returned:', result);
      return result;
    }
  } catch (e) {
    console.warn('❌ saveOrderToGAS failed:', e.message);
    // لا نحذف الـ id — الطلب غالباً وصل رغم خطأ قراءة الرد
    // نرجع نجاحاً تفاؤلياً لأن keepalive يضمن الوصول
    return { success: true, uncertain: true };
  }
}

/* ==================== CHECKOUT ==================== */
document.getElementById('checkoutBtn').addEventListener('click',async()=>{
  if(!cart.length){notify(t('cartEmpty'),'w');return;}
  closeSheets();
  ['ckTitle','ckConfirmLbl','ckNote','ckCancel'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=t({ckTitle:'ckTitle',ckConfirmLbl:'confirmOrder',ckNote:'orderNoteNew',ckCancel:'back'}[id]);
  });
  document.getElementById('ckOv').classList.add('open'); document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('ckName').focus(),300);
  try{
    // نستخدم meta.js (يضيف contents وplatform ويمنع القيم الصفرية)
    if(typeof metaInitiateCheckout==='function' && cart.length>0){
      const cv=cart.reduce((s,i)=>s+Number(i.disc||0),0);
      metaInitiateCheckout(cart, cv+calcShip(cart));
    }
  }catch(_){}
});
function closeCheckout(){ document.getElementById('ckOv').classList.remove('open'); document.body.style.overflow=''; }
document.getElementById('ckCancel').addEventListener('click',closeCheckout);
document.getElementById('ckOv').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCheckout();});



/* ==================== ORDER TRACKING ==================== */
/* مراحل الطلب بالترتيب — للعرض التدريجي */
const TRACK_STAGES = [
  { key:'قيد المراجعة',    icon:'📋', tKey:'stReview' },
  { key:'تم التأكيد',      icon:'✅', tKey:'stConfirmed' },
  { key:'تم التجهيز',      icon:'📦', tKey:'stPrepared' },
  { key:'في عهدة المندوب', icon:'🚚', tKey:'stCourier' },
  { key:'تم التسليم',      icon:'🎉', tKey:'stDelivered' }
];

function openTrack(){
  document.getElementById('trackSheet').classList.add('open');
  document.getElementById('shOv').classList.add('open');
  document.body.style.overflow='hidden';
  setNavActive('bnTrack');
  const inp = document.getElementById('trackIn');
  if(inp) setTimeout(()=>inp.focus(), 300);
}
function closeTrack(){
  document.getElementById('trackSheet').classList.remove('open');
  document.getElementById('shOv').classList.remove('open');
  document.body.style.overflow='';
  setNavActive('bnHome');
}

async function trackOrder(){
  const inp = document.getElementById('trackIn');
  const box = document.getElementById('trackResult');
  if(!inp || !box) return;
  const oid = inp.value.trim();
  if(!oid){ notify(t('enterOrderId'),'w'); return; }

  box.innerHTML = '<div class="tr-loading">🔄 '+t('loading')+'</div>';
  try{
    const r = await fetch(API+'?action=trackOrder&orderId='+encodeURIComponent(oid), {cache:'no-store'});
    const d = await r.json();
    if(!d.success){
      box.innerHTML = '<div class="tr-notfound">❌ '+t('orderNotFound')+'</div>';
      return;
    }
    renderTrackResult(d);
  }catch(e){
    box.innerHTML = '<div class="tr-notfound">⚠️ '+t('errMsg')+'</div>';
  }
}

function renderTrackResult(d){
  const box = document.getElementById('trackResult');
  const status = String(d.status||'قيد المراجعة').trim();

  // الطلب ملغي — عرض خاص
  if(status === 'ملغي'){
    box.innerHTML =
      '<div class="tr-card">' +
        '<div class="tr-oid">🆔 '+sanitize(d.orderId)+'</div>' +
        '<div class="tr-cancelled">❌ '+t('stCancelled')+'</div>' +
      '</div>';
    return;
  }

  const idx = TRACK_STAGES.findIndex(s=>s.key===status);
  const cur = idx < 0 ? 0 : idx;

  let steps = '';
  TRACK_STAGES.forEach((s,i)=>{
    const done   = i <  cur;
    const active = i === cur;
    const cls = done ? 'tr-step done' : active ? 'tr-step active' : 'tr-step';
    steps +=
      '<div class="'+cls+'">' +
        '<div class="tr-dot">'+(done?'✓':s.icon)+'</div>' +
        '<div class="tr-txt">' +
          '<div class="tr-name">'+t(s.tKey)+'</div>' +
          (active ? '<div class="tr-sub">'+t(s.tKey+'Sub')+'</div>' : '') +
        '</div>' +
      '</div>';
    if(i < TRACK_STAGES.length-1) steps += '<div class="tr-line'+(done?' done':'')+'"></div>';
  });

  // تنسيق التاريخ والوقت (بتوقيت بغداد من GAS)
  const dt = fmtOrderDate(d.date, d.time);

  box.innerHTML =
    '<div class="tr-card">' +
      '<div class="tr-oid">🆔 '+sanitize(d.orderId)+'</div>' +
      '<div class="tr-date">📅 '+sanitize(dt)+'</div>' +
      '<div class="tr-steps">'+steps+'</div>' +
    '</div>';
}

/* تنسيق تاريخ ووقت الطلب — بتوقيت بغداد (يأتي جاهزاً من GAS) */
function fmtOrderDate(dateStr, timeStr){
  const d = String(dateStr||'').trim();
  const tm = String(timeStr||'').trim();
  if(!d && !tm) return '—';
  // نعرض الوقت بصيغة HH:MM (بدون ثوانٍ)
  const shortTime = tm.split(':').slice(0,2).join(':');
  return (d ? d : '') + (shortTime ? ' — ' + shortTime : '');
}

/* ربط الأزرار */
const _bnTrack = document.getElementById('bnTrack');
if(_bnTrack) _bnTrack.addEventListener('click', openTrack);
const _trackClose = document.getElementById('trackShClose');
if(_trackClose) _trackClose.addEventListener('click', closeTrack);
const _trackBtn = document.getElementById('trackBtn');
if(_trackBtn) _trackBtn.addEventListener('click', trackOrder);
const _trackIn = document.getElementById('trackIn');
if(_trackIn) _trackIn.addEventListener('keydown', e=>{ if(e.key==='Enter') trackOrder(); });

/* ==================== ORDER SUCCESS + TRACKING ==================== */
/* نافذة نجاح الطلب — تعرض رقم الطلب وتنسخه تلقائياً */
function showOrderSuccess(orderId){
  // محاولة نسخ تلقائي (قد تفشل في بعض المتصفحات — لدينا زر يدوي)
  copyOrderId(orderId, true);

  const ov = document.getElementById('dlgOv');
  const box = ov.querySelector('.dlg-box');
  box.innerHTML =
    '<div class="dlg-title">🎉 ' + t('orderSuccess') + '</div>' +
    '<div class="os-label">' + t('yourOrderId') + '</div>' +
    '<div class="os-id-row">' +
      '<code class="os-id" id="osOrderId">' + sanitize(orderId) + '</code>' +
      '<button class="os-copy" id="osCopyBtn">📋 ' + t('copy') + '</button>' +
    '</div>' +
    '<div class="os-note">⚠️ ' + t('keepOrderId') + '</div>' +
    '<div class="dlg-acts">' +
      '<button class="dlg-btn dlg-yes" id="osOkBtn" style="width:100%;">' + t('orderSuccessOk') + '</button>' +
    '</div>';
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';

  const copyBtn = document.getElementById('osCopyBtn');
  if (copyBtn) copyBtn.addEventListener('click', ()=>{
    copyOrderId(orderId, false);
    copyBtn.textContent = '✅ ' + t('copied');
    setTimeout(()=>{ copyBtn.textContent = '📋 ' + t('copy'); }, 1500);
  });
  const okBtn = document.getElementById('osOkBtn');
  if (okBtn) okBtn.addEventListener('click', ()=>{ restoreDlgBox(); closeDlg(); });
}

/* نسخ رقم الطلب للحافظة */
function copyOrderId(orderId, silent){
  try{
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(orderId).then(()=>{
        if(!silent) notify(t('copied'),'s');
      }).catch(()=>fallbackCopyText(orderId, silent));
    } else {
      fallbackCopyText(orderId, silent);
    }
  }catch(_){ fallbackCopyText(orderId, silent); }
}
function fallbackCopyText(text, silent){
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if(!silent) notify(t('copied'),'s');
  }catch(_){}
}

/* إعادة بناء dlg-box الأصلي (بعد تخصيصه) */
function restoreDlgBox(){
  const box = document.querySelector('#dlgOv .dlg-box');
  if(box) box.innerHTML =
    '<div class="dlg-title" id="dlgTitle"></div>' +
    '<div class="dlg-msg" id="dlgMsg"></div>' +
    '<div class="dlg-acts" id="dlgActs"></div>';
}

async function submitOrder(){
  /* توليد Order ID فريد لهذا الطلب */
  const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
  const name=document.getElementById('ckName').value.trim().slice(0,80);
  const phone=document.getElementById('ckPhone').value.trim().replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^0-9+]/g,'').slice(0,15);
  const addr=document.getElementById('ckAddr').value.trim().slice(0,300);
  if(!name){notify(t('namePh')+' '+t('no'),'w');return;}
  if(!phone||phone.replace(/\D/g,'').length<7){notify(t('phonePh')+' '+t('no'),'w');return;}
  if(!addr){notify(t('addrPh')+' '+t('no'),'w');return;}
  const now=Date.now(), last=parseInt(sessionStorage.getItem('ls')||'0');
  if(now-last<10000){notify('⏳','w');return;}

  /* ===== خط الدفاع الأخير: تحقق من توفر كل منتج قبل التسجيل =====
     نُحدّث البيانات أولاً ثم نتحقق — يمنع تسجيل منتج نفد للتو */
  try {
    const fresh = await fetch(API, {cache:'no-store'});
    if (fresh.ok) {
      const freshData = await fresh.json();
      if (Array.isArray(freshData) && freshData.length > 0) {
        allData = freshData;
        localStorage.setItem('pc', JSON.stringify({d:allData, ts:Date.now()}));
        updateFilterCounts(); doFilter(false);
      }
    }
  } catch(_) { /* فشل التحديث — نكمل بالبيانات الحالية */ }

  const unavailable = cart.filter(i=>!isItemAvailable(i));
  if (unavailable.length > 0) {
    const ids = unavailable.map(i=>'#'+i.id+' (Q:'+i.size+')').join('، ');
    cleanCart(true); // نحذفها بصمت (سنُظهر رسالة مخصّصة)
    renderCart();
    showDlg('⚠️', t('itemsSoldOut')+'\n\n'+ids, [
      { lbl: t('orderSuccessOk'), cls: 'dlg-yes', fn: ()=>closeDlg() }
    ]);
    return; // نوقف التسجيل
  }

  if (cart.length === 0) { notify(t('cartEmpty'),'w'); return; }

  sessionStorage.setItem('ls',String(now));
  let totO=0,totD=0;
  let msg='مرحباً، أرغب بشراء المنتجات التالية:\n';
  cart.forEach(i=>{ msg+='- ID: '+sanitize(String(i.id))+'، القياس: '+sanitize(String(i.size))+'، السعر الأصلي: '+Number(i.orig).toLocaleString()+' دينار، بعد الخصم '+DISCOUNT_PCT+'%: '+Number(i.disc).toLocaleString()+' دينار\n'; totO+=Number(i.orig); totD+=Number(i.disc); });
  const ship=calcShip(cart), total=totD+ship;
  msg+='\nالمجموع الأصلي: '+totO.toLocaleString()+' دينار\n';
  msg+='المجموع بعد الخصم '+DISCOUNT_PCT+'%: '+totD.toLocaleString()+' دينار\n';
  msg+='تكلفة النقل: '+(ship===0 ? 'مجاني 🎉' : ship.toLocaleString()+' دينار')+'\n';
  msg+='المجموع النهائي: '+total.toLocaleString()+' دينار\n\n';
  msg+='معلومات الزبون:\nالاسم: '+name+'\nالهاتف: '+phone+'\nالعنوان: '+addr;

  /* ===== منع الضغط المتكرر: تعطيل الزر فوراً ===== */
  const confirmBtn = document.getElementById('ckConfirm');
  if (confirmBtn) {
    if (confirmBtn.dataset.busy === '1') return; // قيد المعالجة — تجاهل
    confirmBtn.dataset.busy = '1';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
  }

  /* ===== الخطوة 1: إظهار شاشة "جاري التسجيل" ===== */
  showSavingOverlay();

  /* ===== الخطوة 2: تسجيل الطلب وانتظار تأكيد GAS ===== */
  const savePromise = saveOrderToGAS({
    action:  'saveOrder',
    orderId: orderId,
    name:    name,
    phone:   phone,
    address: addr,
    message: msg,
    total:   total,
    channel: 'website',
    items:   JSON.stringify(cart.map(function(i){ return {id:String(i.id), size:String(i.size)}; }))
  });

  const timeoutPromise = new Promise(function(resolve){
    setTimeout(function(){ resolve({ success: true, timeout: true }); }, 8000);
  });

  const saveResult = await Promise.race([savePromise, timeoutPromise]);

  /* ===== الخطوة 3: إخفاء الشاشة ===== */
  hideSavingOverlay();

  /* ===== الخطوة 4: أحداث Meta — فور تأكيد التسجيل ===== */
  try {
    if (saveResult && saveResult.success && !saveResult.timeout) {
      // Lead (تسجيل الاهتمام) + Purchase (قيمة الشراء) — بنفس القيمة الصحيحة
      if (typeof metaLead === 'function')     metaLead(cart, total, orderId, phone, name);
      if (typeof metaPurchase === 'function') metaPurchase(cart, total, orderId, phone, name);
    }
  } catch(_) {}

  /* ===== إعادة تفعيل الزر (لأي حالة) ===== */
  function reEnableBtn() {
    if (confirmBtn) {
      confirmBtn.dataset.busy = '0';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
  }

  /* ===== الخطوة 5: النجاح — إغلاق فوري + إفراغ السلة ===== */
  if (saveResult && saveResult.success) {
    // نُفرغ السلة ونُغلق نافذة الطلب فوراً
    cart = []; saveCart(); updateCartBadge();
    closeCheckout();
    reEnableBtn();
    // نافذة النجاح مع رقم الطلب + نسخ تلقائي
    showOrderSuccess(orderId);
  } else {
    // فشل التسجيل — نُعيد تفعيل الزر ليعيد المحاولة
    reEnableBtn();
    showDlg('⚠️', t('orderFail'), [
      { lbl: t('tryAgain'), cls: 'dlg-yes', fn: ()=>closeDlg() }
    ]);
  }
}
document.getElementById('ckConfirm').addEventListener('click',()=>submitOrder());

/* ==================== PWA ==================== */
function setupPWA(){
  const m={name:'متجر جود العباس',short_name:'جود العباس',start_url:'./',display:'standalone',background_color:'#1565C0',theme_color:'#1565C0',lang:'ar',icons:[{src:'https://raw.githubusercontent.com/sa89588/clothing-search/refs/heads/main/kids-clothing-store.png',sizes:'192x192',type:'image/png'},{src:'https://raw.githubusercontent.com/sa89588/clothing-search/refs/heads/main/kids-clothing-store.png',sizes:'512x512',type:'image/png'}]};
  const blob=new Blob([JSON.stringify(m)],{type:'application/json'});
  document.getElementById('pwaManifest').href=URL.createObjectURL(blob);
}
let _pwaEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_pwaEvt=e;});
window.addEventListener('appinstalled',()=>{_pwaEvt=null;notify('✅ '+t('appInstalled'),'s');});

function detectPlatform(){
  const ua=navigator.userAgent;
  return {
    isIOS:/iPad|iPhone|iPod/.test(ua)&&!window.MSStream,
    isAndroid:/Android/.test(ua),
    isStandalone:window.matchMedia('(display-mode: standalone)').matches||!!window.navigator.standalone
  };
}

function showPWAInstallModal(){
  const p=detectPlatform();
  const modal=document.getElementById('pwaInstallModal');
  const body=document.getElementById('pwaModalBody');
  const instBtn=document.getElementById('pwaModalInstBtn');
  body.innerHTML='';

  if(p.isStandalone){
    const msg=document.createElement('p');
    msg.style.cssText='text-align:center;padding:16px;color:var(--muted);font-size:15px;';
    msg.textContent='✅ '+t('alreadyInstalled');
    body.appendChild(msg);
    instBtn.style.display='none';
  } else if(_pwaEvt){
    // Android Chrome
    const badge=document.createElement('div'); badge.className='pwa-badge'; badge.textContent='Android';
    const desc=document.createElement('p'); desc.style.cssText='margin:10px 0 14px;color:var(--txt2);';
    desc.textContent=t('androidInstallDesc');
    body.appendChild(badge); body.appendChild(desc);
    instBtn.style.display='block'; instBtn.className='dlg-btn dlg-ok';
    instBtn.textContent='📲 '+t('installNow');
    instBtn.onclick=async()=>{ _pwaEvt.prompt(); const r=await _pwaEvt.userChoice; if(r.outcome==='accepted'){_pwaEvt=null;closePWAModal();} };
  } else if(p.isIOS){
    // iOS Safari
    const badge=document.createElement('div'); badge.className='pwa-badge'; badge.textContent='iPhone / iPad';
    const steps=[
      {icon:'fa-safari',text:t('iosStep1')},
      {icon:'fa-share-from-square',text:t('iosStep2')},
      {icon:'fa-plus-square',text:t('iosStep3')},
      {icon:'fa-check-circle',text:t('iosStep4')},
    ];
    const ul=document.createElement('ul'); ul.className='pwa-steps';
    steps.forEach(s=>{ const li=document.createElement('li'); li.innerHTML='<i class="fas '+s.icon+'"></i>'; li.appendChild(document.createTextNode(s.text)); ul.appendChild(li); });
    body.appendChild(badge); body.appendChild(ul);
    instBtn.style.display='none';
  } else {
    // Desktop / other
    const badge=document.createElement('div'); badge.className='pwa-badge'; badge.textContent='Desktop';
    const steps=[
      {icon:'fa-ellipsis-v',text:t('desktopStep1')},
      {icon:'fa-download',text:t('desktopStep2')},
      {icon:'fa-check-circle',text:t('desktopStep3')},
    ];
    const ul=document.createElement('ul'); ul.className='pwa-steps';
    steps.forEach(s=>{ const li=document.createElement('li'); li.innerHTML='<i class="fas '+s.icon+'"></i>'; li.appendChild(document.createTextNode(s.text)); ul.appendChild(li); });
    body.appendChild(badge); body.appendChild(ul);
    instBtn.style.display='none';
  }
  modal.classList.add('open'); document.body.style.overflow='hidden';
}
function closePWAModal(){
  document.getElementById('pwaInstallModal').classList.remove('open');
  document.body.style.overflow='';
  setNavActive('bnHome');
}
document.getElementById('pwaModalClose').addEventListener('click',closePWAModal);
document.getElementById('pwaInstallModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closePWAModal();});
document.getElementById('pwaSkip').addEventListener('click',()=>document.getElementById('pwaBar').style.display='none');
document.getElementById('bnInstall').addEventListener('click',()=>{ setNavActive('bnInstall'); showPWAInstallModal(); });

/* ==================== TUTORIAL ==================== */
function showTutorial(){
  let step=0;
  const panel=document.getElementById('tutPnl');
  const next=document.getElementById('tutNext');
  const skip=document.getElementById('tutSkip');
  const dotsEl=document.getElementById('tutDots');
  const steps=()=>L[lang].tut;
  function buildDots(){ dotsEl.innerHTML=''; steps().forEach((_,i)=>{const d=document.createElement('div');d.className='tut-dot'+(i===step?' on':'');dotsEl.appendChild(d);}); }
  function show(s){ step=s; document.getElementById('tutTxt').innerHTML=steps()[s]; document.getElementById('tutStep').textContent=(s+1)+' / '+steps().length; next.textContent=s<steps().length-1?'التالي':t('fpClose'); buildDots(); }
  // Reset listeners by cloning
  const newNext=next.cloneNode(true); next.parentNode.replaceChild(newNext,next);
  const newSkip=skip.cloneNode(true); skip.parentNode.replaceChild(newSkip,skip);
  function closeTut(){ panel.classList.remove('open'); localStorage.setItem('tut','1'); document.body.style.overflow=''; }
  document.getElementById('tutNext').addEventListener('click',()=>{ if(step<steps().length-1) show(step+1); else closeTut(); });
  document.getElementById('tutSkip').addEventListener('click',closeTut);
  show(0); panel.classList.add('open'); document.body.style.overflow='hidden';
}
function initTutorial(){ if(!localStorage.getItem('tut')) showTutorial(); }

/* ==================== AUTO REFRESH ==================== */
setInterval(async()=>{
  try{

    const r = await fetch(API);
    if(!r.ok) return;

    const newData = await r.json();

    localStorage.setItem(
      'pc',
      JSON.stringify({d:newData,ts:Date.now()})
    );

    document.getElementById('offlineBar')
      .classList.remove('show');

    addJsonLD(newData);

    const oldIds = new Set(
      allData.map(x=>String(x.Id))
    );

    const newIds = new Set(
      newData.map(x=>String(x.Id))
    );

    oldIds.forEach(id=>{
      if(!newIds.has(id)){

        const cards =
          document.querySelectorAll('.pcard');

        cards.forEach(card=>{
          const cid =
            card.querySelector('.cid');

          if(
            cid &&
            cid.textContent.includes(id)
          ){
            card.remove();
          }
        });

      }
    });

    allData = newData;

    updateFilterCounts();
    cleanCart(false); // حذف ما نفد من السلة تلقائياً

  }catch(_){}
},25000);

/* ==================== KEYBOARD ==================== */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ closeLB();closeSzDlg();closeDlg();closeCheckout();closeSheets();closePWAModal(); document.getElementById('fpanel').classList.remove('open'); document.getElementById('tutPnl').classList.remove('open'); document.body.style.overflow=''; }
});

/* ==================== INIT ==================== */
document.addEventListener('DOMContentLoaded',()=>{
  setupPWA(); startCountdown(); loadCart(); initPTR();
  if(localStorage.getItem('dk')==='1'){ document.body.classList.add('dark'); document.getElementById('darkBtn').innerHTML='<i class="fas fa-sun"></i>'; }
  document.getElementById('promoX').addEventListener('click',()=>document.getElementById('promoBanner').style.display='none');
  fetchData();
  setTimeout(initTutorial,500);
});
