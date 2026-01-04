import { db, storage, auth } from '../firebase-config.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDoc,
  serverTimestamp,
  updateDoc,
  doc,
  setDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* ---------- AUTH ---------- */

const authScreen = document.getElementById('authScreen');
const mainApp = document.getElementById('mainApp');

onAuthStateChanged(auth, user => {
  authScreen.hidden = !!user;
  mainApp.hidden = !user;
  if (user) loadBanners();
});

document.getElementById('logoutBtn')
  .addEventListener('click', () => signOut(auth));

/* ---------- LOGIN FORM ---------- */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pwd = document.getElementById('loginPwd').value;
    const errorP = document.getElementById('loginError');

    try {
      await signInWithEmailAndPassword(auth, email, pwd);
      loginForm.reset();
      if (errorP) errorP.textContent = '';
    } catch (err) {
      console.error(err);
      if (errorP) errorP.textContent = "Login Failed: " + err.message;
    }
  });
}

/* ---------- HELPERS ---------- */

async function uploadImage(file) {
  const storageRef = ref(storage, `banners/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

async function autoEnableScheduledBanners(snapshot) {
  const now = new Date();

  const updates = snapshot.docs.map(async docSnap => {
    const data = docSnap.data();

    const startAt = data.startAt?.toDate?.();
    const endAt = data.endAt?.toDate?.();

    const shouldEnable =
      data.active === false &&
      startAt &&
      startAt <= now &&
      (!endAt || endAt >= now);

    if (shouldEnable) {
      await updateDoc(doc(db, 'banners', docSnap.id), {
        active: true
      });
    }
  });

  await Promise.all(updates);
}

async function autoDisableExpiredBanners(snapshot) {
  const now = new Date();

  const updates = snapshot.docs.map(async docSnap => {
    const data = docSnap.data();

    if (
      data.active === true &&
      data.endAt &&
      data.endAt.toDate &&
      data.endAt.toDate() < now
    ) {
      await updateDoc(doc(db, 'banners', docSnap.id), {
        active: false
      });
    }
  });

  await Promise.all(updates);
}

/* ---------- BANNERS ---------- */

let bannerCount = 0;

const bannerForm = document.getElementById('bannerForm');
const bannerList = document.getElementById('bannerList');

bannerForm.addEventListener('submit', async e => {
  e.preventDefault();

  const file = bImageFile.files[0];
  if (!file) return;

  const imageUrl = await uploadImage(file);
  const startAt = bStartAt.value ? new Date(bStartAt.value) : null;
  const endAt = bEndAt.value ? new Date(bEndAt.value) : null;

  await addDoc(collection(db, 'banners'), {
    imageUrl,
    active: bActive.checked,
    startAt,
    endAt,
    order: bannerCount++,
    createdAt: serverTimestamp()
  });

  bannerForm.reset();
});

function loadBanners() {
  const q = query(collection(db, 'banners'), orderBy('order'));
  onSnapshot(q, async snapshot => {
    // 1️⃣ Auto-enable scheduled banners
    await autoEnableScheduledBanners(snapshot);

    // 2️⃣ Auto-disable expired banners
    await autoDisableExpiredBanners(snapshot);

    // 3️⃣ Render UI
    bannerList.innerHTML = '';
    bannerCount = snapshot.size;

    snapshot.forEach(docSnap => {
      const b = docSnap.data();

      const el = document.createElement('div');
      el.className = 'list-item';
      el.draggable = true;
      el.dataset.id = docSnap.id;

      el.innerHTML = `
        <img src="${b.imageUrl}" class="preview-img" />
        <div class="banner-controls">
          <input type="checkbox" class="toggle" ${b.active ? 'checked' : ''} />
          <button class="btn-secondary">📱</button>
          <button class="btn-danger">Del</button>
        </div>
      `;

      // Active toggle
      el.querySelector('.toggle').onchange = e =>
        updateDoc(doc(db, 'banners', docSnap.id), {
          active: e.target.checked
        });

      // Delete
      el.querySelector('.btn-danger').onclick = () =>
        deleteDoc(doc(db, 'banners', docSnap.id));

      // Mobile preview
      el.querySelector('.btn-secondary').onclick = () =>
        showPreview(b.imageUrl);

      const now = new Date();
      const startAt = b.startAt?.toDate?.();

      // Scheduled (not active yet, start date in the future)
      if (!b.active && startAt && startAt > now) {
        el.style.opacity = '0.6';
        el.title = 'Scheduled banner (will auto-enable)';
      }



      bannerList.appendChild(el);
    });

    initDragAndDrop();
  });
}

function initDragAndDrop() {
  let dragged;

  bannerList.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('dragstart', () => dragged = item);
    item.addEventListener('dragover', e => e.preventDefault());

    item.addEventListener('drop', async () => {
      if (dragged === item) return;

      bannerList.insertBefore(dragged, item);
      await persistOrder();
    });
  });
}

async function persistOrder() {
  const items = [...bannerList.children];
  for (let i = 0; i < items.length; i++) {
    await updateDoc(doc(db, 'banners', items[i].dataset.id), {
      order: i
    });
  }
}

window.showPreview = (url) => {
  mobilePreviewImg.src = url;
  mobilePreview.classList.remove('hidden');
};

window.closePreview = () =>
  mobilePreview.classList.add('hidden');

/* ---------- TABS ---------- */
const tabs = document.querySelectorAll('.tabs button');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
  });
});

/* ---------- CATEGORIES & DYNAMIC SELECT ---------- */
async function loadGenerics() {
  const q = query(collection(db, 'categories'), orderBy('name_ru'));
  const snapshot = await getDocs(q);
  const catSelect = document.getElementById('pCategory');

  // Also populate Filter Dropdown
  const filterSelect = document.getElementById('filterCategory');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    filterSelect.onchange = () => loadProducts(); // Trigger filter on change
  }

  if (!catSelect) return;
  catSelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';

  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    const name = c.name_en || c.name_ru || c.name || docSnap.id;

    // Add to Form Select
    const opt = document.createElement('option');
    opt.value = docSnap.id;
    opt.textContent = name;
    catSelect.appendChild(opt);

    // Add to Filter Select
    if (filterSelect) {
      const optF = document.createElement('option');
      optF.value = docSnap.id;
      optF.textContent = name;
      filterSelect.appendChild(optF);
    }
  });
}

// Category Management Logic
const categoryForm = document.getElementById('categoryForm');
const categoryList = document.getElementById('categoryList');
const cSubmitBtn = document.getElementById('cSubmitBtn');
const cCancelBtn = document.getElementById('cCancelBtn');
const cFormTitle = document.getElementById('catFormTitle');

// Fields
const cId = document.getElementById('cId');
const cNameRU = document.getElementById('cNameRU');
const cNameEN = document.getElementById('cNameEN');
const cNameKG = document.getElementById('cNameKG');
const cStyleBg = document.getElementById('cStyleBg');
const cStyleBorder = document.getElementById('cStyleBorder');
const cStyleColor = document.getElementById('cStyleColor');
const cActive = document.getElementById('cActive');
const catPreview = document.getElementById('catPreview'); // New Preview Element

// Live Preview Updater
function updatePreview() {
  if (!catPreview) return;
  catPreview.style.background = cStyleBg.value;
  catPreview.style.borderColor = cStyleBorder.value;
  // Ensure border style is solid so color is visible
  catPreview.style.borderStyle = 'solid';
  catPreview.style.borderWidth = '1px';
  catPreview.style.color = cStyleColor.value;
  catPreview.textContent = cNameEN.value || cNameRU.value || 'Category Name';
}

// Attach listeners
[cNameRU, cNameEN, cStyleBg, cStyleBorder, cStyleColor].forEach(el => {
  if (el) el.addEventListener('input', updatePreview);
});

// Init Preview
updatePreview();

if (categoryForm) {
  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name_ru: cNameRU.value,
      name_en: cNameEN.value,
      name_kg: cNameKG.value,
      style_bg: cStyleBg.value,
      style_border: cStyleBorder.value,
      style_color: cStyleColor.value,
      active: cActive.checked
    };

    try {
      if (cId.value) {
        // Update
        await updateDoc(doc(db, 'categories', cId.value), data);
        alert('Category Updated');
      } else {
        // Create
        await addDoc(collection(db, 'categories'), data);
        alert('Category Created');
      }
      resetCategoryForm();
    } catch (err) {
      console.error(err);
      alert('Error saving category');
    }
  });

  cCancelBtn.addEventListener('click', resetCategoryForm);
}

function resetCategoryForm() {
  categoryForm.reset();
  cId.value = '';
  cSubmitBtn.textContent = 'Add Category';
  cFormTitle.textContent = 'Add Category';
  cCancelBtn.style.display = 'none';
}

function loadCategoriesSystem() {
  if (!categoryList) return;

  const q = query(collection(db, 'categories'), orderBy('name_ru'));
  onSnapshot(q, snapshot => {
    categoryList.innerHTML = '';
    loadGenerics(); // Refresh dropdown dynamically too

    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      const el = document.createElement('div');
      el.className = 'list-item';

      // Preview Circle using Category Styles
      const style = `background:${c.style_bg}; border:1px solid ${c.style_border}; color:${c.style_color}; padding:0.25rem 0.75rem; border-radius:50px; display:inline-block; margin-right:10px; font-size:0.9rem;`;

      el.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <div style="${style}">${c.name_en || c.name_ru || 'Category'}</div>
                </div>
                <div>
                     <button class="btn-secondary" title="Edit" onclick="editCategory('${docSnap.id}')">✏️</button>
                     <button class="btn-danger" title="Delete" onclick="deleteCategory('${docSnap.id}')">🗑️</button>
                </div>
            `;

      categoryList.appendChild(el);
    });
  });
}

window.editCategory = async (id) => {
  const docSnap = await getDoc(doc(db, 'categories', id));
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  cId.value = id;
  cNameRU.value = data.name_ru || '';
  cNameEN.value = data.name_en || '';
  if (cNameKG) cNameKG.value = data.name_kg || '';
  cStyleBg.value = data.style_bg || '#ffffff';
  cStyleBorder.value = data.style_border || '#000000';
  cStyleColor.value = data.style_color || '#000000';
  cActive.checked = data.active !== false;

  // Refresh Preview
  updatePreview();

  cSubmitBtn.textContent = 'Update Category';
  cFormTitle.textContent = 'Edit Category';
  cCancelBtn.style.display = 'inline-block';

  categoryForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteCategory = (id) => {
  if (confirm('Delete this category?')) {
    deleteDoc(doc(db, 'categories', id));
  }
}

// Init
loadGenerics();
loadCategoriesSystem();

/* ---------- PRODUCTS ---------- */
const productList = document.getElementById('productList');
const productForm = document.getElementById('productForm');
const pSubmitBtn = document.getElementById('pSubmitBtn');
const pCancelBtn = document.getElementById('pCancelBtn');
const prodFormTitle = document.getElementById('prodFormTitle');
const pId = document.getElementById('pId');

// Links & Previews
const pLinkPack = document.getElementById('pLinkPack'); // (Ref might be stale, removing old refs)
const pPreviewPack = document.getElementById('pPreviewPack');
const pPreviewContent = document.getElementById('pPreviewContent');
const previewContainerPack = document.getElementById('previewContainerPack');
const previewContainerContent = document.getElementById('previewContainerContent');
const fNamePack = document.getElementById('fNamePack');
const fNameContent = document.getElementById('fNameContent');

// Image Preview Helper
function handleFileSelect(input, previewImg, container, nameSpan) {
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      nameSpan.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        container.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    } else {
      nameSpan.textContent = 'No file chosen';
      // Don't hide container if there was an existing image? 
      // Actually, keep simple: new file acts as replace.
    }
  });
}
// Init File Listeners
if (document.getElementById('pImgPack')) {
  handleFileSelect(document.getElementById('pImgPack'), pPreviewPack, previewContainerPack, fNamePack);
  handleFileSelect(document.getElementById('pImgContent'), pPreviewContent, previewContainerContent, fNameContent);
}

if (productForm) {
  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const filePack = document.getElementById('pImgPack').files[0];
    const fileContent = document.getElementById('pImgContent').files[0];
    const isEdit = !!pId.value;

    if (!isEdit && !filePack) { alert('Packaging image required for new product'); return; }

    let imageUrl = null;
    let imageNoPackagingUrl = null;

    if (filePack) imageUrl = await uploadImage(filePack);
    if (fileContent) imageNoPackagingUrl = await uploadImage(fileContent);

    const data = {
      name_ru: document.getElementById('pNameRU').value,
      name_en: document.getElementById('pNameEN').value,
      name_kg: document.getElementById('pNameKG').value,
      price: Number(document.getElementById('pPrice').value),
      weight: document.getElementById('pWeight').value,
      categoryId: document.getElementById('pCategory').value,
      description_ru: document.getElementById('pDescRU').value,
      description_en: document.getElementById('pDescEN').value,
      description_kg: document.getElementById('pDescKG').value,
      // If new image, update. If not, don't overwrite (undefined/null logic handled below)
    };

    if (imageUrl) data.imageUrl = imageUrl;
    if (imageNoPackagingUrl) data.imageNoPackagingUrl = imageNoPackagingUrl;

    if (!isEdit) {
      data.active = true;
      data.isFeatured = false;
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
      alert('Product Added!');
    } else {
      await updateDoc(doc(db, 'products', pId.value), data);
      alert('Product Updated!');
    }

    resetProductForm();
  });

  if (pCancelBtn) pCancelBtn.addEventListener('click', resetProductForm);
}

function resetProductForm() {
  productForm.reset();
  pId.value = '';
  pSubmitBtn.textContent = 'Add Product';
  prodFormTitle.textContent = 'Add Product';
  pCancelBtn.style.display = 'none';

  // Reset Image UI
  previewContainerPack.style.display = 'none';
  previewContainerContent.style.display = 'none';
  pPreviewPack.src = '';
  pPreviewContent.src = '';
  fNamePack.textContent = 'No file chosen';
  fNameContent.textContent = 'No file chosen';
}

let allProductsCache = []; // Store products to filter client-side

function loadProducts() {
  const q = query(collection(db, 'products'));
  onSnapshot(q, (snapshot) => {
    allProductsCache = [];
    snapshot.forEach(docSnap => {
      allProductsCache.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderProductList();
  });
}

function renderProductList() {
  if (!productList) return;
  productList.innerHTML = '';

  const filterVal = document.getElementById('filterCategory')?.value || 'all';

  const filtered = (filterVal === 'all')
    ? allProductsCache
    : allProductsCache.filter(p => p.categoryId === filterVal);

  filtered.forEach(p => {
    const el = document.createElement('div');
    el.className = 'list-item';

    // Use Icons for buttons (Unicode/Emoji for simplicity)
    // ✏️ Edit, 🗑️ Delete
    el.innerHTML = `
        <img src="${p.imageUrl}" class="preview-img">
                <div style="flex:1; margin-left:1rem;">
                    <strong>${p.name_ru || 'No Name'}</strong><br>
                    ${p.price} som | ${p.weight}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn-secondary" title="Edit" onclick="editProduct('${p.id}')">✏️</button>
                    <button class="btn-danger" title="Delete" onclick="deleteProduct('${p.id}')">🗑️</button>
                </div>
      `;
    productList.appendChild(el);
  });
}

window.editProduct = async (id) => {
  const p = allProductsCache.find(x => x.id === id);
  if (!p) return;

  pId.value = id;
  document.getElementById('pNameRU').value = p.name_ru || '';
  document.getElementById('pNameEN').value = p.name_en || '';
  document.getElementById('pNameKG').value = p.name_kg || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pWeight').value = p.weight || '';
  document.getElementById('pCategory').value = p.categoryId || '';
  document.getElementById('pDescRU').value = p.description_ru || '';
  document.getElementById('pDescEN').value = p.description_en || '';
  document.getElementById('pDescKG').value = p.description_kg || '';

  // Show current image links
  // Show current image previews
  if (p.imageUrl) {
    pPreviewPack.src = p.imageUrl;
    previewContainerPack.style.display = 'flex';
    fNamePack.textContent = 'Existing Image';
  }
  if (p.imageNoPackagingUrl) {
    pPreviewContent.src = p.imageNoPackagingUrl;
    previewContainerContent.style.display = 'flex';
    fNameContent.textContent = 'Existing Image';
  }

  pSubmitBtn.textContent = 'Update Product';
  prodFormTitle.textContent = 'Edit Product';
  pCancelBtn.style.display = 'inline-block';

  productForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteProduct = (id) => {
  if (confirm('Delete this product?')) deleteDoc(doc(db, 'products', id));
};

// Initialize Tabs
document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).style.display = 'block';
  });
});

document.querySelector('.tabs button.active')?.click();
loadProducts();

/* ---------- CONTENT MANAGER ---------- */
const pageSelect = document.getElementById('pageSelect');
const langSelect = document.getElementById('langSelect'); // Ensure this ID matches HTML
const saveContentBtn = document.getElementById('saveContentBtn');
const loadContentBtn = document.getElementById('loadContentBtn');
const previewContentBtn = document.getElementById('previewContentBtn');
const previewCard = document.getElementById('previewCard');
const contentPreview = document.getElementById('contentPreview');

let quill; // Quill instance

// Init Quill
function initQuill() {
  if (quill) return;

  // Check if element exists
  if (document.getElementById('contentEditor')) {
    quill = new Quill('#contentEditor', {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ 'header': [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'color': [] }, { 'background': [] }],
          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
          [{ 'align': [] }],
          ['link', 'image', 'video'],
          ['clean']
        ]
      }
    });
  }
}

// Load Content
async function loadPageContent() {
  const pageId = pageSelect.value;
  const lang = langSelect.value;

  if (!quill) {
    console.warn("Quill not initialized");
    return;
  }

  try {
    const docRef = doc(db, 'pages', pageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const content = data[lang] || '';
      quill.root.innerHTML = content;
    } else {
      quill.root.innerHTML = '';
    }
    console.log(`Loaded ${pageId} (${lang})`);
  } catch (e) {
    console.error("Error loading content:", e);
    alert("Error loading content: " + e.message);
  }
}

// Save Content
async function savePageContent() {
  const pageId = pageSelect.value;
  const lang = langSelect.value;

  if (!quill) return;

  const content = quill.root.innerHTML;

  try {
    const docRef = doc(db, 'pages', pageId);
    await setDoc(docRef, { [lang]: content }, { merge: true });
    alert('Content saved successfully!');
  } catch (e) {
    console.error("Error saving content:", e);
    alert("Error saving content: " + e.message);
  }
}

// Preview
function updateContentPreview() {
  if (!quill) return;
  const content = quill.root.innerHTML;
  contentPreview.innerHTML = content;
  previewCard.style.display = 'block';
}

// Translate
const translateBtn = document.getElementById('translateBtn');

async function translateContent() {
  const pageId = pageSelect.value;
  const lang = langSelect.value;

  if (lang === 'en') {
    alert("Please select Russian or Kyrgyz to translate INTO.");
    return;
  }

  if (!confirm(`This will overwrite the current ${lang.toUpperCase()} content with a translation from English. Continue?`)) return;

  try {
    // 1. Get English Content
    const docRef = doc(db, 'pages', pageId);
    const docSnap = await getDoc(docRef);
    let sourceText = '';

    if (docSnap.exists()) {
      sourceText = docSnap.data().en || '';
    }

    if (!sourceText) {
      alert("No English content found to translate.");
      return;
    }

    // 2. Mock / Free Translation API (MyMemory)
    // Note: MyMemory has limits. For production, use Google Cloud / DeepL.
    // We strip HTML tags for simple translation or try to send HTML (MyMemory supports some HTML).
    // For robustness in this demo, we'll try sending the HTML directly.

    let pair = `en|${lang}`;
    if (lang === 'kg') pair = 'en|ky'; // generic Kyrgyz code

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sourceText)}&langpair=${pair}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.responseStatus === 200) {
      let translated = json.responseData.translatedText;

      // 3. Set Content
      quill.root.innerHTML = translated;
      console.log("Translated:", translated);
    } else {
      throw new Error(json.responseDetails || "Translation API Error");
    }

  } catch (e) {
    console.error("Translation Error:", e);
    alert("Translation failed. You may need a professional API integration for large texts. Error: " + e.message);
  }
}

// Listeners
if (saveContentBtn) saveContentBtn.addEventListener('click', savePageContent);
if (loadContentBtn) loadContentBtn.addEventListener('click', loadPageContent);
if (previewContentBtn) previewContentBtn.addEventListener('click', updateContentPreview);
if (translateBtn) translateBtn.addEventListener('click', translateContent);

// Init Editor on Tab Click
document.querySelector('button[data-tab="content"]')?.addEventListener('click', () => {
  // Small timeout to allow display:block to apply so Quill can calculate size
  setTimeout(() => {
    initQuill();
  }, 100);
});
