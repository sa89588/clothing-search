/* ============================================================
   meta.js — نظام Meta Pixel الاحترافي v2
   متجر جود العباس — مُراجَع بالكامل بناءً على 12 ملاحظة
   ============================================================ */

/* ===== وضع التطوير — اجعله true للـ debugging ===== */
const META_DEBUG = false;

function _log(...args) {
  if (META_DEBUG) console.log('[Meta Pixel]', ...args);
}
function _warn(e) {
  if (META_DEBUG) console.warn('[Meta Pixel Error]', e);
}

/* ============================================================
   مولّد Event ID مع حفظ في sessionStorage
   الملاحظة العاشرة: منع التكرار عند Refresh
   ============================================================ */
function generateEventId(prefix) {
  const key = 'meta_ev_' + prefix;
  // إذا موجود في الجلسة لا نولّد جديداً
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = (prefix || 'EV') + '-' + Date.now() + '-' +
             Math.random().toString(36).substr(2, 6).toUpperCase();
  sessionStorage.setItem(key, id);
  return id;
}

/* توليد ID جديد دائماً (للأحداث غير الـ order) */
function newEventId(prefix) {
  return (prefix || 'EV') + '-' + Date.now() + '-' +
         Math.random().toString(36).substr(2, 6).toUpperCase();
}

/* ============================================================
   تطبيع رقم الهاتف
   الملاحظة الثانية: دعم +964... و 00964...
   ============================================================ */
function normalizePhone(phone) {
  if (!phone) return null;
  let d = String(phone);
  // تحويل الأرقام العربية
  d = d.replace(/[٠-٩]/g, n => '٠١٢٣٤٥٦٧٨٩'.indexOf(n));
  // إزالة كل ما ليس رقماً أو +
  d = d.replace(/[^\d+]/g, '');
  // معالجة الصيغ المختلفة
  if (d.startsWith('+964'))  d = d.slice(1);         // +9647... → 9647...
  if (d.startsWith('00964')) d = d.slice(2);          // 00964... → 964...
  if (d.startsWith('07') && d.length === 11) d = '964' + d.slice(1);
  if (d.startsWith('7')  && d.length === 10) d = '964' + d;
  if (d.startsWith('0')  && d.length === 11) d = '964' + d.slice(1);
  // يجب أن يبدأ بـ 964 وطوله صحيح
  if (!d.startsWith('964') || d.length < 12) {
    _warn('رقم هاتف غير صالح: ' + phone);
    return null;
  }
  _log('Phone normalized:', phone, '→', d);
  return d;
}

/* ============================================================
   تقسيم الاسم
   ============================================================ */
function splitName(fullName) {
  if (!fullName) return { fn: null, ln: null };
  const parts = fullName.trim().split(/\s+/);
  return {
    fn: parts[0]                               || null,
    ln: parts.length > 1 ? parts.slice(1).join(' ') : null
  };
}


/* ============================================================
   تحديد نظام/نوع الجهاز المستخدم
   يُرجع: 'iOS' أو 'Android' أو 'Desktop'
   يُرسَل مع الأحداث لتحليل سلوك كل منصة
   ============================================================ */
function getDevicePlatform() {
  try {
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    if (isIOS) return 'iOS';
    if (isAndroid) return 'Android';
    return 'Desktop';
  } catch (e) {
    return 'Unknown';
  }
}

/* هل التطبيق مُثبّت كـ PWA؟ */
function isPWAStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
           !!window.navigator.standalone;
  } catch (e) {
    return false;
  }
}

/* ============================================================
   استدعاء fbq بأمان
   الملاحظة التاسعة: debug warn بدل catch فارغ
   ============================================================ */
function px(eventType, eventName, params, eventId) {
  try {
    if (typeof fbq !== 'function') return;
    _log(eventType, eventName, params, eventId ? {eventID: eventId} : '');
    const opts = eventId ? { eventID: eventId } : undefined;
    opts ? fbq(eventType, eventName, params, opts)
         : fbq(eventType, eventName, params);
  } catch (e) {
    _warn(e);
  }
}

/* ============================================================
   تحقق من صحة value وcurrency قبل الإرسال
   Meta تشترط: value > 0 ، currency بدون مسافات أو رموز خاصة
   ============================================================ */
function safeValue(v) {
  const n = Number(v);
  return (isFinite(n) && n > 0) ? n : null; // null = لا نرسله
}
const CURRENCY = 'IQD'; // ثابت — لا مسافات، لا رموز

function buildParams(obj) {
  // يحذف أي key قيمته null أو undefined
  const clean = {};
  Object.keys(obj).forEach(function(k) {
    if (obj[k] !== null && obj[k] !== undefined) clean[k] = obj[k];
  });
  return clean;
}

/* ============================================================
   Advanced Matching — يُنفَّذ مرة واحدة فقط
   الملاحظة الأولى: بدل fbq('init') المتكررة
   ============================================================ */
let _matchingSet = false;
function metaUpdateUser(phone, name, externalId) {
  if (_matchingSet) return; // مرة واحدة فقط في الجلسة
  const normPh = normalizePhone(phone);
  const names  = splitName(name);
  if (!normPh && !names.fn) return;
  try {
    if (typeof fbq !== 'function') return;
    /* fbq('set', 'userData') هي الطريقة الصحيحة
       لتحديث بيانات المطابقة بعد init */
    fbq('set', 'userData', {
      ph:          normPh,
      fn:          names.fn,
      ln:          names.ln,
      external_id: externalId
    });
    _matchingSet = true;
    _log('Advanced Matching set:', { ph: normPh, fn: names.fn, ext: externalId });
  } catch (e) {
    _warn(e);
  }
}

/* ============================================================
   ① ViewContent — عند فتح صورة المنتج
   الملاحظة الرابعة:  إضافة contents[]
   الملاحظة السادسة: إضافة content_category
   ============================================================ */
function metaViewContent(productId, price, season, type) {
  const evId = newEventId('VC');
  const vcValue = safeValue(price);
  px('track', 'ViewContent', buildParams({
    content_ids:      [String(productId)],
    content_type:     'product',
    content_name:     'منتج #' + productId,
    content_category: [season, type].filter(Boolean).join(' / ') || undefined,
    contents:         [{ id: String(productId), quantity: 1 }],
    value:            vcValue,
    currency:         vcValue ? CURRENCY : null
  }), evId);
}

/* ============================================================
   ② Search — عند البحث
   الملاحظة السابعة: إضافة search_type (ID أو Size)
   ============================================================ */
function metaSearch(query) {
  const evId  = newEventId('SRCH');
  // تحديد نوع البحث
  const isId  = /^\d+$/.test(query.trim()) && query.trim().length > 2;
  const isSz  = /^(55|60|65|70|75|80|90|100|110|120|130|140|150|160|170)$/.test(query.trim());
  const sType = isId ? 'product_id' : isSz ? 'size' : 'keyword';
  px('track', 'Search', {
    search_string: query,
    search_type:   sType
  }, evId);
}

/* ============================================================
   ③ AddToCart — عند إضافة منتج للسلة
   الملاحظة الخامسة:  القياس في content_category لا content_name
   الملاحظة السادسة: إضافة content_category
   الملاحظة الثالثة: item_price = سعر الزبون الفعلي
   ============================================================ */
function metaAddToCart(productId, discPrice, size, season, type) {
  const evId = newEventId('ATC');
  const atcValue = safeValue(discPrice);
  if (!atcValue) { _warn('AddToCart: invalid value ' + discPrice); return; }
  px('track', 'AddToCart', buildParams({
    content_ids:      [String(productId)],
    content_type:     'product',
    content_name:     'منتج #' + productId,
    content_category: [season, type, size ? 'Q:' + size : null].filter(Boolean).join(' / ') || undefined,
    contents: [{ id: String(productId), quantity: 1, item_price: atcValue }],
    value:    atcValue,
    currency: CURRENCY
  }), evId);
}

/* ============================================================
   ④ InitiateCheckout — عند فتح نافذة بيانات الزبون
   ============================================================ */
function metaInitiateCheckout(cartItems, total) {
  const evId = generateEventId('IC'); // محفوظ في session
  const icValue = safeValue(total);
  if (!icValue) { _warn('InitiateCheckout: invalid total ' + total); return; }
  px('track', 'InitiateCheckout', buildParams({
    content_ids:  cartItems.map(function(i) { return String(i.id); }),
    content_type: 'product',
    contents:     cartItems.map(function(i) { return {
                    id:         String(i.id),
                    quantity:   1,
                    item_price: safeValue(i.disc) || 0
                  }; }),
    num_items:    cartItems.length,
    value:        icValue,
    currency:     CURRENCY,
    device_platform: getDevicePlatform(),  // نظام الهاتف
    is_pwa:          isPWAStandalone()
  }), evId);
}

/* ============================================================
   ⑤ Contact + Custom Events — عند فتح واتساب أو تليجرام
   الملاحظة السابعة: Contact + أحداث مخصصة
   ============================================================ */
function metaWhatsAppOpened(orderId) {
  const evId = orderId || newEventId('CT-WA');
  px('track', 'Contact',
     { content_name: 'WhatsApp', order_id: evId },
     'CT-WA-' + evId);
  px('trackCustom', 'WhatsAppMessageOpened',
     { order_id: evId, channel: 'whatsapp', currency: 'IQD' },
     'WA-' + evId);
}

function metaTelegramOpened(orderId) {
  const evId = orderId || newEventId('CT-TG');
  px('track', 'Contact',
     { content_name: 'Telegram', order_id: evId },
     'CT-TG-' + evId);
  px('trackCustom', 'TelegramOpened',
     { order_id: evId, channel: 'telegram', currency: 'IQD' },
     'TG-' + evId);
}

/* ============================================================
   ⑥ Lead — عند تأكيد إرسال الطلب ("نعم، تم الإرسال")
   هذا البديل الصحيح للـ Purchase الفوري
   ============================================================ */
function metaLead(cartItems, total, orderId, phone, name) {
  const evId = orderId || generateEventId('LEAD');
  // تحديث Advanced Matching بالبيانات الحقيقية للزبون (الهاتف + الاسم)
  metaUpdateUser(phone, name, evId);

  // القيمة السعرية النهائية — نتأكد من صحتها
  const leadValue = safeValue(total);
  if (!leadValue) { _warn('Lead: invalid total ' + total); }

  // نظام الجهاز المستخدم (iOS / Android / Desktop)
  const platform = getDevicePlatform();
  const normPh   = normalizePhone(phone); // للربط والتأكد من عدم التكرار

  px('track', 'Lead', buildParams({
    content_ids:  cartItems.map(function(i) { return String(i.id); }),
    content_type: 'product',
    contents:     cartItems.map(function(i) { return {
                    id:         String(i.id),
                    quantity:   1,
                    item_price: safeValue(i.disc) || 0
                  }; }),
    num_items:    cartItems.length,
    // ===== القيمة السعرية النهائية (مؤكّدة) =====
    value:        leadValue,
    currency:     leadValue ? CURRENCY : null,
    // ===== ربط الطلب بهوية المستخدم (منع التكرار + تفاصيل أكثر) =====
    external_id:  normPh || evId,        // نربط بالهاتف المطبّع كمعرّف فريد
    order_id:     orderId,               // رقم الطلب لمنع التكرار
    // ===== نظام الهاتف المستخدم =====
    device_platform: platform,           // iOS / Android / Desktop
    is_pwa:          isPWAStandalone(),  // هل من التطبيق المثبّت؟
    customer_name:   name || undefined   // اسم الزبون
  }), evId);

  // مسح session key بعد الإرسال الناجح لإتاحة طلب جديد
  sessionStorage.removeItem('meta_ev_LEAD');
  sessionStorage.removeItem('meta_ev_IC');

  _log('Lead sent:', { value: leadValue, platform: platform, phone: normPh, name: name });
}

/* ============================================================
   ⑦ Purchase — جاهز للاستدعاء يدوياً عند التأكيد الفعلي
   الملاحظة الحادية عشرة: موجود لكن غير مستدعى تلقائياً
   استخدمه مستقبلاً عند ربط Conversions API
   ============================================================ */
function metaPurchase(cartItems, total, orderId, phone, name) {
  const evId   = orderId || generateEventId('PRCH');
  const normPh = normalizePhone(phone);
  const names  = splitName(name);
  const purValue = safeValue(total);
  if (!purValue) { _warn('Purchase: invalid total ' + total); return; }
  px('track', 'Purchase', {
    content_ids:  cartItems.map(function(i) { return String(i.id); }),
    content_type: 'product',
    contents:     cartItems.map(function(i) { return {
                    id:         String(i.id),
                    quantity:   1,
                    item_price: safeValue(i.disc) || 0
                  }; }),
    num_items:    cartItems.length,
    value:        purValue,
    currency:     CURRENCY,
    external_id:  evId
  }, evId);
  /* للاستخدام مع CAPI مستقبلاً:
     sendToCAPI({ event_name:'Purchase', event_id: evId,
                  user_data: { ph: normPh, fn: names.fn }, ... });
  */
}

/* ============================================================
   ⑧ CompleteRegistration — عند تثبيت PWA
   الملاحظة الثانية عشرة
   ============================================================ */
function metaCompleteRegistration() {
  const evId = newEventId('PWA');
  px('track', 'CompleteRegistration', buildParams({
    content_name:    'PWA Install',
    status:          true,
    device_platform: getDevicePlatform()  // على أي نظام تم التثبيت
    /* لا نرسل value أو currency هنا — ليس لها قيمة مالية حقيقية */
  }), evId);
  _log('PWA installed — CompleteRegistration fired on ' + getDevicePlatform());
}
