    const API_URL = 'https://script.google.com/macros/s/AKfycbwK-ocQW5eO9n0_8qKy2o34dVjFT2Qyb2vE5HWVIoAU6KrwqwbcDiVT8dhmXOtGs3eEBw/exec';
    let data = [];
function toggleDarkMode() {
    const body = document.body;
    const themeToggle = document.getElementById("themeToggle");
    body.classList.toggle("dark-mode");
    // تغيير الأيقونة بين القمر والشمس
    if (body.classList.contains("dark-mode")) {
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}
    async function fetchData() {
        try {
            const response = await fetch(API_URL);
            data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error("فشل تحميل البيانات:", error);
        }
    }
function applyFilters() {
    const typeValue = document.getElementById("typeFilter").value;
    const seasonValue = document.getElementById("seasonFilter").value;
    const filteredData = data.filter(item => {
        const typeMatch = !typeValue || item.type === typeValue;
        const seasonMatch = !seasonValue || item.season === seasonValue;
        return typeMatch && seasonMatch;
    });
    displayResults(filteredData);
}
function displayResults(results) {
    const resultsContainer = document.getElementById("resultsBody");
    resultsContainer.innerHTML = ""; // مسح أي نتائج قديمة في الجدول (سيتم إخفاء الجدول لاحقًا)
    document.getElementById("counter").textContent = `عدد النتائج: ${results.length}`;
    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">لا توجد نتائج مطابقة لبحثك.</div>';
        return;
    }
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'product-card-container';
    results.forEach(item => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const imageContainer = document.createElement('div');
        imageContainer.className = 'product-image-container';
        const img = document.createElement('img');
        img.className = 'product';
        img.src = item.picture || '';
        img.alt = 'صورة المنتج';
        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
        const details = document.createElement('div');
        details.className = 'product-details';
        const idElement = document.createElement('div');
        idElement.className = 'product-id';
        idElement.textContent = item.Id || '';
        details.appendChild(idElement);
        const sizesElement = document.createElement('div');
        sizesElement.className = 'product-sizes';
        sizesElement.textContent = item.sizes ? `القياسات: ${item.sizes}` : '';
        details.appendChild(sizesElement);
        const priceElement = document.createElement('div');
        priceElement.className = 'product-price';
        priceElement.textContent = item.price ? `${item.price} دينار` : ''; // يمكنك إضافة الوحدة هنا
        details.appendChild(priceElement);
        const orderButton = document.createElement('a');
        orderButton.className = 'product-order-button';
        orderButton.href = `https://wa.me/9647766142936?text=مرحباً، أرغب بشراء المنتج التالي ID: ${item.Id || ''} - القياس: ${item.sizes || ''}`;
        orderButton.target = '_blank';
        orderButton.title = 'اطلب عبر واتساب';
        orderButton.innerHTML = '<i class="fab fa-whatsapp"></i> طلب';
        details.appendChild(orderButton);
// إضافة زر "إضافة إلى السلة" هنا
const addToCartButton = document.createElement('button');
addToCartButton.className = 'add-to-cart-button';
addToCartButton.innerHTML = '<i class="fas fa-shopping-cart"></i> إضافة للسلة';
addToCartButton.onclick = () => {
    showAddToCartDialog(item.Id, item.sizes, item.price);
};
details.appendChild(addToCartButton);
card.appendChild(details);
cardsContainer.appendChild(card);
});
    // الحصول على الحاوية الجديدة وإضافة البطاقات إليها
    const productsContainer = document.getElementById('productsContainer');
    productsContainer.innerHTML = ''; // مسح أي محتوى سابق في الحاوية
    productsContainer.appendChild(cardsContainer);
    // إخفاء الجدول القديم (كما هو موجود)
    const resultsTable = document.getElementById('resultsTable');
    resultsTable.style.display = 'none';
}
    function sortResults() {
        const sortOption = document.getElementById("sortSelect").value;
        let sortedData = [...data];
        if (sortOption === "price-asc") {
            sortedData.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortOption === "price-desc") {
            sortedData.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        }
        displayResults(sortedData);
    }
function toggleContactOptions() {
    const contactOptions = document.getElementById('contactOptions');
    contactOptions.style.display = contactOptions.style.display === 'none' ? 'flex' : 'none';
}
function resetSearch() {
    document.getElementById("searchInput").value = "";
    document.getElementById("typeFilter").value = ""; // إعادة تعيين فلتر النوع
    document.getElementById("seasonFilter").value = ""; // إعادة تعيين فلتر الموسم
    displayResults(data); // عرض جميع البيانات الأصلية
}
    // تحسين البحث الفوري
    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", function() {
        const query = this.value.toLowerCase().trim();
        const filtered = data.filter(item => {
            const id = item.Id ? item.Id.toString().toLowerCase() : "";
            const size = item.sizes ? item.sizes.toString().toLowerCase() : "";
            return id.includes(query) || size.includes(query);
        });
        displayResults(filtered);
    });
    function scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function scrollToBottom() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }
let cartItems = [];
function addToCart(productId, size, price) {
    const item = { productId, size, price };
    // التحقق إذا كان المنتج مكرر
    const existing = cartItems.find(i => i.productId === productId && i.size === size);
    if (existing) {
        showNotification("المنتج موجود بالفعل في السلة.", "warning"); // استخدام الإشعار الجديد
        return;
    }
    cartItems.push(item);
    updateCartIcon(); // تحديث عداد أو شكل السلة (يمكنك تركها فارغة الآن)
    showNotification("تمت إضافة المنتج إلى السلة!", "success"); // استخدام الإشعار الجديد
}
function updateCartIcon() {
    const cartCounter = document.getElementById('cartCounter');
    cartCounter.textContent = cartItems.length;
    cartCounter.style.display = cartItems.length > 0 ? 'inline-block' : 'none';
}
function viewCart() {
    const cartDetailsPanel = document.getElementById('cartDetailsPanel');
    const cartItemsList = document.getElementById('cartItemsList');
    // مسح القائمة القديمة
    cartItemsList.innerHTML = '';
    if (cartItems.length === 0) {
        cartItemsList.innerHTML = '<li>السلة فارغة.</li>';
    } else {
        cartItems.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <div class="item-details">
                    ID: ${item.productId} - القياس: ${item.size} - السعر: ${item.price} دينار
                </div>
                <button class="remove-button" onclick="removeFromCart('${item.productId}', '${item.size}')"><i class="fas fa-trash-alt"></i></button>
            `;
            cartItemsList.appendChild(listItem);
        });
    }
    cartDetailsPanel.style.display = 'block';
}
function toggleCartDetails() {
    const cartDetailsPanel = document.getElementById('cartDetailsPanel');
    cartDetailsPanel.style.display = (cartDetailsPanel.style.display === 'block') ? 'none' : 'block';
}
function removeFromCart(productId, size) {
    cartItems = cartItems.filter(item => !(item.productId === productId && item.size === size));
    localStorage.setItem('cartItems', JSON.stringify(cartItems)); // تحديث localStorage
    updateCartIcon(); // تحديث أيقونة السلة
    viewCart(); // إعادة عرض تفاصيل السلة بعد الحذف
    showNotification("تم حذف المنتج من السلة.", "success");
}
    fetchData();
function checkout() {
    if (cartItems.length > 0) {
        let message = "مرحباً، أرغب بإتمام شراء المنتجات التالية:\n";
        let totalPrice = 0;
        cartItems.forEach(item => {
            message += `- ID: ${item.productId}، القياس: ${item.size}، السعر: ${item.price} دينار\n`;
            totalPrice += parseFloat(item.price);
        });
        message += `\nالإجمالي: ${totalPrice} دينار`;
        // ترميز الرسالة لعنوان URL
        const encodedMessage = encodeURIComponent(message);
        const whatsappURL = `https://wa.me/9647766142936?text=${encodedMessage}`;
        // فتح رابط الواتساب في نافذة جديدة
        window.open(whatsappURL, '_blank');
    } else {
        showNotification("السلة فارغة، لا يوجد منتجات لإتمام شرائها.", "warning");
    }
}
function showNotification(message, type = 'info') {
    const notificationDiv = document.createElement('div');
    notificationDiv.className = `notification ${type}`;
    notificationDiv.textContent = message;
    // يمكنك إضافة أنماط CSS مباشرة هنا إذا كنت لا تفضل وضعها في ملف CSS
    notificationDiv.style.position = 'fixed';
    notificationDiv.style.top = '20px';
    notificationDiv.style.left = '50%';
    notificationDiv.style.transform = 'translateX(-50%)';
    notificationDiv.style.backgroundColor = '#f8f9fa';
    notificationDiv.style.color = '#333';
    notificationDiv.style.padding = '15px 20px';
    notificationDiv.style.borderRadius = '8px';
    notificationDiv.style.zIndex = '1000';
    notificationDiv.style.opacity = '0';
    notificationDiv.style.transition = 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out';
    notificationDiv.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    if (type === 'success') {
        notificationDiv.style.backgroundColor = '#d4edda';
        notificationDiv.style.color = '#155724';
    } else if (type === 'warning') {
        notificationDiv.style.backgroundColor = '#fff3cd';
        notificationDiv.style.color = '#85640a';
    } else if (type === 'error') {
        notificationDiv.style.backgroundColor = '#f8d7da';
        notificationDiv.style.color = '#721c24';
    }
    document.body.appendChild(notificationDiv);
    // إظهار الإشعار بعد جزء من الثانية لتفعيل الانتقال
    setTimeout(() => {
        notificationDiv.style.opacity = '1';
        notificationDiv.style.transform = 'translateY(0)';
    }, 50);
    // إزالة الإشعار بعد فترة زمنية قصيرة
    setTimeout(() => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            notificationDiv.remove();
        }, 300); // تأخير بسيط لإكمال تأثير التلاشي
    }, 3000); // 3 ثواني (يمكن تعديل هذه المدة)
}
// عناصر سلة التسوق (بافتراض وجودها)
const cartButton = document.querySelector('.cart-float-button');
const cartDetailsPanel = document.getElementById('cartDetailsPanel');
// عناصر القياسات
const measurementsButton = document.querySelector('.measurements-float-button');
const measurementListPanel = document.getElementById('measurementListPanel');
const closeMeasurementsButton = document.querySelector('.close-measurements-button'); // احصل على مرجع لزر الإغلاق
function togglePanel(panel, button) {
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
    // يمكنك إضافة كود إضافي هنا لتغيير حالة الزر المرئية إذا لزم الأمر
}
if (cartButton && cartDetailsPanel) {
    cartButton.addEventListener('click', () => togglePanel(cartDetailsPanel, cartButton));
    // أغلق سلة التسوق عند النقر خارجها
    document.addEventListener('click', (event) => {
        if (cartDetailsPanel.style.display === 'block' && !cartDetailsPanel.contains(event.target) && event.target !== cartButton) {
            cartDetailsPanel.style.display = 'none';
        }
    });
}
if (measurementsButton && measurementListPanel) {
    measurementsButton.addEventListener('click', () => togglePanel(measurementListPanel, measurementsButton));
    // أغلق لوحة القياسات عند النقر خارجها
    document.addEventListener('click', (event) => {
        if (measurementListPanel.style.display === 'block' && !measurementListPanel.contains(event.target) && event.target !== measurementsButton) {
            measurementListPanel.style.display = 'none';
        }
    });
    // أضف مستمع حدث لزر الإغلاق الداخلي
    if (closeMeasurementsButton) {
        closeMeasurementsButton.addEventListener('click', () => togglePanel(measurementListPanel, measurementsButton));
    }
}
let currentProductId = null;
let currentProductSizeOptions = null;
let currentProductPrice = null;

function showAddToCartDialog(productId, sizeOptions, price) {
    currentProductId = productId;
    currentProductSizeOptions = sizeOptions; // تخزين خيارات القياس المتاحة
    currentProductPrice = price;
    const sizeInputDialog = document.getElementById('sizeInputDialog');
    sizeInputDialog.style.display = 'block';
    document.getElementById('sizeInput').value = ''; // مسح القيمة السابقة
    document.getElementById('sizeSuggestions').style.display = 'none'; // إخفاء الاقتراحات

    console.log("Size Options:", currentProductSizeOptions); // تحقق من البيانات هنا
}

function filterSizeOptions() {
    const input = document.getElementById('sizeInput').value.toLowerCase();
    const suggestionsDiv = document.getElementById('sizeSuggestions');
    suggestionsDiv.innerHTML = '';

    if (input.length > 0 && currentProductSizeOptions) {
        const filteredSizes = currentProductSizeOptions.filter(size => size.toLowerCase().includes(input));
        if (filteredSizes.length > 0) {
            filteredSizes.forEach(size => {
                const suggestion = document.createElement('div');
                suggestion.textContent = size;
                suggestion.onclick = () => {
                    document.getElementById('sizeInput').value = size;
                    suggestionsDiv.style.display = 'none';
                };
                suggestionsDiv.appendChild(suggestion);
            });
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

function confirmAddToCart() {
    const sizeInput = document.getElementById('sizeInput').value;
    if (sizeInput && currentProductSizeOptions.includes(sizeInput)) {
        addToCart(currentProductId, sizeInput, currentProductPrice);
        closeAddToCartDialog();
    } else {
        showNotification("القياس غير متاح. الرجاء الاختيار من القائمة.", "warning");
    }
}

function cancelAddToCart() {
    closeAddToCartDialog();
}

function closeAddToCartDialog() {
    const sizeInputDialog = document.getElementById('sizeInputDialog');
    sizeInputDialog.style.display = 'none';
    document.getElementById('sizeInput').value = '';
    document.getElementById('sizeSuggestions').style.display = 'none';
    currentProductId = null;
    currentProductSizeOptions = null;
    currentProductPrice = null;
}

function addToCart(productId, size, price) {
    const item = { productId, size, price };
    // التحقق إذا كان المنتج مكرر
    const existing = cartItems.find(i => i.productId === productId && i.size === size && i.productId === productId);
    if (existing) {
        showNotification("المنتج موجود بالفعل في السلة.", "warning");
        return;
    }
    cartItems.push(item);
    updateCartIcon();
    showNotification(`تمت إضافة المنتج ${productId} بالقياس ${size} إلى السلة!`, "success");
}
