/* ===== Jood ALabbas Store — App Logic ===== */
'use strict';

/* ==================== STATE ==================== */
const API = 'https://script.google.com/macros/s/AKfycbwK-ocQW5eO9n0_8qKy2o34dVjFT2Qyb2vE5HWVIoAU6KrwqwbcDiVT8dhmXOtGs3eEBw/exec';
const PLACEHOLDER = 'https://placehold.co/300x300?text=?';

/* ==================== إعدادات الخصم والتوصيل ====================
   مكان واحد للتحكم — أي تغيير هنا ينعكس على كل الموقع */
/* ==================== الإعدادات المركزية ====================
   • القيم هنا افتراضية فقط — تُستبدل بما يصل من ورقة Settings
   • كل التحكم يتم من لوحة الإدارة، لا من هذا الملف */
const APP_VERSION = '1.1.0';        // إصدار الملفات المحلي

const SETTINGS = {
  discountRules: {
    base: 40,
    pieceRules: [],                 // [{maxPieces, pct}]
    sizeBonus:  []                  // [{sizes:[...], pct}]
  },
  shipCost:     5000,
  freeShipQty:  6,
  sortDefault:  'pieces_asc',
  fabricText:   'قطني 100%',
  storeTexts:   {},               // تجاوزات النصوص من اللوحة
  banners:      [],               // الشارات والإعلانات المضافة من اللوحة
  trustItems:   '',               // ضمانات الشراء
  fabricNote:   '',
  promoText:    '',
  promoEnabled: true,
  assetVersion: APP_VERSION,
  cheapRule: {
    enabled: false, maxPrice: 0, perCheap: 2, needRegular: 1,
    penaltyMode: 'noDiscount', penaltyPct: 0, penaltyAmount: 0
  }
};

/* ===== محرّك الخصم =====
   القاعدة: نحسب الأساس من عدد القطع، ثم نرفعه (ولا نخفضه) بمكافأة القياس */
function baseDiscPct(item){
  const n = parseSizes(item && item.sizes).length;
  const rules = (SETTINGS.discountRules.pieceRules || [])
                  .slice()
                  .sort((a,b)=>Number(a.maxPieces)-Number(b.maxPieces));
  for(const r of rules){
    if(n > 0 && n <= Number(r.maxPieces)) return Number(r.pct);
  }
  return Number(SETTINGS.discountRules.base) || 40;
}

/* مكافأة القياس — تُرجع 0 إن لا مكافأة */
function sizeBonusPct(size){
  const s = String(size).trim();
  for(const b of (SETTINGS.discountRules.sizeBonus || [])){
    const list = (b.sizes || []).map(x=>String(x).trim());
    if(list.indexOf(s) !== -1) return Number(b.pct) || 0;
  }
  return 0;
}

/* النسبة النهائية لقياس معيّن داخل موديل */
function discPctFor(item, size){
  const base = baseDiscPct(item);
  if(size === undefined || size === null) return base;
  return Math.max(base, sizeBonusPct(size));
}

/* أعلى/أدنى نسبة داخل الموديل (لعرض النطاق على البطاقة) */
function itemPctRange(item){
  const sizes = parseSizes(item && item.sizes);
  if(!sizes.length){ const b=baseDiscPct(item); return {min:b,max:b}; }
  let mn=Infinity, mx=-Infinity;
  sizes.forEach(sz=>{ const p=discPctFor(item,sz); if(p<mn)mn=p; if(p>mx)mx=p; });
  return {min:mn, max:mx};
}

/* سعر القطعة بعد الخصم */
function discPrice(orig, pct){
  const p = Number(pct);
  const use = isFinite(p) && p>0 ? p : (Number(SETTINGS.discountRules.base)||40);
  return Math.round(Number(orig) * (100 - use) / 100);
}

/* توافق مع الاستدعاءات القديمة */
function itemDiscPct(item){ return baseDiscPct(item); }
function isClearance(item){
  const rules = SETTINGS.discountRules.pieceRules || [];
  if(!rules.length) return false;
  const top = rules.slice().sort((a,b)=>Number(b.pct)-Number(a.pct))[0];
  return baseDiscPct(item) === Number(top.pct) && Number(top.pct) > (Number(SETTINGS.discountRules.base)||40);
}

/* اختصارات للتوصيل (تُقرأ من الإعدادات) */
function shipCost(){ return Number(SETTINGS.shipCost)||0; }
function freeShipQty(){ return Number(SETTINGS.freeShipQty)||0; }

/* تكلفة التوصيل حسب عدد القطع — مجاني عند 6 قطع أو أكثر */
function calcShip(items){
  const n = Array.isArray(items) ? items.length : Number(items||0);
  return n >= freeShipQty() ? 0 : shipCost();
}
/* هل التوصيل مجاني؟ */
function isFreeShip(items){ return calcShip(items) === 0; }
let allData = [], cart = [], lang = 'ar';
let fSea = '', fTyp = '', fSort = '', fFav = false;
/* القسم والعمر صارا اختياراً متعدّداً (زر مجمّع يفتح لوحة اختيار) */
let fGenSet = new Set();
let fAgeSet = new Set();

/* ===== تجاوزات النصوص من لوحة الإدارة =====
   أيّ نص في المتجر يمكن تغييره من اللوحة بلا لمس الكود. الشكل:
     { "hTitle":"...", "footer":"..." }            ← لكل اللغات
     { "ar":{...}, "en":{...}, "ku":{...} }        ← لكل لغة على حدة
   ويجوز الخلط: المفتاح الخاص باللغة يتقدّم على العام. */
let TXT = {};

function t(k){
  if(TXT){
    const perLang = TXT[lang];
    if(perLang && typeof perLang === 'object' && perLang[k]) return perLang[k];
    if(typeof TXT[k] === 'string' && TXT[k]) return TXT[k];
  }
  return (L[lang]&&L[lang][k]) ? L[lang][k] : (L.ar[k]||k);
}


/* يبحث عن عمود بمرونة: يتجاهل حالة الأحرف والمسافات */
function pickField(item, field){
  if(!item) return undefined;
  if(item[field] !== undefined) return item[field];
  const want = String(field).toLowerCase().replace(/[\s_-]/g,'');
  for(const k in item){
    if(String(k).toLowerCase().replace(/[\s_-]/g,'') === want) return item[k];
  }
  return undefined;
}

/* ==================== خامة القماش ====================
   • القيمة الافتراضية تظهر على كل بطاقة
   • لو أضفت عمود «fabric» في ورقة Data، يعرض قيمة كل موديل بدلاً منها
     (يقبل: fabric / Fabric / خامة / القماش) */
const DEFAULT_FABRIC = 'قطني 100%';
const FABRIC_KEYS    = ['fabric','material','خامة','الخامة','القماش','قماش'];

function getFabric(item){
  if(item){
    for(const k of FABRIC_KEYS){
      const v = pickField(item, k);
      if(v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
  }
  return DEFAULT_FABRIC;
}



/* ==================== قاعدة القطع المميزة (السعر المشروط) ====================
   القطعة «مميزة» = سعرها الأصلي ≤ الحد المحدد.
   خصمها مشروط بشراء عدد من القطع العادية — وإلا يُطبَّق السعر غير الملتزم. */

function cheapCfg(){
  const c = SETTINGS.cheapRule || {};
  return {
    enabled:      c.enabled !== false && Number(c.maxPrice) > 0,
    maxPrice:     Number(c.maxPrice)    || 0,
    perCheap:     Number(c.perCheap)    || 1,
    needRegular:  Number(c.needRegular) || 1,
    penaltyMode:  c.penaltyMode || 'noDiscount',   // noDiscount | lowPct | addAmount
    penaltyPct:   Number(c.penaltyPct)   || 0,
    penaltyAmount:Number(c.penaltyAmount)|| 0
  };
}

/* هل القطعة مميزة؟ (حسب السعر الأصلي) */
function isCheapPrice(orig){
  const c = cheapCfg();
  return c.enabled && Number(orig) > 0 && Number(orig) <= c.maxPrice;
}
function isCheapItem(item){ return isCheapPrice(parseFloat(item && item.price)); }

/* حالة السلة تجاه القاعدة */
function cheapStatus(){
  const c = cheapCfg();
  const out = { enabled:c.enabled, cheap:0, regular:0, required:0, missing:0, ok:true, saving:0 };
  if(!c.enabled) return out;

  cart.forEach(i=>{ if(isCheapPrice(i.orig)) out.cheap++; else out.regular++; });
  if(out.cheap === 0) return out;

  out.required = Math.ceil(out.cheap / c.perCheap) * c.needRegular;
  out.missing  = Math.max(0, out.required - out.regular);
  out.ok       = out.missing === 0;

  /* كم يوفّر الزبون لو التزم؟ */
  cart.forEach(i=>{
    if(!isCheapPrice(i.orig)) return;
    out.saving += cheapPenaltyPrice(i) - cheapRewardPrice(i);
  });
  return out;
}

/* السعر عند الالتزام = الخصم العادي */
function cheapRewardPrice(ci){
  return Number(ci.disc) || discPrice(ci.orig, ci.pct);
}
/* السعر عند عدم الالتزام */
function cheapPenaltyPrice(ci){
  const c = cheapCfg();
  const orig = Number(ci.orig) || 0;
  if(c.penaltyMode === 'lowPct')    return discPrice(orig, c.penaltyPct);
  if(c.penaltyMode === 'addAmount') return cheapRewardPrice(ci) + c.penaltyAmount;
  return Math.round(orig);                       // noDiscount: السعر الأصلي
}

/* السعر الفعلي لأي عنصر في السلة (يراعي القاعدة) */
function itemPrice(ci, status){
  const st = status || cheapStatus();
  if(!st.enabled || !isCheapPrice(ci.orig)) return Number(ci.disc)||0;
  return st.ok ? cheapRewardPrice(ci) : cheapPenaltyPrice(ci);
}
/* مجموع السلة الفعلي */
function cartSum(){
  const st = cheapStatus();
  return cart.reduce((s,ci)=>s+itemPrice(ci,st), 0);
}

/* ==================== تحميل الإعدادات من الإدارة ==================== */
function applySettings(s){
  if(!s) return;
  try{
    if(s.discountRules){
      const dr = typeof s.discountRules==='string' ? JSON.parse(s.discountRules) : s.discountRules;
      if(dr && typeof dr==='object'){
        SETTINGS.discountRules = {
          base:       Number(dr.base)||40,
          pieceRules: Array.isArray(dr.pieceRules)? dr.pieceRules : [],
          sizeBonus:  Array.isArray(dr.sizeBonus) ? dr.sizeBonus  : []
        };
      }
    }
    if(s.shipCost    !== undefined) SETTINGS.shipCost    = Number(s.shipCost)||0;
    if(s.freeShipQty !== undefined) SETTINGS.freeShipQty = Number(s.freeShipQty)||0;
    if(s.sortDefault) SETTINGS.sortDefault = String(s.sortDefault);
    if(s.fabricText)  SETTINGS.fabricText  = String(s.fabricText);
    if(s.fabricNote !== undefined) SETTINGS.fabricNote = String(s.fabricNote);
    if(s.promoText  !== undefined) SETTINGS.promoText  = String(s.promoText);
    if(s.promoEnabled !== undefined) SETTINGS.promoEnabled = String(s.promoEnabled)==='1' || s.promoEnabled===true;
    if(s.assetVersion) SETTINGS.assetVersion = String(s.assetVersion);
    /* نصوص اللوحة وشاراتها */
    if(s.storeTexts !== undefined){
      const st = typeof s.storeTexts==='string' ? (s.storeTexts ? JSON.parse(s.storeTexts) : {}) : s.storeTexts;
      TXT = (st && typeof st==='object') ? st : {};
      SETTINGS.storeTexts = TXT;
    }
    if(s.banners !== undefined){
      const bn = typeof s.banners==='string' ? (s.banners ? JSON.parse(s.banners) : []) : s.banners;
      SETTINGS.banners = Array.isArray(bn) ? bn : [];
    }
    if(s.trustItems !== undefined) SETTINGS.trustItems = s.trustItems;
    if(s.cheapRule){
      const cr = typeof s.cheapRule==='string' ? JSON.parse(s.cheapRule) : s.cheapRule;
      if(cr && typeof cr==='object') SETTINGS.cheapRule = cr;
    }
  }catch(e){ console.warn('applySettings:', e.message); }
}

/* تطبيق النصوص القابلة للتخصيص على الصفحة */
function applySettingsToUI(){
  /* النصوص أولاً: applyTrans يكتب النصوص من ملف اللغات (ومن تجاوزات
     اللوحة)، فلو جاء بعدها لمَسَح ما تضعه الإعدادات أدناه — كنصّ العرض. */
  try{ applyTrans(); }catch(_){}

  /* عدد أعمدة الشبكة — يُضبط من لوحة الإدارة
     'auto' = حسب عرض الشاشة (الافتراضي) · أو 2 / 3 / 4 */
  try{
    const c = String(SETTINGS.gridCols || 'auto');
    document.body.dataset.cols = /^[234]$/.test(c) ? c : 'auto';
  }catch(_){}

  /* ملاحظة الخامة — مخفيّة ما لم يكتب صاحب المتجر نصّاً لها */
  const note = document.getElementById('fabricNote');
  if(note){
    if(SETTINGS.fabricNote){
      const sp = note.querySelector('span');
      if(sp) sp.textContent = String(SETTINGS.fabricNote);
      note.style.display = 'flex';
    } else { note.style.display = 'none'; }
  }
  // شريط العرض
  const promo = document.getElementById('promoBanner');
  const ptxt  = document.getElementById('promoTxt');
  if(promo){
    if(!SETTINGS.promoEnabled){ promo.style.display='none'; }
    else {
      promo.style.display = '';
      if(ptxt && SETTINGS.promoText) ptxt.textContent = SETTINGS.promoText;
    }
  }
  /* الشارات المضافة من اللوحة */
  renderBanners();
}

/* جلب الإعدادات — كاش محلي للسرعة ثم تحديث بالخلفية */
async function loadSettings(){
  // ① الكاش (فوري)
  try{
    const c = JSON.parse(localStorage.getItem('cfg')||'null');
    if(c && c.s){ applySettings(c.s); }
  }catch(_){}

  // ② الشبكة (محدَّث)
  try{
    const r = await fetch(API+'?action=getSettings', {cache:'no-store'});
    const d = await r.json();
    if(d && d.success && d.settings){
      applySettings(d.settings);
      localStorage.setItem('cfg', JSON.stringify({s:d.settings, ts:Date.now()}));
      checkAssetVersion(d.settings.assetVersion);
      return true;
    }
  }catch(e){ console.warn('loadSettings:', e.message); }
  return false;
}

/* كسر التخزين المؤقت: لو نُشر إصدار أحدث، نعيد التحميل بنسخة جديدة */
function checkAssetVersion(remote){
  if(!remote) return;
  const stored = localStorage.getItem('assetV');

  /* أول زيارة: نحفظ الإصدار بصمت — لا إعادة تحميل (تسبب وميضاً مربكاً) */
  if(!stored){ localStorage.setItem('assetV', String(remote)); return; }

  if(String(remote) === String(stored)) return;

  /* إصدار جديد فعلاً: نحفظه ونعيد التحميل مرة واحدة */
  localStorage.setItem('assetV', String(remote));
  if(sessionStorage.getItem('vReloaded') === String(remote)) return;
  sessionStorage.setItem('vReloaded', String(remote));
  console.log('🔄 إصدار جديد ('+remote+') — إعادة تحميل');
  location.reload();
}

/* ==================== SECURITY UTILS ==================== */
function sanitize(str){ const d=document.createElement('div'); d.appendChild(document.createTextNode(String(str==null?'':str))); return d.innerHTML; }
/* ===== تسريع الصور =====
   raw.githubusercontent ليس شبكة توزيع: يُخدَم من خادم واحد بلا تخزين قريب.
   jsDelivr يخدم نفس الملف بنفس الصيغة من أقرب خادم للزبون — مجاناً.
   ونفضّل النسخة المصغّرة (THUMB/) للبطاقات حين تتوفر. */
const CDN_FROM = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/(?:refs\/heads\/)?([^/]+)\/(.+)$/;

function toCDN(url){
  try{
    const m = String(url).match(CDN_FROM);
    if(!m) return url;
    return 'https://cdn.jsdelivr.net/gh/' + m[1] + '/' + m[2] + '@' + m[3] + '/' + m[4];
  }catch(_){ return url; }
}

/* النسخة المصغّرة للبطاقة (أخف بكثير على شبكة الهاتف) */
function thumbOf(url){
  try{
    const u = String(url);
    if(u.indexOf('/THUMB/') > -1) return u;
    return u.replace(/\/WEBP\//, '/THUMB/');
  }catch(_){ return url; }
}

function safeImgSrc(url, wantThumb){
  if(!url || typeof url!=='string') return PLACEHOLDER;
  try{
    const u = new URL(url);
    if(u.protocol!=='https:' && u.protocol!=='http:') return PLACEHOLDER;
    const cdn = toCDN(url);
    return wantThumb ? thumbOf(cdn) : cdn;
  } catch(_){ return PLACEHOLDER; }
}

/* ==================== LANGUAGE ==================== */
function setLang(l){
  lang=l;
  try{ localStorage.setItem('lang', l); }catch(_){}   /* يُحفظ الاختيار */
  const root=document.getElementById('htmlRoot');
  root.lang=l; root.dir=L[l].dir;
  document.querySelectorAll('.lopt').forEach(b=>b.classList.toggle('on',b.dataset.lang===l));
  applyTrans();
  updateFilterCounts();
  doFilter();
}
function applyTrans(){
  const map={
    hTitle:'hTitle',hSub:'hSub',welcomeEl:'welcome',
    pkDone:'pkDone',
    navFav:'navFav',prodShTitle:'prodTitle',navInstall:'navInstall',
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
  document.getElementById('ckAddr').placeholder=t('addrPh2')||t('addrPh');
  const _g0=document.querySelector('#ckGov option[value=""]'); if(_g0) _g0.textContent=t('govPh');
  const _cp=document.querySelector('.ck-pay b'); if(_cp) _cp.textContent=t('codNote');
  const _tr=document.getElementById('trackIn'); if(_tr) _tr.placeholder=t('trackPh');
  /* نصّ العرض: ما كتبه صاحب المتجر في اللوحة يتقدّم على نص اللغة */
  { const _p=document.getElementById('promoTxt');
    if(_p) _p.textContent = SETTINGS.promoText || t('promo'); }
  /* نصّا الزرّين المجمّعين يُبنيان من المجموعات، لا من خريطة ثابتة */
  if(typeof syncPickBtns === 'function') syncPickBtns();
  { const _n=document.getElementById('ckNotes'); if(_n) _n.placeholder=t('notesPh'); }
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

/* ===== المفضلة عرضٌ قائم بذاته، كالرئيسية =====
   مفتاح واحد يضبط الحالة والزر والشبكة معاً، فلا تفترق الواجهة
   عن المعروض: كان زر «الرئيسية» يُضيء وحده والشبكة ما زالت مفضلة. */
function setFav(on){
  fFav = !!on;
  const bf = document.getElementById('bnFav');
  if(bf) bf.classList.toggle('on', fFav);
  setNavActive(fFav ? 'bnFav' : 'bnHome');
  doFilter(false);
}

/* إغلاق أي نافذة يُعيد الإضاءة للعرض الحالي لا للرئيسية دائماً */
function navRestore(){ setNavActive(fFav ? 'bnFav' : 'bnHome'); }

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
document.getElementById('bnHome').addEventListener('click',()=>{
  /* «الرئيسية» تعني الخروج من المفضلة والعودة لكل المنتجات */
  if(fFav) setFav(false); else setNavActive('bnHome');
  window.scrollTo({top:0,behavior:'smooth'});
});
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
  const _gov=(document.getElementById('ckGov')||{}).value||'';
  const addr=(_gov? _gov+' - ':'')+document.getElementById('ckAddr').value.trim();
  let totO=0,totD=0;
  let msg='مرحباً، أرغب بشراء المنتجات التالية:\n';
  const _st=cheapStatus();
  cart.forEach(i=>{
    const eff=itemPrice(i,_st);
    const p=Math.round((1-eff/Number(i.orig))*100);
    const tag=(_st.enabled&&isCheapPrice(i.orig)) ? (_st.ok?' ⭐':' (سعر غير مخفّض)') : '';
    msg+='- ID: '+sanitize(String(i.id))+'، القياس: '+sanitize(String(i.size))+'، السعر الأصلي: '+Number(i.orig).toLocaleString()+' دينار، بعد الخصم '+p+'%: '+eff.toLocaleString()+' دينار'+tag+'\n';
    totO+=Number(i.orig); totD+=eff;
  });
  const ship=calcShip(cart),total=totD+ship;
  msg+='\nالمجموع الأصلي: '+totO.toLocaleString()+' دينار\n';
  msg+='المجموع بعد الخصم: '+totD.toLocaleString()+' دينار\n';
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
  ['cartSheet','filterSheet','contactSheet','trackSheet','prodSheet'].forEach(s=>{const e=document.getElementById(s); if(e) e.classList.remove('open');});
  document.getElementById('shOv').classList.remove('open');
  document.body.style.overflow='';
  navRestore();
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
  if(badge){ badge.textContent=cnt; badge.style.display=cnt?'inline-flex':'none'; }
  if(btn)   btn.classList.toggle('active-filters',cnt>0);
  if(clrBtn) clrBtn.classList.toggle('show',cnt>0);
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
const _bf=document.getElementById('bnFav');
if(_bf) _bf.addEventListener('click', function(){
  setFav(!fFav);
  if(fFav && !favs.length){ notify(t('favEmpty'),'i'); }
  window.scrollTo({top:0, behavior:'smooth'});
});
const _ti=document.getElementById('trackIn');
if(_ti){ try{ const lo=localStorage.getItem('lastOrder'); if(lo) _ti.value=lo; }catch(_){} }
const _gv=document.getElementById('ckGov');
if(_gv){
  try{ const sv=localStorage.getItem('gov'); if(sv) _gv.value=sv; }catch(_){}
  _gv.addEventListener('change', function(){ try{ localStorage.setItem('gov', this.value); }catch(_){} });
}
const _pc=document.getElementById('prodShClose'); if(_pc) _pc.addEventListener('click', closeProduct);
const _fcb=document.getElementById('fltClearBtn'); if(_fcb) _fcb.addEventListener('click',()=>{ fSea='';fTyp='';fSort=''; document.querySelectorAll('.filt-tab').forEach(b=>b.classList.toggle('on',b.dataset.v==='')); updateFltBadge(); doFilter(); });
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

/* قائمة المنتجات كما يجب أن تظهر الآن — بلا رسم.
   يستعملها doFilter والتحديث التلقائي معاً. */
function filteredSorted(){
  const q=document.getElementById('searchIn').value.trim().toLowerCase();
  let f=[...allData];
  if(fSea) f=f.filter(i=>i.season===fSea);
  if(fTyp) f=f.filter(i=>i.type===fTyp);
  /* الجنس: المشترك يظهر في الفلترين */
  if(fFav) f=f.filter(i=>isFav(i.Id));
  if(fGenSet.size) f=f.filter(i=>{ const g=genderOf(i); return fGenSet.has(g) || g==='unisex'; });
  /* العمر: الموديل يظهر إن كان فيه قياس واحد على الأقل من الفئات المختارة */
  if(fAgeSet.size) f=f.filter(i=>agesOf(i).some(k=>fAgeSet.has(k)));
  if(q) f=f.filter(i=>String(i.Id||'').toLowerCase().includes(q)||String(i.sizes||'').toLowerCase().includes(q));
  /* الفرز: اختيار المستخدم، وإلا الافتراضي من لوحة الإدارة */
  const sortMode = fSort || SETTINGS.sortDefault || 'pieces_asc';
  const pcs = x => parseSizes(x.sizes).length;
  if(sortMode==='asc')            f.sort((a,b)=>parseFloat(a.price)-parseFloat(b.price));
  else if(sortMode==='desc')      f.sort((a,b)=>parseFloat(b.price)-parseFloat(a.price));
  else if(sortMode==='pieces_asc')  f.sort((a,b)=>pcs(a)-pcs(b) || String(a.Id).localeCompare(String(b.Id)));
  else if(sortMode==='pieces_desc') f.sort((a,b)=>pcs(b)-pcs(a) || String(a.Id).localeCompare(String(b.Id)));
  return f;
}

function doFilter(scrollTop=true){
  displayProducts(filteredSorted());
  if(scrollTop) window.scrollTo({top:0,behavior:'smooth'});
}


/* ============================================================
   الجنس والعمر — محرّك التصنيف
   ------------------------------------------------------------
   الجنس: من عمود gender في الشيت إن وُجد، وإلا من الحرف الأخير
          في رقم الموديل (G = بنات، B = أولاد). ما عداه غير محدّد.
   العمر: من القياسات. كل قياس يقابل فئة عمرية.
   ============================================================ */

/* عمود الجنس إن أضيف للشيت لاحقاً (يتقدّم على الاستنتاج) */
function genderField(item){
  const keys = ['gender','Gender','الجنس','النوع الجنسي','sex'];
  for(const k of keys){
    const v = item[k];
    if(v===null || v===undefined || v==='') continue;
    const s = String(v).trim().toLowerCase();
    if(/^(g|girl|girls|f|female|بنات|بنت|بناتي|انثى|أنثى)$/.test(s)) return 'girls';
    if(/^(b|boy|boys|m|male|اولاد|أولاد|ولد|ولادي|ذكر)$/.test(s))     return 'boys';
    if(/^(u|uni|unisex|both|مشترك|الاثنين|للجنسين)$/.test(s))         return 'unisex';
  }
  return null;
}

/* استنتاج الجنس من رقم الموديل: الحرف الأخير G أو B */
function genderOf(item){
  const fromCol = genderField(item);
  if(fromCol) return fromCol;
  const id = String(item.Id || '').trim();
  /* نتجاهل أي لاحقة بين قوسين مثل SS-4740B(4) */
  const core = id.replace(/\([^)]*\)\s*$/, '').trim();
  const last = core.slice(-1).toUpperCase();
  if(last === 'G') return 'girls';
  if(last === 'B') return 'boys';
  return '';          /* غير محدّد */
}

/* الفئات العمرية — القياس هو المرجع */
const AGE_GROUPS = [
  { key:'baby',    sizes:[55,60,65,70,75],      ico:'👶', lbl:'ageBaby'    },  /* 0-10 شهر */
  { key:'toddler', sizes:[80,90],               ico:'🧸', lbl:'ageToddler' },  /* 1-2 سنة  */
  { key:'kid',     sizes:[100,110,120],         ico:'🧒', lbl:'ageKid'     },  /* 3-5 سنوات */
  { key:'big',     sizes:[130,140],             ico:'👦', lbl:'ageBig'     },  /* 6-9 سنوات */
  { key:'teen',    sizes:[150,160,170],         ico:'🧑', lbl:'ageTeen'    }   /* 10+ سنة  */
];

function agesOf(item){
  const sizes = parseSizes(item.sizes).map(Number);
  const out = [];
  AGE_GROUPS.forEach(function(g){
    if(sizes.some(function(s){ return g.sizes.indexOf(s) > -1; })) out.push(g.key);
  });
  return out;
}

/* القياسات التي تقع ضمن فئة عمرية (لتصفية الأزرار داخل البطاقة) */
function sizesInAge(ageKey){
  const g = AGE_GROUPS.find(function(x){ return x.key===ageKey; });
  return g ? g.sizes.map(String) : [];
}


/* خطوات الشرح — تمرّ على تجاوزات اللوحة (المفاتيح tut0 … tut6)
   فيستطيع صاحب المتجر تغيير نصّ كل خطوة بلغاتها الثلاث */
function tutSteps(){
  const base = (L[lang] && L[lang].tut) || L.ar.tut || [];
  return base.map(function(s, i){
    const key = 'tut' + i;
    const o = t(key);
    return (o && o !== key) ? o : s;
  });
}

/* ==================== الشارات والإعلانات ====================
   يضيفها صاحب المتجر من اللوحة بلا تعديل الكود. كل شارة:
     { txt, ico, style, place, on, from, to, link }
   المكان (place):  top = شريط أعلى المنتجات
                    float = شارة عائمة في الزاوية
                    prod  = سطر داخل صفحة المنتج
   from/to: تاريخان اختياريان (YYYY-MM-DD) — خارجهما لا تظهر.
   ============================================================ */

function activeBanners(place){
  const all = SETTINGS.banners;
  if(!Array.isArray(all) || !all.length) return [];
  const today = new Date(); today.setHours(0,0,0,0);
  return all.filter(function(b){
    if(!b || b.on === false || b.on === '0') return false;
    if(!String(b.txt||'').trim()) return false;
    if(String(b.place||'top') !== place) return false;
    if(b.from){ const d=new Date(b.from); if(!isNaN(d) && today < d.setHours(0,0,0,0)) return false; }
    if(b.to){   const d=new Date(b.to);   if(!isNaN(d) && today > d.setHours(0,0,0,0)) return false; }
    return true;
  });
}

function buildBanner(b){
  const hasLink = !!String(b.link||'').trim();
  const el = document.createElement(hasLink ? 'a' : 'div');
  el.className = 'ubanner u-' + (String(b.style||'yellow').replace(/[^a-z]/g,'') || 'yellow');
  if(hasLink){ el.href = String(b.link); el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  const ic = document.createElement('span'); ic.className='ub-ico'; ic.textContent = String(b.ico||'🎁');
  const tx = document.createElement('span'); tx.className='ub-txt'; tx.textContent = String(b.txt||'');
  el.appendChild(ic); el.appendChild(tx);
  return el;
}

/* الشريط أعلى المنتجات */
function renderTopBanners(){
  const host = document.getElementById('uBanners');
  if(!host) return;
  host.innerHTML = '';
  activeBanners('top').forEach(function(b){ host.appendChild(buildBanner(b)); });
}

/* الشارات العائمة — تُرصّ فوق شارة العرض */
function renderFloatBanners(){
  let host = document.getElementById('uFloat');
  const list = activeBanners('float');
  if(!list.length){ if(host) host.remove(); return; }
  if(!host){
    host = document.createElement('div');
    host.id = 'uFloat'; host.className = 'ufloat';
    document.body.appendChild(host);
  }
  host.innerHTML = '';
  list.forEach(function(b){
    const el = buildBanner(b);
    el.classList.add('ub-float');
    const x = document.createElement('button');
    x.className = 'ub-x'; x.type='button'; x.textContent='✕';
    x.setAttribute('aria-label', t('hide')||'إخفاء');
    x.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); el.remove();
      if(!host.children.length) host.remove(); });
    el.appendChild(x);
    host.appendChild(el);
  });
}

function renderBanners(){
  try{ renderTopBanners(); renderFloatBanners(); }catch(_){}
}

/* ==================== شارة العرض العائمة ====================
   كانت شريطاً بعرض الشاشة يأكل مساحة المنتجات. صارت شارة صغيرة
   مثبّتة في زاوية، تُخفى بضغطة ويعود إظهارها بزر 🎉 صغير.
   الإخفاء يبقى للجلسة فقط — فيرى الزائر العرض في زيارته القادمة.
   ============================================================ */
function initPromoChip(){
  const chip = document.getElementById('promoBanner');
  const x    = document.getElementById('promoX');
  if(!chip) return;

  /* ارتفاع الترويسة الحقيقي — الشارة تُثبَّت تحتها بلا تراكب */
  const hdr = document.querySelector('header');
  const setHH = function(){
    if(hdr) document.documentElement.style.setProperty('--hh', hdr.offsetHeight + 'px');
  };
  setHH();
  window.addEventListener('resize', setHH);

  /* الإخفاء نهائي لهذه الجلسة — بلا زر عائم يبقى على الشاشة.
     تعود الشارة عند فتح الموقع من جديد. */
  const hide = function(persist){
    chip.classList.add('gone');
    if(persist){ try{ sessionStorage.setItem('promoHid','1'); }catch(_){} }
  };

  if(x) x.addEventListener('click', function(){ hide(true); });

  let hidden = false;
  try{ hidden = sessionStorage.getItem('promoHid') === '1'; }catch(_){}
  if(hidden) hide(false);
}

/* ==================== الفلاتر المجمّعة ====================
   زرّان مضغوطان: «القسم» و«العمر». الضغط يفتح لوحة اختيار
   متعدّد، فيختار الزبون ولادي أو بناتي أو كليهما، وعمراً أو أكثر.
   ============================================================ */

const GEN_OPTS = [
  { v:'boys',  ico:'👦', lbl:'catBoys'  },
  { v:'girls', ico:'👧', lbl:'catGirls' }
];

/* نص الزر حسب ما اختير */
function genLabel(){
  if(!fGenSet.size || fGenSet.size === GEN_OPTS.length) return t('catAll');
  const names = GEN_OPTS.filter(function(o){ return fGenSet.has(o.v); })
                        .map(function(o){ return t(o.lbl); });
  return names.join(' + ');
}
function ageLabel(){
  if(!fAgeSet.size) return t('ageAll');
  if(fAgeSet.size === 1){
    const k = Array.from(fAgeSet)[0];
    const g = AGE_GROUPS.find(function(x){ return x.key===k; });
    return g ? t(g.lbl) : t('ageAll');
  }
  return fAgeSet.size + ' ' + t('ageMany');
}

function syncPickBtns(){
  const gb = document.getElementById('genBtn');
  const ab = document.getElementById('ageBtn');
  if(gb){
    const lb = gb.querySelector('.pk-lbl'); if(lb) lb.textContent = genLabel();
    gb.classList.toggle('on', fGenSet.size > 0 && fGenSet.size < GEN_OPTS.length);
    const ic = gb.querySelector('.pk-ico');
    if(ic) ic.textContent = (!fGenSet.size || fGenSet.size===2) ? '👧👦'
                          : (fGenSet.has('girls') ? '👧' : '👦');
  }
  if(ab){
    const lb = ab.querySelector('.pk-lbl'); if(lb) lb.textContent = ageLabel();
    ab.classList.toggle('on', fAgeSet.size > 0);
  }
}

/* بناء لوحة الاختيار */
function buildPick(kind){
  const box = document.getElementById('pkList');
  const ttl = document.getElementById('pkTitle');
  if(!box) return;
  box.innerHTML = '';
  box.dataset.kind = kind;
  if(ttl) ttl.textContent = t(kind === 'gen' ? 'genLbl' : 'ageLbl');

  const rows = (kind === 'gen')
    ? GEN_OPTS.map(function(o){ return { v:o.v, ico:o.ico, txt:t(o.lbl), on:fGenSet.has(o.v) }; })
    : AGE_GROUPS.map(function(g){ return { v:g.key, ico:g.ico, txt:t(g.lbl), on:fAgeSet.has(g.key) }; });

  /* خيار «الكل» = إفراغ المجموعة */
  const allRow = document.createElement('button');
  const isAll = (kind==='gen') ? (!fGenSet.size || fGenSet.size===GEN_OPTS.length) : !fAgeSet.size;
  allRow.className = 'pk-row pk-all' + (isAll ? ' on' : '');
  allRow.innerHTML = '<span class="pk-r-ico">🛍️</span><span class="pk-r-txt">' +
                     sanitize(t(kind==='gen' ? 'catAll' : 'ageAll')) + '</span><span class="pk-chk"></span>';
  allRow.addEventListener('click', function(){
    if(kind === 'gen') fGenSet.clear(); else fAgeSet.clear();
    persistPicks(); buildPick(kind); applyPicks();
  });
  box.appendChild(allRow);

  rows.forEach(function(r){
    const b = document.createElement('button');
    b.className = 'pk-row' + (r.on ? ' on' : '');
    b.innerHTML = '<span class="pk-r-ico">'+r.ico+'</span><span class="pk-r-txt">'+
                  sanitize(r.txt)+'</span><span class="pk-chk"></span>';
    b.addEventListener('click', function(){
      const set = (kind === 'gen') ? fGenSet : fAgeSet;
      if(set.has(r.v)) set.delete(r.v); else set.add(r.v);
      /* اختيار كل الأجناس = الكل */
      if(kind === 'gen' && fGenSet.size === GEN_OPTS.length) fGenSet.clear();
      persistPicks(); buildPick(kind); applyPicks();
    });
    box.appendChild(b);
  });
}

function applyPicks(){
  syncPickBtns(); updateFilterCounts(); doFilter(false);
}

function persistPicks(){
  try{
    localStorage.setItem('fGenSet', JSON.stringify(Array.from(fGenSet)));
    localStorage.setItem('fAgeSet', JSON.stringify(Array.from(fAgeSet)));
  }catch(_){}
}

function openPick(kind){
  buildPick(kind);
  const ov = document.getElementById('pkOv');
  if(ov){ ov.classList.add('open'); document.body.style.overflow='hidden'; }
}
function closePick(){
  const ov = document.getElementById('pkOv');
  if(ov){ ov.classList.remove('open'); document.body.style.overflow=''; }
}

function initShopNav(){
  const gb = document.getElementById('genBtn');
  const ab = document.getElementById('ageBtn');
  if(gb) gb.addEventListener('click', function(){ openPick('gen'); });
  if(ab) ab.addEventListener('click', function(){ openPick('age'); });

  const done = document.getElementById('pkDone');
  if(done) done.addEventListener('click', function(){ closePick(); window.scrollTo({top:0,behavior:'smooth'}); });
  const x = document.getElementById('pkClose');
  if(x) x.addEventListener('click', closePick);
  const ov = document.getElementById('pkOv');
  if(ov) ov.addEventListener('click', function(e){ if(e.target===e.currentTarget) closePick(); });
}

/* استعادة اختيار الزائر السابق (مع ترحيل الصيغة القديمة) */
function restoreShopNav(){
  try{
    const g = JSON.parse(localStorage.getItem('fGenSet') || 'null');
    const a = JSON.parse(localStorage.getItem('fAgeSet') || 'null');
    if(Array.isArray(g)) fGenSet = new Set(g);
    else { const old = localStorage.getItem('fGen'); if(old) fGenSet = new Set([old]); }
    if(Array.isArray(a)) fAgeSet = new Set(a);
    else { const old = localStorage.getItem('fAge'); if(old) fAgeSet = new Set([old]); }
  }catch(_){ fGenSet = new Set(); fAgeSet = new Set(); }
  syncPickBtns();
}


/* ============================================================
   صفحة المنتج — رابط خاص لكل موديل  (?id=SSP-1058G)
   ------------------------------------------------------------
   يوصل إعلان ميتا الزبون للمنتج نفسه بدل الصفحة الرئيسية.
   ============================================================ */

function productURL(id){
  return location.origin + location.pathname + '?id=' + encodeURIComponent(String(id));
}

function openProduct(id, push){
  const item = allData.find(function(x){ return String(x.Id)===String(id); });
  if(!item){ notify(t('noRes'),'w'); return; }

  const sizes = parseSizes(item.sizes);
  const orig  = parseFloat(item.price);
  const rng   = itemPctRange(item);
  const g     = genderOf(item);

  const body = document.getElementById('prodBody');
  if(!body) return;
  body.innerHTML = '';

  /* الصورة */
  const ph = document.createElement('div'); ph.className='pv-img';
  const im = document.createElement('img');
  im.src = safeImgSrc(item.picture); im.alt = String(item.Id);
  im.addEventListener('click', function(){ openLB(im.src, item.Id, discPrice(orig, rng.max)); });
  ph.appendChild(im);

  /* شارات */
  const bd = document.createElement('div'); bd.className='pv-badges';
  const b1 = document.createElement('span'); b1.className='badge bdis';
  b1.textContent = t('discPrefix')+' '+(rng.min!==rng.max ? rng.min+'-'+rng.max+'%' : rng.max+'%');
  bd.appendChild(b1);
  if(sizes.length===1){ const b2=document.createElement('span'); b2.className='badge blast'; b2.textContent=t('lastSize'); bd.appendChild(b2); }
  if(g==='girls'||g==='boys'){
    const b3=document.createElement('span'); b3.className='badge bgen '+(g==='girls'?'bgen-g':'bgen-b');
    b3.textContent=(g==='girls'?'👧 ':'👦 ')+t(g==='girls'?'catGirls':'catBoys'); bd.appendChild(b3);
  }
  ph.appendChild(bd);

  /* ===== العمود الجانبي: السعر والتفاصيل بجانب الصورة ===== */
  const side = document.createElement('div'); side.className='pv-side';

  const pr = document.createElement('div'); pr.className='pv-prices';
  const lo = discPrice(orig, rng.max), hi = discPrice(orig, rng.min);
  pr.innerHTML = '<span class="pv-new">'+(rng.min!==rng.max
        ? lo.toLocaleString()+' – '+hi.toLocaleString()
        : lo.toLocaleString())+'</span>'+
     '<span class="pv-cur">'+sanitize(t('dinar'))+'</span>'+
     '<span class="pv-old">'+orig.toLocaleString()+'</span>';

  const meta = document.createElement('div'); meta.className='pv-meta';
  const rows = [
    ['🧵', t('fabricLbl')||'الخامة', getFabric(item)],
    ['🌤️', t('seaLbl'),  String(item.season||'—')],
    ['👕', t('typLbl'),  String(item.type||'—')],
    ['🏷️', 'ID',         String(item.Id)]
  ];
  meta.innerHTML = rows.map(function(r){
    const ltr = (r[1]==='ID') ? ' dir="ltr"' : '';
    return '<div class="pv-row"><span class="pv-k">'+r[0]+' '+sanitize(r[1])+'</span>'+
           '<b class="pv-v"'+ltr+'>'+sanitize(r[2])+'</b></div>';
  }).join('');

  side.appendChild(pr); side.appendChild(meta);

  /* الصورة والعمود جنباً إلى جنب */
  const top = document.createElement('div'); top.className='pv-top';
  top.appendChild(ph); top.appendChild(side);

  /* ===== القياسات ===== */
  const info = document.createElement('div'); info.className='pv-info';

  const szl = document.createElement('div'); szl.className='pv-szlbl';
  szl.textContent = t('tapSizeToAdd');
  const szs = document.createElement('div'); szs.className='pv-sizes';
  sizes.forEach(function(sz){
    const pct = discPctFor(item, sz), price = discPrice(orig, pct);
    const age = L[lang]['s'+sz] || '';
    const bn = document.createElement('button'); bn.className='pv-sz';
    bn.innerHTML = '<span class="pv-sz-n">'+sanitize(String(sz))+'</span>'+
                   (age ? '<span class="pv-sz-a">'+sanitize(age)+'</span>' : '')+
                   '<span class="pv-sz-p">'+price.toLocaleString()+'</span>';
    bn.addEventListener('click', function(){ addToCart(item.Id, sz, orig, price, pct); });
    szs.appendChild(bn);
  });

  /* ===== ضمانات تطمئن الزبون ===== */
  const trust = document.createElement('div'); trust.className='pv-trust';
  trustItems().forEach(function(x){
    const d = document.createElement('div'); d.className='pv-tr';
    d.innerHTML = '<span class="pv-tr-i">'+x.i+'</span><span>'+sanitize(x.t)+'</span>';
    trust.appendChild(d);
  });

  /* إعلانات صاحب المتجر المخصّصة لصفحة المنتج */
  const pvb = document.createElement('div'); pvb.className='pv-banners';
  activeBanners('prod').forEach(function(b){ pvb.appendChild(buildBanner(b)); });

  /* ===== مشاركة واستفسار ===== */
  const acts = document.createElement('div'); acts.className='pv-acts';
  const sh = document.createElement('button'); sh.className='pv-share';
  sh.innerHTML = '🔗 <span>'+sanitize(t('share'))+'</span>';
  sh.addEventListener('click', function(){ shareOneProduct(item); });
  const wa = document.createElement('a'); wa.className='pv-wa'; wa.target='_blank'; wa.rel='noopener';
  wa.href = 'https://wa.me/9647766142936?text=' + encodeURIComponent(
      t('askAbout') + ' #' + item.Id + '\n' + productURL(item.Id));
  wa.innerHTML = '💬 <span>'+sanitize(t('askBtn'))+'</span>';
  acts.appendChild(sh); acts.appendChild(wa);

  info.appendChild(szl); info.appendChild(szs);
  info.appendChild(trust); info.appendChild(pvb); info.appendChild(acts);
  body.appendChild(top); body.appendChild(info);

  /* عنوان النافذة والرابط */
  const ttl = document.getElementById('prodShTitle');
  if(ttl) ttl.textContent = '#' + item.Id;

  openSheet('prodSheet');
  if(push !== false){
    try{ history.pushState({pid:item.Id}, '', productURL(item.Id)); }catch(_){}
  }
  try{ if(typeof metaViewContent==='function') metaViewContent(item.Id, lo, item.season, item.type); }catch(_){}
}

function closeProduct(){
  const s = document.getElementById('prodSheet');
  if(s) s.classList.remove('open');
  const ov = document.getElementById('shOv'); if(ov) ov.classList.remove('open');
  document.body.style.overflow='';
  /* نُنظّف الرابط */
  try{
    if(location.search.indexOf('id=') > -1){
      history.replaceState({}, '', location.origin + location.pathname);
    }
  }catch(_){}
}

function shareOneProduct(item){
  const rng = itemPctRange(item);
  const lo  = discPrice(parseFloat(item.price), rng.max);
  const txt = '🛍️ ' + t('hTitle') + '\n#' + item.Id + ' — ' + lo.toLocaleString() + ' ' + t('dinar') + '\n' + productURL(item.Id);
  if(navigator.share){
    navigator.share({ title: t('hTitle') + ' #' + item.Id, text: txt, url: productURL(item.Id) }).catch(function(){});
  } else {
    if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){ notify(t('linkCopied'),'i'); }).catch(function(){}); }
    else window.open('https://wa.me/?text='+encodeURIComponent(txt), '_blank');
  }
}

/* فتح المنتج تلقائياً إن كان الرابط يحمل ?id= */
function openProductFromURL(){
  try{
    const id = new URLSearchParams(location.search).get('id');
    if(id) setTimeout(function(){ openProduct(id, false); }, 150);
  }catch(_){}
}

/* زر الرجوع في المتصفح */
window.addEventListener('popstate', function(e){
  const s = document.getElementById('prodSheet');
  if(e.state && e.state.pid) openProduct(e.state.pid, false);
  else if(s && s.classList.contains('open')) closeProduct();
});


/* ============================================================
   شريط التوصيل المجاني — يظهر دائماً لا داخل السلة فقط
   ============================================================ */
function updateShipBar(){
  const el = document.getElementById('shipBar');
  if(!el) return;
  const need = freeShipQty() - cart.length;
  if(freeShipQty() <= 0 || shipCost() <= 0){ el.classList.remove('show'); return; }

  if(cart.length === 0){ el.classList.remove('show'); return; }

  const pctv = Math.min(100, Math.round(cart.length / freeShipQty() * 100));
  const fill = el.querySelector('.sb-fill');
  const txt  = el.querySelector('.sb-txt');
  if(fill) fill.style.width = pctv + '%';

  if(need <= 0){
    el.classList.add('done');
    if(txt) txt.textContent = '🎉 ' + t('freeShipWon');
  } else {
    el.classList.remove('done');
    if(txt) txt.textContent = '🚚 ' + t('freeShipNeed').replace('{n}', need);
  }
  el.classList.add('show');
}


/* ============================================================
   المفضلة — يحفظها الزبون ويعود إليها
   ============================================================ */
let favs = [];
function loadFavs(){ try{ favs = JSON.parse(localStorage.getItem('favs')||'[]'); if(!Array.isArray(favs)) favs=[]; }catch(_){ favs=[]; } }
function saveFavs(){ try{ localStorage.setItem('favs', JSON.stringify(favs)); }catch(_){} }
function isFav(id){ return favs.indexOf(String(id)) > -1; }

function toggleFav(id, btn){
  const s = String(id), i = favs.indexOf(s);
  if(i > -1){ favs.splice(i,1); notify(t('favRemoved'),'i'); }
  else { favs.push(s); notify(t('favAdded'),'s'); }
  saveFavs(); updateFavBadge();
  if(btn) btn.classList.toggle('on', isFav(s));
  /* لو كنّا داخل عرض المفضلة نُعيد الرسم */
  if(fFav) doFilter(false);
}

function updateFavBadge(){
  const b = document.getElementById('fdot');
  if(!b) return;
  b.textContent = favs.length;
  b.style.display = favs.length ? 'flex' : 'none';
}

/* زر القلب على البطاقة */
function makeFavBtn(id){
  const b = document.createElement('button');
  b.className = 'fav-btn' + (isFav(id) ? ' on' : '');
  b.type = 'button';
  b.title = t('favT');
  b.setAttribute('aria-label', t('favT'));
  b.textContent = '♥';
  b.addEventListener('click', function(e){ e.stopPropagation(); toggleFav(id, b); });
  return b;
}


/* تسجيل Service Worker — يلزم لتثبيت التطبيق على أندرويد */
function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  if(location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  try{
    navigator.serviceWorker.register('/sw.js').catch(function(){});
  }catch(_){}
}


/* ============================================================
   ضمانات الشراء — تطمئن الزبون قبل الطلب
   ------------------------------------------------------------
   تُقرأ من ورقة Settings (مفتاح trustItems) إن وُجدت،
   وإلا تُستخدم الافتراضية من ملف اللغة.
   الصيغة في الشيت: JSON مثل [{"i":"🛡️","t":"نص"}]
   ============================================================ */
function trustItems(){
  try{
    const raw = SETTINGS.trustItems;
    if(raw){
      const arr = (typeof raw === 'string') ? JSON.parse(raw) : raw;
      if(Array.isArray(arr) && arr.length){
        return arr.slice(0,4).map(function(x){
          return { i: String(x.i || '✅'), t: String(x.t || '') };
        }).filter(function(x){ return x.t; });
      }
    }
  }catch(_){}
  return [
    { i:'🔍', t: t('trustCheck') },
    { i:'🔄', t: t('trustReturn') },
    { i:'💵', t: t('trustCOD') }
  ];
}


/* ============================================================
   «قد يعجبك أيضاً» — اقتراح آخر القطع بقياسات السلة
   ------------------------------------------------------------
   تظهر بعد الضغط على «إتمام الشراء» وقبل نافذة البيانات،
   ولا تظهر إطلاقاً إن لم توجد مطابقات — فلا احتكاك بلا فائدة.
   ============================================================ */

/* القياسات الموجودة في السلة */
function cartSizes(){
  const s = new Set();
  cart.forEach(function(i){ if(i.size) s.add(String(i.size)); });
  return s;
}

/* الفئات العمرية التي تغطيها السلة */
function cartAgeKeys(){
  const szs = cartSizes();
  const out = new Set();
  AGE_GROUPS.forEach(function(g){
    if(g.sizes.some(function(s){ return szs.has(String(s)); })) out.add(g.key);
  });
  return out;
}

function suggestions(limit){
  const max   = limit || 6;
  const szs   = cartSizes();
  const ages  = cartAgeKeys();
  const inCart = new Set(cart.map(function(i){ return String(i.id); }));

  /* المرشّحون: آخر قطعة فقط، وليست في السلة، ومتوفرة */
  const pool = allData.filter(function(it){
    if(inCart.has(String(it.Id))) return false;
    const s = parseSizes(it.sizes);
    return s.length === 1;
  });

  /* الأولى: مطابقة القياس تماماً */
  const exact = pool.filter(function(it){
    return szs.has(String(parseSizes(it.sizes)[0]));
  });

  /* الثانية (تكملة فقط): نفس الفئة العمرية */
  const near = pool.filter(function(it){
    if(exact.indexOf(it) > -1) return false;
    return agesOf(it).some(function(k){ return ages.has(k); });
  });

  const byPrice = function(a,b){
    return discPrice(parseFloat(a.price), itemPctRange(a).max) -
           discPrice(parseFloat(b.price), itemPctRange(b).max);
  };
  exact.sort(byPrice); near.sort(byPrice);

  return exact.concat(near).slice(0, max).map(function(it){
    return { item: it, exact: exact.indexOf(it) > -1 };
  });
}

/* بناء الشاشة وفتحها — تُرجع true إن ظهرت */
function showSuggest(){
  const list = suggestions(6);
  if(!list.length) return false;

  const box = document.getElementById('sgList');
  const ov  = document.getElementById('sgOv');
  if(!box || !ov) return false;

  const ttl = document.getElementById('sgTitle');
  const sub = document.getElementById('sgSub');
  const go  = document.getElementById('sgGo');
  if(ttl) ttl.textContent = t('sgTitle');
  if(sub) sub.textContent = t('sgSub');
  if(go)  go.textContent  = t('sgGo');

  box.innerHTML = '';
  list.forEach(function(x){
    const it   = x.item;
    const sz   = parseSizes(it.sizes)[0];
    const orig = parseFloat(it.price);
    const pct  = discPctFor(it, sz);
    const pr   = discPrice(orig, pct);
    const age  = L[lang]['s'+sz] || '';

    const c = document.createElement('div'); c.className = 'sg-card';
    c.innerHTML =
      '<div class="sg-img"><img loading="lazy" decoding="async" alt="'+sanitize(String(it.Id))+'">'+
        '<span class="sg-last">'+sanitize(t('lastSize'))+'</span></div>'+
      '<div class="sg-body">'+
        '<div class="sg-sz">'+sanitize(String(sz))+(age ? ' · '+sanitize(age) : '')+'</div>'+
        '<div class="sg-pr"><b>'+pr.toLocaleString()+'</b>'+
          '<s>'+orig.toLocaleString()+'</s></div>'+
      '</div>'+
      '<button class="sg-add">+ '+sanitize(t('addCart'))+'</button>';

    const im = c.querySelector('img');
    im.src = safeImgSrc(it.picture, true);
    im.dataset.full = safeImgSrc(it.picture);
    im.onerror = function(){
      if(this.dataset.full && this.src !== this.dataset.full){ this.src = this.dataset.full; return; }
      this.src = PLACEHOLDER;
    };

    c.querySelector('.sg-add').addEventListener('click', function(e){
      e.stopPropagation();
      addToCart(it.Id, sz, orig, pr, pct);
      c.classList.add('added');
      const btn = c.querySelector('.sg-add');
      btn.textContent = '✓ ' + t('cartAdded');
      btn.disabled = true;
      updateSuggestTotal();
    });
    box.appendChild(c);
  });

  updateSuggestTotal();
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  return true;
}

function updateSuggestTotal(){
  const el = document.getElementById('sgTot');
  if(!el) return;
  const sum = cartSum() + calcShip(cart);
  el.innerHTML = '<span>'+sanitize(t('tot'))+'</span><b>'+sum.toLocaleString()+' '+sanitize(t('dinar'))+'</b>';
}

function closeSuggest(){
  const ov = document.getElementById('sgOv');
  if(ov) ov.classList.remove('open');
  document.body.style.overflow = '';
}

/* ==================== HELPERS ==================== */
function parseSizes(s){ if(!s&&s!==0) return []; if(typeof s==='number') return [String(s)]; if(Array.isArray(s)) return s.map(x=>String(x).trim()).filter(Boolean); return String(s).split(/[-,،\s]+/).map(x=>x.trim()).filter(x=>x&&!isNaN(x)); }
function getSzLbl(sz){ const k='s'+sz; return L[lang][k] ? sz+' ('+L[lang][k]+')' : sz; }

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
/* جلب البيانات فقط — بلا رسم (لنرسم مرة واحدة بعد وصول الإعدادات) */
async function fetchProducts(){
  const r = await fetch(API,{mode:'cors'});
  if(!r.ok) throw new Error('HTTP '+r.status);
  allData = await r.json();
  localStorage.setItem('pc', JSON.stringify({d:allData, ts:Date.now()}));
  return allData;
}

/* الرسم الموحّد */
function renderAll(){
  const bar = document.getElementById('offlineBar');
  if(bar) bar.classList.remove('show');
  addJsonLD(allData); updateFilterCounts(); doFilter(false);
  /* نُثبّت بصمة البيانات هنا، وإلّا رأى التحديث التلقائي أول مرة
     أن «كل شيء تغيّر» فأعاد الرسم بلا سبب بعد 25 ثانية من الدخول */
  seedDataHash();
  cleanCart(false);
}

/* الرجوع للنسخة المخزّنة عند فشل الشبكة */
function useCachedProducts(){
  try{
    const c = localStorage.getItem('pc');
    if(!c){ showError(); return false; }
    const parsed = JSON.parse(c);
    allData = parsed.d || parsed;
    const age = parsed.ts ? Math.round((Date.now()-parsed.ts)/60000) : 0;
    const tx = document.getElementById('offlineTxt');
    if(tx) tx.textContent = t('offline') + (age>0 ? ' ('+age+' min)' : '');
    const bar = document.getElementById('offlineBar');
    if(bar) bar.classList.add('show');
    updateFilterCounts(); doFilter(false);
    seedDataHash();
    return true;
  }catch(_){ showError(); return false; }
}

/* ==================== الإقلاع ====================
   نجلب الإعدادات والمنتجات معاً (لا واحدة بعد الأخرى)
   ونرسم مرة واحدة — فلا وميض ولا ظهور واختفاء */
async function bootstrap(){
  showSkeleton();
  const res = await Promise.allSettled([ loadSettings(), fetchProducts() ]);
  applySettingsToUI();
  if(res[1].status === 'fulfilled'){ renderAll(); }
  else { useCachedProducts(); }
}

async function fetchData(){
  showSkeleton();
  try{
    const r=await fetch(API,{mode:'cors'}); if(!r.ok) throw new Error('HTTP '+r.status);
    allData=await r.json();
    localStorage.setItem('pc',JSON.stringify({d:allData,ts:Date.now()}));
    document.getElementById('offlineBar').classList.remove('show');
    addJsonLD(allData); updateFilterCounts(); doFilter(false); seedDataHash();
    cleanCart(false); // حذف ما نفد من السلة وتنبيه الزبون
  }catch(e){
    try{
      const c=localStorage.getItem('pc');
      if(c){ const parsed=JSON.parse(c); allData=parsed.d||parsed; const age=parsed.ts?Math.round((Date.now()-parsed.ts)/60000):0; document.getElementById('offlineTxt').textContent=t('offline')+(age>0?' ('+age+' min)':''); document.getElementById('offlineBar').classList.add('show'); updateFilterCounts(); doFilter(false); seedDataHash(); }
      else showError();
    }catch(_){ showError(); }
  }
}
function showSkeleton(){ const c=document.getElementById('prodCont'); const g=document.createElement('div'); g.className='skel-grid'; for(let i=0;i<6;i++){ const d=document.createElement('div'); d.className='skel-card'; d.innerHTML='<div class="skel skel-img"></div><div class="skel skel-ln w60"></div><div class="skel skel-ln w80"></div><div class="skel skel-ln w60"></div>'; g.appendChild(d); } c.innerHTML=''; c.appendChild(g); document.getElementById('rcount').textContent=''; }
function showError(){ const c=document.getElementById('prodCont'); c.innerHTML=''; const b=document.createElement('div'); b.className='errbox'; const ic=document.createElement('i'); ic.className='fas fa-wifi erricon'; const txt=document.createElement('div'); txt.textContent=t('errMsg'); const btn=document.createElement('button'); btn.className='retry'; btn.textContent=t('retry'); btn.addEventListener('click',fetchData); b.appendChild(ic); b.appendChild(txt); b.appendChild(btn); c.appendChild(b); document.getElementById('rcount').textContent=''; }

function addJsonLD(products){
  const old=document.getElementById('jld'); if(old) old.remove();
  const safe=products.filter(p=>parseSizes(p.sizes).length>0).slice(0,20);
  const schema={'@context':'https://schema.org','@type':'ItemList',name:'متجر جود العباس - ملابس أطفال',itemListElement:safe.map((item,i)=>({'@type':'ListItem',position:i+1,item:{'@type':'Product',name:'منتج # '+item.Id,image:item.picture||'',offers:{'@type':'Offer',price:discPrice(item.price, itemDiscPct(item)),priceCurrency:'IQD',availability:'https://schema.org/InStock'}}}))};
  const sc=document.createElement('script'); sc.id='jld'; sc.type='application/ld+json'; sc.textContent=JSON.stringify(schema); document.head.appendChild(sc);
}

function createCard(item){
  const sizes=parseSizes(item.sizes), isLast=sizes.length===1;
  const orig=parseFloat(item.price);
  const rng=itemPctRange(item);                   // أدنى/أعلى نسبة داخل الموديل
  const pct=rng.max;                              // نعرض الأفضل في الشارة
  const priceHi=discPrice(orig, rng.min);         // أعلى سعر (أقل خصم)
  const priceLo=discPrice(orig, rng.max);         // أقل سعر (أعلى خصم)
  const mixed=rng.min!==rng.max;                  // تختلف الأسعار داخل الموديل؟
  const disc=priceLo;
  const clear=isClearance(item);
  const imgSrc=safeImgSrc(item.picture, true);   /* مصغّرة للبطاقة */
  const imgFull=safeImgSrc(item.picture);        /* الأصل للتكبير */
  const card=document.createElement('div'); card.className='pcard';
  /* بصمة البطاقة — يستعملها التحديث التلقائي ليُحدّث ما تغيّر وحده */
  card.dataset.id  = String(item.Id);
  card.dataset.sig = String(item.sizes||'') + '|' + String(item.price||'');
  // Badges
  const badges=document.createElement('div'); badges.className='cbadges';
  const bdis=document.createElement('span');
  bdis.className='badge bdis'+(clear?' bclear':'');
  const _lg=(localStorage.getItem('lang')||'ar');
  const _pctTxt = mixed ? (rng.min+'-'+rng.max+'%') : (pct+'%');
  bdis.textContent = _lg==='en' ? (_pctTxt+' '+t('discPrefix')) : (t('discPrefix')+' '+_pctTxt);
  badges.appendChild(bdis);
  if(isLast){ const bl=document.createElement('span'); bl.className='badge blast'; bl.textContent=t('lastSize'); badges.appendChild(bl); }
  if(isCheapItem(item)){ const bs=document.createElement('span'); bs.className='badge bspecial'; bs.textContent='⭐ '+t('specialTag'); badges.appendChild(bs); }
  /* شارة الجنس — تساعد الأم على التمييز بنظرة */
  const _g = genderOf(item);
  if(_g==='girls' || _g==='boys'){
    const bg=document.createElement('span');
    bg.className='badge bgen '+(_g==='girls'?'bgen-g':'bgen-b');
    bg.textContent=(_g==='girls'?'👧 ':'👦 ')+t(_g==='girls'?'catGirls':'catBoys');
    badges.appendChild(bg);
  }
  // Wish
  // Image
  const iw=document.createElement('div'); iw.className='cimg-w'; iw.appendChild(badges);
  iw.appendChild(makeFavBtn(item.Id));
  const img=document.createElement('img'); img.className='cimg'; img.src=imgSrc; img.alt=String(item.Id); img.loading='lazy'; img.decoding='async'; img.fetchPriority='low'; img.dataset.full = imgFull;
  img.onerror = function(){
    /* المصغّرة غير موجودة؟ نعود للأصل، ثم للصورة البديلة */
    if(this.dataset.full && this.src !== this.dataset.full){ this.src = this.dataset.full; return; }
    this.src = PLACEHOLDER;
  }; iw.appendChild(img);   /* الضغط تتولاه البطاقة كلها */
  // Body
  const body=document.createElement('div'); body.className='cbody';
  // ID + copy
  const idEl=document.createElement('div'); idEl.className='cid'; idEl.title=t('copyId');
  const idSpan=document.createElement('span'); idSpan.textContent='# '+item.Id;
  const cpIco=document.createElement('i'); cpIco.className='far fa-copy cid-icon';
  idEl.appendChild(idSpan); idEl.appendChild(cpIco);
  idEl.addEventListener('click',function(e){ e.stopPropagation(); const txt=String(item.Id); if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(()=>notify(t('copyId')+': '+txt,'i')).catch(()=>{}); } else{ const ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');notify(t('copyId')+': '+txt,'i');}catch(_){} document.body.removeChild(ta); } });
  // Prices
  const pr=document.createElement('div'); pr.className='cprices';
  const op=document.createElement('span'); op.className='pold'; op.textContent=orig.toLocaleString()+' '+t('dinar');
  const np=document.createElement('span'); np.className='pnew';
  np.textContent = mixed
    ? (priceLo.toLocaleString()+' – '+priceHi.toLocaleString()+' '+t('dinar'))
    : (disc.toLocaleString()+' '+t('dinar'));
  pr.appendChild(op); pr.appendChild(np);
  // Savings
  /* القياسات المتوفرة بأرقامها — الأم تعرف قياس طفلها فتوفّر فتح البطاقة.
     البطاقة ضيّقة، فنعرض أول أربعة ونختصر الباقي بـ«+N». */
  const szc=document.createElement('div'); szc.className='cszc';
  /* ميزانية حروف بدل عدد ثابت: الأرقام الثلاثية (100+) أعرض من
     الثنائية، فلو ثبّتنا العدد انقصّ الصف على الشاشات الضيّقة. */
  const SZ_BUDGET = 20;   /* مُعايَرة تجريبياً: صفر قصّ من 320 إلى 430px */

  /* عند تفعيل فلتر العمر نُقدّم قياساته — فلا تُزاح خلف «+N» */
  let _match = [];
  if(fAgeSet.size){ fAgeSet.forEach(function(k){ _match = _match.concat(sizesInAge(k)); }); }
  const ordered = _match.length
      ? sizes.slice().sort(function(a,b){
          const ia = _match.indexOf(String(a)) > -1 ? 0 : 1;
          const ib = _match.indexOf(String(b)) > -1 ? 0 : 1;
          return ia - ib;   /* المطابق أولاً، والترتيب الأصلي محفوظ داخل كل مجموعة */
        })
      : sizes;

  let shown = [], used = 0;
  for(let k = 0; k < ordered.length; k++){
    const s = ordered[k];
    const add = String(s).length + (shown.length ? 3 : 0);   // 3 = ' · '
    /* نحجز مكان «+N» حين يبقى غيرُه، وإلا نزل لسطر ثانٍ وأطال البطاقة */
    const tail = (k < ordered.length - 1) ? 3 : 0;
    if(used + add + tail > SZ_BUDGET && shown.length) break;
    shown.push(s); used += add;
  }
  const rest = ordered.length - shown.length;

  /* الأرقام والزائد بـdir=ltr وإلا عُرض «+2» كـ«2+» في العربية */
  const html = shown.map(function(s){
    const on = _match.indexOf(String(s)) > -1;
    return on ? '<b class="szhit">' + sanitize(String(s)) + '</b>' : sanitize(String(s));
  }).join(' · ');
  szc.innerHTML = '<span class="szl" dir="ltr">' + html + '</span>' +
      (rest > 0 ? '<span class="szmore" dir="ltr">+' + rest + '</span>' : '');
  szc.title = t('sizes') + ': ' + sizes.join(' · ');
  body.appendChild(pr); body.appendChild(szc); body.appendChild(idEl);
  /* البطاقة كلها تفتح صفحة المنتج — لا الصورة وحدها.
     القلب ونسخ الكود يوقفان الانتشار بأنفسهما. */
  card.classList.add('tappable');
  card.setAttribute('role','button');
  card.setAttribute('tabindex','0');
  card.addEventListener('click', function(){ openProduct(item.Id); });
  card.addEventListener('keydown', function(e){
    if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openProduct(item.Id); }
  });

  card.appendChild(iw); card.appendChild(body);
  return card;
}
function displayProducts(arr){
  const cont=document.getElementById('prodCont');
  const filtered=arr.filter(i=>parseSizes(i.sizes).length>0);
  /* العداد يظهر فقط عند وجود فلتر أو بحث — وإلا فهو ضجيج */
  const _rc = document.getElementById('rcount');
  if(_rc){
    const _q = (document.getElementById('searchIn')||{}).value || '';
    const _active = !!(_q.trim() || fSea || fTyp || fGenSet.size || fAgeSet.size || fFav);
    _rc.textContent = filtered.length + ' ' + t('res');
    _rc.classList.toggle('show', _active);
  }
  cont.innerHTML='';
  if(!filtered.length){ const n=document.createElement('div'); n.className='nores'; n.innerHTML='<i class="fas fa-search"></i>'; n.appendChild(document.createTextNode(t('noRes'))); cont.appendChild(n); return; }
  const grid=document.createElement('div'); grid.className='pgrid';
  filtered.forEach(item=>grid.appendChild(createCard(item)));
  cont.appendChild(grid);
}

/* ==================== SHARE ==================== */
function shareProduct(id,price){ const txt='🛍️ '+t('hTitle')+'\n📌 ID: '+id+'\n💰 '+t('subDisc')+': '+price.toLocaleString()+' '+t('dinar')+'\n🔗 '+window.location.href; if(navigator.share) navigator.share({title:t('hTitle'),text:txt,url:window.location.href}).catch(()=>{}); else window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank'); }
function shareCart(){ if(!cart.length){notify(t('cartEmpty'),'w');return;} let msg='🛍️ '+t('hTitle')+'\n\n'; let totD=0; const _s=cheapStatus(); cart.forEach(ci=>{ const e=itemPrice(ci,_s); msg+='• #'+sanitize(String(ci.id))+' (Q:'+sanitize(String(ci.size))+') — '+e.toLocaleString()+' '+t('dinar')+'\n'; totD+=e; }); msg+='\n'+t('tot')+': '+(totD+calcShip(cart)).toLocaleString()+' '+t('dinar'); if(navigator.share) navigator.share({title:t('hTitle'),text:msg}).catch(()=>{}); else window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank'); }
function shareCart(){ /* removed */ }
// Translation for copy button
const _ckCopyLblEl=document.getElementById('ckCopyLbl');
if(_ckCopyLblEl) _ckCopyLblEl.textContent=t('copyBtn');

/* ==================== WISHLIST ==================== */

/* ==================== CART ==================== */
function loadCart(){ cart=JSON.parse(localStorage.getItem('ct')||'[]'); updateCartBadge(); }
function saveCart(){ localStorage.setItem('ct',JSON.stringify(cart)); }
function updateCartBadge(){
  try{ updateShipBar(); }catch(_){} const dot=document.getElementById('cdot'); dot.textContent=cart.length; dot.classList.toggle('show',cart.length>0); }
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

function addToCart(id,size,orig,disc,pct){
  if(cart.find(i=>i.id===id&&i.size===size)){notify(t('already'),'w');return;}
  cart.push({id,size,orig,disc,pct:Number(pct)||(Number(SETTINGS.discountRules.base)||40)}); saveCart(); updateCartBadge(); bounceCart();
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
  const _cst = cheapStatus();
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
    const img=document.createElement('img'); img.className='ci-img'; img.loading='lazy'; img.decoding='async'; img.src=safeImgSrc(prod&&prod.picture?prod.picture:'', true); img.alt='';
    const info=document.createElement('div'); info.className='ci-info';
    const ciId=document.createElement('div'); ciId.className='ci-id'; ciId.textContent='# '+item.id;
    const ciSz=document.createElement('div'); ciSz.className='ci-sz'; ciSz.textContent='Q: '+item.size;
    const ciOld=document.createElement('div'); ciOld.className='ci-old'; ciOld.textContent=Number(item.orig).toLocaleString()+' '+t('dinar');
    const _eff=itemPrice(item,_cst);
    const ciNew=document.createElement('div'); ciNew.className='ci-new';
    ciNew.textContent=_eff.toLocaleString()+' '+t('dinar');
    if(_cst.enabled && isCheapPrice(item.orig)){
      const st=document.createElement('span');
      st.className='ci-star'+(_cst.ok?' ok':'');
      st.textContent = _cst.ok ? '⭐ '+t('specialOn') : '⚠️ '+t('specialOff');
      ciNew.appendChild(document.createElement('br'));
      ciNew.appendChild(st);
    }
    info.appendChild(ciId); info.appendChild(ciSz); info.appendChild(ciOld); info.appendChild(ciNew);
    const del=document.createElement('button'); del.className='ci-del'; del.innerHTML='<i class="fas fa-trash"></i>';
    del.addEventListener('click',()=>delCartItem(item.id,item.size));
    div.appendChild(img); div.appendChild(info); div.appendChild(del);
    addSwipe(div,()=>{ cart=cart.filter(i=>!(i.id===item.id&&i.size===item.size)); saveCart(); updateCartBadge(); renderCart(); });
    body.appendChild(div); totO+=Number(item.orig); totD+=_eff;
  });
  const ship=calcShip(cart), total=totD+ship;
  const r1=document.createElement('div'); r1.textContent=t('sub')+': '+totO.toLocaleString()+' '+t('dinar');
  const r2=document.createElement('div'); r2.textContent=t('subDisc')+': '+totD.toLocaleString()+' '+t('dinar');
  const r3=document.createElement('div');
  if(ship===0){ r3.className='ctot-free'; r3.textContent=t('ship')+': '+t('freeShip')+' 🎉'; }
  else { r3.textContent=t('ship')+': '+ship.toLocaleString()+' '+t('dinar'); }
  const r4=document.createElement('div'); r4.className='ctot-final'; r4.textContent=t('tot')+': '+total.toLocaleString()+' '+t('dinar');
  const rows=[r1,r2,r3,r4];
  /* ===== صندوق القطع المميزة ===== */
  if(_cst.enabled && _cst.cheap>0){
    const box=document.createElement('div');
    box.className='cheap-box'+(_cst.ok?' ok':'');
    if(_cst.ok){
      box.innerHTML='<b>⭐ '+t('specialWon')+'</b><br><span>'+
        t('specialWonSub').replace('{n}',_cst.cheap)+'</span>';
    }else{
      box.innerHTML='<b>🎁 '+t('specialAlmost').replace('{n}',_cst.missing)+'</b><br><span>'+
        t('specialSave').replace('{amt}', Math.round(_cst.saving).toLocaleString())+'</span>';
    }
    rows.splice(2,0,box);
  }

  /* تلميح: كم قطعة باقية للتوصيل المجاني */
  if(ship>0){
    const need=freeShipQty()-cart.length;
    const hint=document.createElement('div'); hint.className='ctot-hint';
    hint.textContent='🚚 '+t('freeShipHint').replace('{n}', need);
    rows.splice(3,0,hint);
  }
  totEl.innerHTML=''; rows.forEach(r=>totEl.appendChild(r));
}
function delCartItem(id,size){ showDlg('🗑️',t('delQ'),[{lbl:t('yes'),cls:'dlg-yes',fn:()=>{cart=cart.filter(i=>!(i.id===id&&i.size===size));saveCart();updateCartBadge();renderCart();}},{lbl:t('no'),cls:'dlg-no'}]); }
document.getElementById('clearCartBtn').addEventListener('click',()=>showDlg('🗑️',t('clrQ'),[{lbl:t('yes'),cls:'dlg-yes',fn:()=>{cart=[];saveCart();updateCartBadge();renderCart();}},{lbl:t('no'),cls:'dlg-no'}]));

/* ==================== SIZE DIALOG ==================== */
let _cid,_csz,_cor,_cdc,_cpct;
function showSizeDlg(id,szRaw,orig,disc,pct){ _cid=id;_csz=parseSizes(szRaw);_cor=orig;_cdc=disc;_cpct=Number(pct)||(Number(SETTINGS.discountRules.base)||40); document.getElementById('szTitle').textContent=t('szTitle'); document.getElementById('szCancel').textContent=t('cancel'); const g=document.getElementById('szGrid'); g.innerHTML=''; const _it=allData.find(p=>String(p.Id)===String(_cid));
  _csz.forEach(sz=>{
    const b=document.createElement('button'); b.className='sz-btn';
    const p2 = _it ? discPctFor(_it,sz) : _cpct;
    const pr2 = discPrice(_cor, p2);
    b.innerHTML='<span class="szp-lbl">'+sanitize(getSzLbl(sz))+'</span><span class="szp-price">'+pr2.toLocaleString()+'</span>';
    b.addEventListener('click',()=>{addToCart(_cid,sz,_cor,pr2,p2);closeSzDlg();});
    g.appendChild(b);
  }); document.getElementById('szOv').classList.add('open'); document.body.style.overflow='hidden'; }
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



/* ==================== شريط تنبيه المتصفح المدمج ==================== */
function initInAppBanner(){
  if(!isInAppBrowser()) return;
  const banner = document.getElementById('inAppBanner');
  if(!banner) return;

  // نتجاهل لو أغلقه المستخدم في هذه الجلسة
  if(sessionStorage.getItem('inapp_dismissed') === '1') return;

  const name = getInAppName();
  const txtEl = document.getElementById('inAppText');
  if(txtEl) txtEl.textContent = '💡 أنت تتصفّح عبر ' + name + ' — للطلب الآمن افتح الموقع في متصفح خارجي';

  banner.style.display = 'block';
  // ندفع محتوى الصفحة للأسفل
  document.body.style.paddingTop = banner.offsetHeight + 'px';

  // زر الفتح في المتصفح
  const openBtn = document.getElementById('inAppOpenBtn');
  if(openBtn) openBtn.addEventListener('click', openInExternalBrowser);

  // زر الإغلاق
  const closeBtn = document.getElementById('inAppCloseBtn');
  if(closeBtn) closeBtn.addEventListener('click', function(){
    banner.style.display = 'none';
    document.body.style.paddingTop = '';
    sessionStorage.setItem('inapp_dismissed', '1');
  });
}

/* فتح الموقع في المتصفح الخارجي */
function openInExternalBrowser(){
  const url = window.location.href;
  const ua = navigator.userAgent || '';

  // أندرويد: intent يفتح Chrome مباشرة
  if(/Android/i.test(ua)){
    const intent = 'intent://' + url.replace(/^https?:\/\//,'') +
                   '#Intent;scheme=https;package=com.android.chrome;end';
    window.location.href = intent;
    // احتياط: لو فشل الـintent
    setTimeout(function(){
      copyLinkFallback(url);
    }, 1500);
    return;
  }

  // iOS: لا يمكن فتح Safari برمجياً — ننسخ الرابط ونرشد المستخدم
  if(/iPhone|iPad|iPod/i.test(ua)){
    copyLinkFallback(url, true);
    return;
  }

  // غير ذلك: محاولة فتح نافذة
  window.open(url, '_blank');
}

/* نسخ الرابط مع إرشاد */
function copyLinkFallback(url, isIOS){
  const doCopy = function(){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(url);
    }
    const ta=document.createElement('textarea'); ta.value=url;
    ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(_){}
    document.body.removeChild(ta);
    return Promise.resolve();
  };
  doCopy().then(function(){
    const msg = isIOS
      ? '✅ نُسخ الرابط! افتح Safari والصقه في شريط العنوان'
      : '✅ نُسخ الرابط! افتحه في متصفحك (Chrome)';
    if(typeof notify==='function') notify(msg, 'i');
    else alert(msg);
  }).catch(function(){
    if(typeof notify==='function') notify('انسخ الرابط من الأعلى وافتحه في متصفحك', 'w');
  });
}


/* ==================== كشف المتصفح المدمج (WebView) ====================
   متصفحات فيسبوك/إنستقرام المدمجة تكسر fetch/POST أحياناً */
function isInAppBrowser(){
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Instagram|FBIOS|Line|Messenger|Snapchat|TikTok/i.test(ua);
}
function getInAppName(){
  const ua = navigator.userAgent || '';
  if(/Instagram/i.test(ua)) return 'إنستقرام';
  if(/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)) return 'فيسبوك';
  if(/TikTok/i.test(ua)) return 'تيك توك';
  return 'التطبيق';
}

/* إرسال عبر GET (صورة/JSONP-like) — أضمن طريقة في WebView المقيّد
   يبني URL مع كل بيانات الطلب ويحمّله كصورة، فيصل GAS حتى لو فشل fetch */
function saveOrderViaGET(orderData, timeoutMs){
  return new Promise(function(resolve){
    try{
      // نبني query string من بيانات الطلب
      const params = new URLSearchParams();
      params.set('action', 'saveOrder');
      for(const k in orderData){
        if(orderData[k] !== undefined && orderData[k] !== null){
          params.set(k, String(orderData[k]));
        }
      }
      const url = API + '?' + params.toString();

      // نحاول fetch أولاً (GET، بلا قراءة رد معقّدة)
      let settled = false;
      const done = function(result){ if(!settled){ settled = true; resolve(result); } };

      // المهلة
      const timer = setTimeout(function(){
        done({ success: true, confirmed: false, uncertain: true, via: 'get-timeout' });
      }, timeoutMs || 15000);

      fetch(url, { method: 'GET', cache: 'no-store' })
        .then(function(r){ return r.json(); })
        .then(function(result){
          clearTimeout(timer);
          if(result && result.success){
            result.confirmed = true;
            result.via = 'get';
          }
          done(result || { success: false });
        })
        .catch(function(){
          // فشل قراءة الرد — نجرّب صورة كملاذ أخير (يصل الطلب بلا قراءة رد)
          clearTimeout(timer);
          const img = new Image();
          img.onload = img.onerror = function(){
            // وصل الطلب لكن لا نستطيع قراءة الرد بيقين
            done({ success: true, confirmed: false, uncertain: true, via: 'image' });
          };
          img.src = url + '&_img=1';
          // مهلة احتياطية للصورة
          setTimeout(function(){ done({ success: true, confirmed: false, uncertain: true, via: 'image-timeout' }); }, 8000);
        });
    }catch(err){
      resolve({ success: false, error: err.message });
    }
  });
}

async function saveOrderToGAS(orderData) {
  // منع إرسال نفس الطلب أكثر من مرة
  if (orderData.orderId && _sentOrderIds.has(orderData.orderId)) {
    console.log('⏭️ Order already sent:', orderData.orderId);
    return { success: true, cached: true };
  }
  if (orderData.orderId) _sentOrderIds.add(orderData.orderId);

  /* في متصفح فيسبوك/إنستقرام المدمج: نستخدم GET مباشرة (أضمن)
     في المتصفح العادي: نجرّب POST أولاً، وGET احتياطاً */
  if (isInAppBrowser()) {
    console.log('📱 In-app browser detected — using GET method');
    return await saveOrderViaGET(orderData, 15000);
  }

  try {
    const response = await fetch(API, {
      method: 'POST',
      body:   JSON.stringify(orderData)
    });
    const result = await response.json();
    if (result.success) {
      console.log('✅ Order saved (POST):', orderData.orderId, result.duplicate ? '(duplicate)' : '');
      result.confirmed = true;
      return result;
    } else {
      console.warn('⚠️ GAS returned:', result);
      return result;
    }
  } catch (e) {
    console.warn('❌ POST failed, trying GET fallback:', e.message);
    // POST فشل (قد يكون WebView غير مكتشف) — نجرّب GET كملاذ
    try {
      return await saveOrderViaGET(orderData, 12000);
    } catch (e2) {
      return { success: true, uncertain: true, confirmed: false };
    }
  }
}

/* ==================== CHECKOUT ==================== */
document.getElementById('checkoutBtn').addEventListener('click',async()=>{
  if(!cart.length){notify(t('cartEmpty'),'w');return;}
  closeSheets();
  /* اقتراحات آخر القطع — تُتخطّى تلقائياً إن لم توجد مطابقات */
  if(showSuggest()) return;
  openCheckoutForm();
});

/* زر «متابعة الطلب» في شاشة الاقتراحات */
document.getElementById('sgGo').addEventListener('click', function(){
  closeSuggest();
  openCheckoutForm();
});
document.getElementById('sgClose').addEventListener('click', function(){
  closeSuggest();
  openCheckoutForm();
});
document.getElementById('sgOv').addEventListener('click', function(e){
  if(e.target === e.currentTarget){ closeSuggest(); openCheckoutForm(); }
});

function openCheckoutForm(){
  ['ckTitle','ckConfirmLbl','ckNote','ckCancel'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.textContent=t({ckTitle:'ckTitle',ckConfirmLbl:'confirmOrder',ckNote:'orderNoteNew',ckCancel:'back'}[id]);
  });
  document.getElementById('ckOv').classList.add('open'); document.body.style.overflow='hidden';
  setTimeout(()=>document.getElementById('ckName').focus(),300);
  try{
    // نستخدم meta.js (يضيف contents وplatform ويمنع القيم الصفرية)
    if(typeof metaInitiateCheckout==='function' && cart.length>0){
      const cv=cartSum();
      metaInitiateCheckout(cart, cv+calcShip(cart));
    }
  }catch(_){}
}
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
  navRestore();
}

async function trackOrder(){
  const inp = document.getElementById('trackIn');
  const box = document.getElementById('trackResult');
  if(!inp || !box) return;
  let oid = inp.value.trim();
  if(!oid){ notify(t('enterOrderId'),'w'); return; }

  /* الزبون قد يكتب رقم هاتفه بدل رقم الطلب الطويل */
  const digits = oid.replace(/[٠-٩]/g, n=>'٠١٢٣٤٥٦٧٨٩'.indexOf(n)).replace(/[^\d]/g,'');
  const isPhone = /^(07\d{9}|7\d{9}|9647\d{9})$/.test(digits);
  const qs = isPhone
      ? 'action=trackOrder&phone=' + encodeURIComponent(digits)
      : 'action=trackOrder&orderId=' + encodeURIComponent(oid);

  box.innerHTML = '<div class="tr-loading">🔄 '+t('loading')+'</div>';
  try{
    const r = await fetch(API+'?'+qs, {cache:'no-store'});
    const d = await r.json();
    if(!d.success){
      /* البحث بالهاتف يحتاج دعماً في السكربت؛ فإن لم يُدعَم نوجّه
         الزبون لرقم الطلب بدل أن يظن الموقع معطّلاً */
      box.innerHTML = '<div class="tr-notfound">❌ ' +
        sanitize(isPhone ? t('trackPhoneHint') : t('orderNotFound')) + '</div>';
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
  /* نحفظه ليملأ خانة التتبّع تلقائياً في الزيارة القادمة */
  try{ if(orderId) localStorage.setItem('lastOrder', String(orderId)); }catch(_){}
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


/* ==================== التحقق من رقم الهاتف ====================
   الرقم العراقي الصحيح: يبدأ بـ 07 وطوله 11 رقماً
   يقبل صيغاً شائعة ويحوّلها: +9647xx / 009647xx / 7xx */
function normalizeIraqiPhone(raw){
  let d = String(raw||'')
    .replace(/[٠-٩]/g, x=>'٠١٢٣٤٥٦٧٨٩'.indexOf(x))  // أرقام عربية
    .replace(/[^\d+]/g, '');                          // إزالة الرموز
  if(d.startsWith('+964'))  d = '0' + d.slice(4);
  else if(d.startsWith('00964')) d = '0' + d.slice(5);
  else if(d.startsWith('964'))   d = '0' + d.slice(3);
  else if(d.startsWith('7') && d.length===10) d = '0' + d;
  return d;
}
/* صحيح؟ يبدأ بـ 07 + 11 رقماً بالضبط */
function isValidIraqiPhone(p){
  return /^07\d{9}$/.test(String(p||''));
}

async function submitOrder(){
  /* توليد Order ID فريد لهذا الطلب */
  const orderId = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
  const name=document.getElementById('ckName').value.trim().slice(0,80);
  const phone=normalizeIraqiPhone(document.getElementById('ckPhone').value);
  const _gov2=(document.getElementById('ckGov')||{}).value||'';
  const addr=((_gov2? _gov2+' - ':'')+document.getElementById('ckAddr').value.trim()).slice(0,300);
  const notesEl=document.getElementById('ckNotes');
  const notes=notesEl ? notesEl.value.trim().slice(0,200) : '';
  if(!name){notify(t('namePh')+' '+t('no'),'w');return;}
  /* الهاتف: يجب أن يبدأ بـ07 ويكون 11 رقماً */
  if(!isValidIraqiPhone(phone)){
    notify(t('phoneInvalid'),'w');
    const pe=document.getElementById('ckPhone');
    if(pe){ pe.value=phone; pe.classList.add('ck-err'); pe.focus();
            setTimeout(()=>pe.classList.remove('ck-err'),2500); }
    return;
  }
  if(!addr){notify(t('addrPh')+' '+t('no'),'w');return;}
  const now=Date.now(), last=parseInt(sessionStorage.getItem('ls')||'0');
  if(now-last<10000){notify('⏳','w');return;}

  /* ===== نُعطّل الزر ونُظهر واجهة الانتظار فوراً =====
     قبل أي عملية شبكة — استجابة لحظية عند الضغط */
  const confirmBtn = document.getElementById('ckConfirm');
  if (confirmBtn) {
    if (confirmBtn.dataset.busy === '1') return; // قيد المعالجة — تجاهل
    confirmBtn.dataset.busy = '1';
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
  }
  showSavingOverlay();

  /* دالة إعادة تفعيل الزر (نحتاجها في كل حالات الخروج المبكر) */
  function reEnableBtn() {
    if (confirmBtn) {
      confirmBtn.dataset.busy = '0';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
    }
  }

  /* ===== خط الدفاع الأخير: تحقق من توفر كل منتج قبل التسجيل =====
     نُحدّث البيانات أولاً ثم نتحقق — يمنع تسجيل منتج نفد للتو */
  try {
    const fresh = await fetch(API, {cache:'no-store'});
    if (fresh.ok) {
      const freshData = await fresh.json();
      if (Array.isArray(freshData) && freshData.length > 0) {
        allData = freshData;
        localStorage.setItem('pc', JSON.stringify({d:allData, ts:Date.now()}));
        updateFilterCounts(); doFilter(false); seedDataHash();
      }
    }
  } catch(_) { /* فشل التحديث — نكمل بالبيانات الحالية */ }

  const unavailable = cart.filter(i=>!isItemAvailable(i));
  if (unavailable.length > 0) {
    const ids = unavailable.map(i=>'#'+i.id+' (Q:'+i.size+')').join('، ');
    cleanCart(true); // نحذفها بصمت (سنُظهر رسالة مخصّصة)
    renderCart();
    hideSavingOverlay(); reEnableBtn();
    showDlg('⚠️', t('itemsSoldOut')+'\n\n'+ids, [
      { lbl: t('orderSuccessOk'), cls: 'dlg-yes', fn: ()=>closeDlg() }
    ]);
    return; // نوقف التسجيل
  }

  if (cart.length === 0) { hideSavingOverlay(); reEnableBtn(); notify(t('cartEmpty'),'w'); return; }

  sessionStorage.setItem('ls',String(now));
  let totO=0,totD=0;
  let msg='مرحباً، أرغب بشراء المنتجات التالية:\n';
  const _st=cheapStatus();
  cart.forEach(i=>{
    const eff=itemPrice(i,_st);
    const p=Math.round((1-eff/Number(i.orig))*100);
    const tag=(_st.enabled&&isCheapPrice(i.orig)) ? (_st.ok?' ⭐':' (سعر غير مخفّض)') : '';
    msg+='- ID: '+sanitize(String(i.id))+'، القياس: '+sanitize(String(i.size))+'، السعر الأصلي: '+Number(i.orig).toLocaleString()+' دينار، بعد الخصم '+p+'%: '+eff.toLocaleString()+' دينار'+tag+'\n';
    totO+=Number(i.orig); totD+=eff;
  });
  const ship=calcShip(cart), total=totD+ship;
  msg+='\nالمجموع الأصلي: '+totO.toLocaleString()+' دينار\n';
  msg+='المجموع بعد الخصم: '+totD.toLocaleString()+' دينار\n';
  msg+='تكلفة النقل: '+(ship===0 ? 'مجاني 🎉' : ship.toLocaleString()+' دينار')+'\n';
  msg+='المجموع النهائي: '+total.toLocaleString()+' دينار\n\n';
  msg+='معلومات الزبون:\nالاسم: '+name+'\nالهاتف: '+phone+'\nالعنوان: '+addr;
  if(notes) msg+='\nملاحظات: '+notes;

  /* ===== تسجيل الطلب وانتظار تأكيد GAS =====
     (الزر مُعطّل والواجهة ظاهرة منذ بداية الدالة) ===== */
  const savePromise = saveOrderToGAS({
    action:  'saveOrder',
    orderId: orderId,
    name:    name,
    phone:   phone,
    address: addr,
    notes:   notes,
    message: msg,
    total:   total,
    channel: 'website',
    items:   JSON.stringify(cart.map(function(i){ return {id:String(i.id), size:String(i.size)}; }))
  });

  const timeoutPromise = new Promise(function(resolve){
    setTimeout(function(){ resolve({ success: true, timeout: true, confirmed: false }); }, 15000);
  });

  const saveResult = await Promise.race([savePromise, timeoutPromise]);

  /* ===== الخطوة 3: إخفاء الشاشة ===== */
  hideSavingOverlay();

  /* ===== الخطوة 4: أحداث Meta — فقط عند تأكيد GAS الحقيقي =====
     شرط صارم: confirmed === true (رد صريح من الخادم)
     نتجنّب الإرسال عند:
       - timeout (تجاوز 8 ثوانٍ بلا رد)
       - uncertain (فشل fetch — قد لا يكون وصل)
       - duplicate (طلب مكرّر — أُرسلت Meta مسبقاً)
     هذا يمنع تسجيل طلبات في Meta لم تصل فعلاً */
  try {
    if (saveResult && saveResult.confirmed === true && !saveResult.duplicate) {
      // Purchase فقط — حدث واحد لكل طلب مؤكّد (هو حدث المبيعات الذي يعمل عليه النظام)
      if (typeof metaPurchase === 'function') metaPurchase(cart, total, orderId, phone, name);
      console.log('📊 Meta Purchase sent for confirmed order:', orderId);
    } else {
      console.log('⏭️ Meta skipped — order not confirmed:', {
        timeout: saveResult && saveResult.timeout,
        uncertain: saveResult && saveResult.uncertain,
        duplicate: saveResult && saveResult.duplicate
      });
    }
  } catch(_) {}

  /* ===== الخطوة 5: النتيجة ===== */
  if (saveResult && saveResult.confirmed === true) {
    // ✅ تأكيد حقيقي من GAS — نجاح مؤكّد
    cart = []; saveCart(); updateCartBadge();
    closeCheckout();
    reEnableBtn();
    showOrderSuccess(orderId);
  } else if (saveResult && saveResult.success) {
    // ⏳ غير مؤكّد (timeout / فشل قراءة الرد)
    // الطلب *قد* يكون وصل. نُظهر رسالة صادقة ونُبقي السلة احتياطاً
    // حتى لا يخسر الزبون طلبه لو لم يصل فعلاً.
    reEnableBtn();
    closeCheckout();
    showDlg('⏳', t('orderPending'), [
      { lbl: t('orderPendingCheck'), cls: 'dlg-yes', fn: ()=>{ closeDlg(); openTrack(); if(document.getElementById('trackIn')) document.getElementById('trackIn').value=orderId; trackOrder(); } },
      { lbl: t('orderSuccessOk'), cls: 'dlg-no', fn: ()=>{ cart=[]; saveCart(); updateCartBadge(); closeDlg(); } }
    ]);
  } else {
    // ❌ فشل صريح — نُبقي السلة ونعرض إعادة المحاولة
    reEnableBtn();
    showDlg('⚠️', t('orderFail'), [
      { lbl: t('tryAgain'), cls: 'dlg-yes', fn: ()=>closeDlg() }
    ]);
  }
}
document.getElementById('ckConfirm').addEventListener('click',()=>submitOrder());

/* ==================== PWA ==================== */
function setupPWA(){
  /* الـmanifest صار ملفاً ثابتاً (/manifest.json) — blob لا يعمل على أندرويد */
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
  navRestore();
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
  const steps=tutSteps;
  function buildDots(){ dotsEl.innerHTML=''; steps().forEach((_,i)=>{const d=document.createElement('div');d.className='tut-dot'+(i===step?' on':'');dotsEl.appendChild(d);}); }
  /* نُعيد الاستعلام عن الزر: النسخة الأصلية تُستبدل بنسخة منها أدناه
     لإزالة المستمعين، فالكتابة على المتغيّر القديم لا تظهر للزبون */
  function show(s){ step=s; document.getElementById('tutTxt').innerHTML=steps()[s]; document.getElementById('tutStep').textContent=(s+1)+' / '+steps().length; const nb=document.getElementById('tutNext'); if(nb) nb.textContent=s<steps().length-1?t('tutNext'):t('fpClose'); buildDots(); }
  // Reset listeners by cloning
  const newNext=next.cloneNode(true); next.parentNode.replaceChild(newNext,next);
  const newSkip=skip.cloneNode(true); skip.parentNode.replaceChild(newSkip,skip);
  function closeTut(){ panel.classList.remove('open'); localStorage.setItem('tut','1'); document.body.style.overflow=''; }
  document.getElementById('tutNext').addEventListener('click',()=>{ if(step<steps().length-1) show(step+1); else closeTut(); });
  document.getElementById('tutSkip').addEventListener('click',closeTut);
  show(0); panel.classList.add('open'); document.body.style.overflow='hidden';
}
function initTutorial(){ if(!localStorage.getItem('tut')) showTutorial(); }

/* ==================== التحديث التلقائي ====================
   كل 25 ثانية: يجلب البيانات، وإن تغيّرت يُحدّث البطاقات.

   مهم: لا يُعاد رسم الشبكة كلها. إعادة الرسم كانت تمسح البطاقات
   وتبنيها من جديد، فيقفز الزبون إلى أعلى الصفحة وهو يتصفّح.
   بدلاً منها نُرقّع ما تغيّر وحده: نحذف ما نفد، ونُحدّث ما تغيّر
   سعره أو قياساته في مكانه، ونُلحق الجديد في آخر الشبكة — فلا
   يتزحزح شيء فوق موضع الزبون، ولا يتغيّر موضع التمرير أصلاً.
   أمّا الترتيب فيُعاد عند أي فلترة أو بحث أو فتح جديد للموقع،
   لا أثناء التصفّح، لئلّا تتنقّل البطاقات تحت إصبع الزبون. */

function dataHash(arr){
  return arr.map(function(x){
    return String(x.Id)+'|'+String(x.sizes||'')+'|'+String(x.price||'');
  }).join(';');
}

let _lastDataHash = '';

/* تُستدعى بعد كل رسم كامل: تجعل التحديث التالي يقارن ببيانات
   مرسومة فعلاً، فلا يعيد الرسم إلا عند تغيّر حقيقي */
function seedDataHash(){
  try{ _lastDataHash = dataHash(allData); }catch(_){}
}

/* يُحدّث الشبكة في مكانها. يُرجع false إن تعذّر، فيُعاد الرسم كاملاً. */
function patchGrid(){
  const grid = document.querySelector('#prodCont .pgrid');
  if(!grid) return false;              /* لا شبكة: هيكل تحميل أو خطأ أو «لا نتائج» */

  const want = filteredSorted().filter(function(i){ return parseSizes(i.sizes).length > 0; });
  if(!want.length) return false;       /* صار بلا نتائج: دع الرسم الكامل يُظهر الرسالة */

  const byId = new Map();
  want.forEach(function(p){ byId.set(String(p.Id), p); });

  /* ① ما نفد: لا نحذفه الآن. حذف بطاقة يزحف بكل ما بعدها صفاً كاملاً
     تحت إصبع الزبون. نُعلّمها «نفد» في مكانها فلا يتحرّك شيء، وتختفي
     فعلياً عند أول فلترة أو بحث أو فتح جديد للموقع. */
  const seen = new Set();
  Array.from(grid.children).forEach(function(card){
    const id = card.dataset.id;
    if(!id) return;
    const p = byId.get(id);
    if(!p){
      /* نفد فعلاً (اختفى أو خلا من القياسات)؟ نُعلّمه. أمّا لو خرج من
         الفلتر الحالي وهو متوفر فنتركه كما هو — يصحّحه أول رسم كامل. */
      const still = allData.find(function(x){ return String(x.Id)===id; });
      if(!still || parseSizes(still.sizes).length===0) markSoldOut(card);
      return;
    }
    seen.add(id);
    if(card.classList.contains('soldout')) card.replaceWith(createCard(p));  /* عاد للتوفّر */
    /* ② تحديث ما تغيّر سعره أو قياساته — في موضعه نفسه */
    else {
      const sig = String(p.sizes||'') + '|' + String(p.price||'');
      if(card.dataset.sig !== sig) card.replaceWith(createCard(p));
    }
  });

  /* ③ إلحاق الجديد في الآخر — لا يزحزح ما فوقه */
  const add = want.filter(function(p){ return !seen.has(String(p.Id)); });
  if(add.length){
    const frag = document.createDocumentFragment();
    add.forEach(function(p){ frag.appendChild(createCard(p)); });
    grid.appendChild(frag);
  }

  /* ④ عدّاد النتائج — لا يَعُدّ ما نفد */
  const rc = document.getElementById('rcount');
  if(rc) rc.textContent = grid.querySelectorAll('.pcard:not(.soldout)').length + ' ' + t('res');
  return true;
}

/* تُعلَّم البطاقة «نفد» في مكانها: لا تُفتح ولا تُشترى، ولا تزحزح جارتها */
function markSoldOut(card){
  if(card.classList.contains('soldout')) return;
  card.classList.add('soldout');
  card.removeAttribute('role');
  card.removeAttribute('tabindex');
  card.classList.remove('tappable');
  const tag = document.createElement('span');
  tag.className = 'so-tag';
  tag.textContent = t('soldOut');
  card.appendChild(tag);
}

setInterval(async()=>{
  try{
    const r = await fetch(API, {cache:'no-store'});
    if(!r.ok) return;
    const newData = await r.json();
    if(!Array.isArray(newData) || newData.length===0) return;

    /* بصمة البيانات: المعرّف + القياسات + السعر — تكشف أي تغيير */
    const hash = dataHash(newData);

    document.getElementById('offlineBar').classList.remove('show');
    localStorage.setItem('pc', JSON.stringify({d:newData, ts:Date.now()}));

    if(hash === _lastDataHash){ allData = newData; return; }  // لا تغيير
    _lastDataHash = hash;

    allData = newData;
    addJsonLD(newData);
    updateFilterCounts();

    /* لا نلمس الشبكة ما دامت نافذة مفتوحة فوقها (منتج أو سلة أو طلب):
       الترقيع تحتها يربك الزبون. البيانات حُدّثت، والشكل ينتظر. */
    const busy = !!document.querySelector('.sheet.open, .dlg-ov.open')
              || document.body.style.overflow === 'hidden';

    /* ترقيع في المكان — بلا مسح الشبكة وبلا قفزة تمرير.
       نعيد الرسم كاملاً فقط إن تعذّر الترقيع (كأن تختفي كل النتائج). */
    if(!busy && !patchGrid()){
      const y = window.scrollY;
      doFilter(false);
      window.scrollTo(0, y);
    }

    /* تنظيف السلة مما نفد */
    cleanCart(false);

  }catch(_){}
},25000);

/* ==================== KEYBOARD ==================== */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){ closeLB();closeSzDlg();closeDlg();closeCheckout();closeSheets();closePWAModal(); document.getElementById('fpanel').classList.remove('open'); document.getElementById('tutPnl').classList.remove('open'); document.body.style.overflow=''; }
});

/* ==================== INIT ==================== */
document.addEventListener('DOMContentLoaded',()=>{
  /* اللغة المحفوظة من زيارة سابقة */
  try{ const _l=localStorage.getItem('lang'); if(_l && L[_l]) setLang(_l); }catch(_){}
  registerSW();
  loadFavs(); updateFavBadge();
  setupPWA(); startCountdown(); loadCart(); initPTR();
  initInAppBanner();
  initShopNav(); restoreShopNav();
  if(localStorage.getItem('dk')==='1'){ document.body.classList.add('dark'); document.getElementById('darkBtn').innerHTML='<i class="fas fa-sun"></i>'; }
  initPromoChip();
  bootstrap().then(openProductFromURL).catch(openProductFromURL);
  setTimeout(initTutorial,500);
});
