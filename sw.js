/* ============================================================
   Service Worker — متجر جود العباس
   ------------------------------------------------------------
   يلزم لتثبيت التطبيق على أندرويد (المتصفح يشترط وجوده)،
   ويتيح فتح المتجر بلا إنترنت بالنسخة المحفوظة.
   ============================================================ */

const SW_VERSION = 'v2';   /* رفعه يمسح كاش الصور القديم المتضخّم */
const SHELL = 'shell-' + SW_VERSION;
const IMGS  = 'imgs-'  + SW_VERSION;

/* ملفات الواجهة الأساسية */
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(SHELL).then(function(c){
      /* نتجاهل أي ملف يفشل حتى لا يفشل التثبيت كله */
      return Promise.all(SHELL_FILES.map(function(u){
        return c.add(u).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        /* نحذف النسخ القديمة */
        if(k !== SHELL && k !== IMGS) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  const req = e.request;
  if(req.method !== 'GET') return;

  let url;
  try{ url = new URL(req.url); }catch(_){ return; }

  /* لا نلمس نداءات السكربت ولا ميتا — يجب أن تكون حيّة دائماً */
  if(url.hostname.indexOf('script.google') > -1 ||
     url.hostname.indexOf('facebook')      > -1 ||
     url.hostname.indexOf('googleusercontent') > -1){
    return;
  }

  /* الصور ======================================================
     نُخزّن صور موقعنا وحدها. صور الـCDN (jsDelivr) تمرّ للشبكة بلا
     اعتراض، لسببين:
       • ردّها مُعتِم (opaque) فلا نعرف أنجح أم فشل، وتخزينه يحجز
         من حصّة المتصفح أضعاف حجمه الحقيقي — ومع مئات الصور تمتلئ
         الحصّة فتفشل عمليات الكاش وتختفي الصور كلها.
       • الـCDN مخزَّن أصلاً عند المتصفح وعند الشبكة.
     وأي خطأ في طبقة الكاش لا يجوز أن يمنع الصورة: نسقط للشبكة. */
  if(/\.(webp|png|jpe?g|svg|gif|avif)$/i.test(url.pathname)){
    if(url.origin !== self.location.origin) return;      /* CDN: لا نعترض */
    e.respondWith(
      caches.open(IMGS).then(function(c){
        return c.match(req).then(function(hit){
          if(hit) return hit;
          return fetch(req).then(function(res){
            if(res && res.status === 200 && res.type === 'basic'){
              c.put(req, res.clone()).catch(function(){});
            }
            return res;
          }).catch(function(){ return hit || fetch(req); });
        });
      }).catch(function(){ return fetch(req); })       /* الكاش معطّل؟ الشبكة */
    );
    return;
  }

  /* الصفحات والملفات: الشبكة أولاً، والكاش عند انقطاعها */
  if(url.origin === self.location.origin){
    e.respondWith(
      fetch(req).then(function(res){
        if(res && res.status === 200){
          const copy = res.clone();
          caches.open(SHELL).then(function(c){ c.put(req, copy).catch(function(){}); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){
          return hit || caches.match('/index.html');
        });
      })
    );
  }
});
