import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { COMPANY_ID, getCurrentCompanyId } from '../../company-config.js';
import { getPageDocId } from '../../firestore-paths.js';

export class ContentTab extends BaseTab {
    constructor() {
        super('content');
        this.pageSelect = document.getElementById('pageSelect');
        this.langSelect = document.getElementById('langSelect');
        this.saveBtn = document.getElementById('saveContentBtn');
        this.loadBtn = document.getElementById('loadContentBtn');
        this.previewBtn = document.getElementById('previewContentBtn');
        this.translateBtn = document.getElementById('translateBtn');
        this.contentPreview = document.getElementById('contentPreview');
        this.previewCard = document.getElementById('previewCard');

        this.quill = null;
    }

    async init() {
        // Init Quill
        setTimeout(() => this.initQuill(), 100);

        this.bindEvents();
    }

    onShow() {
        setTimeout(() => this.initQuill(), 100);
    }

    initQuill() {
        if (this.quill) return;
        if (document.getElementById('contentEditor') && window.Quill) {
            this.quill = new Quill('#contentEditor', {
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

    bindEvents() {
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveContent());
        if (this.loadBtn) this.loadBtn.addEventListener('click', () => this.loadContent());
        if (this.previewBtn) this.previewBtn.addEventListener('click', () => this.updatePreview());
        if (this.translateBtn) this.translateBtn.addEventListener('click', () => this.translateContent());
    }

    async loadContent() {
        const pageId = this.pageSelect.value;
        const lang = this.langSelect.value;
        if (!this.quill) return;

        try {
            const companyId = getCurrentCompanyId();
            const scopedId = getPageDocId(companyId, pageId);
            let docSnap = await getDoc(doc(db, 'pages', scopedId));

            // Back-compat: legacy single-tenant pages used bare IDs (about/contact).
            if (!docSnap.exists() && companyId === COMPANY_ID) {
                docSnap = await getDoc(doc(db, 'pages', pageId));
            }

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.companyId && data.companyId !== companyId) {
                    console.warn('Page companyId mismatch:', pageId);
                    this.quill.root.innerHTML = '';
                    return;
                }
                if (!data.companyId) console.warn('Page missing companyId:', pageId);
                this.quill.root.innerHTML = data[lang] || '';
            } else {
                this.quill.root.innerHTML = '';
            }
        } catch (e) { console.error(e); }
    }

    async saveContent() {
        const pageId = this.pageSelect.value;
        const lang = this.langSelect.value;
        if (!this.quill) return;

        try {
            const content = this.quill.root.innerHTML;
            const companyId = getCurrentCompanyId();
            const scopedId = getPageDocId(companyId, pageId);
            const payload = { companyId: companyId, [lang]: content };

            await setDoc(doc(db, 'pages', scopedId), payload, { merge: true });

            // Back-compat write for the default company.
            if (companyId === COMPANY_ID) {
                await setDoc(doc(db, 'pages', pageId), payload, { merge: true });
            }
            alert('Content Saved');
        } catch (e) { alert(e.message); }
    }

    updatePreview() {
        if (this.quill && this.contentPreview) {
            this.contentPreview.innerHTML = this.quill.root.innerHTML;
            this.previewCard.style.display = 'block';
        }
    }

    async translateContent() {
        const lang = this.langSelect.value;
        if (lang === 'en') return alert("Target must be non-English");

        if (!confirm(`Overwrite ${lang} with translation?`)) return;

        try {
            const pageId = this.pageSelect.value;
            const companyId = getCurrentCompanyId();
            const scopedId = getPageDocId(companyId, pageId);
            let docSnap = await getDoc(doc(db, 'pages', scopedId));
            if (!docSnap.exists() && companyId === COMPANY_ID) {
                docSnap = await getDoc(doc(db, 'pages', pageId));
            }
            const data = docSnap.exists() ? docSnap.data() : {};
            if (data.companyId && data.companyId !== companyId) {
                console.warn('Page companyId mismatch:', this.pageSelect.value);
                return;
            }
            if (docSnap.exists() && !data.companyId) console.warn('Page missing companyId:', this.pageSelect.value);
            const source = data.en || '';
            if (!source) return alert("No English content found");

            let pair = `en|${lang}`;
            if (lang === 'kg') pair = 'en|ky';

            // MyMemory Free API
            const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(source)}&langpair=${pair}`);
            const json = await res.json();

            if (json.responseStatus === 200) {
                this.quill.root.innerHTML = json.responseData.translatedText;
            } else {
                throw new Error(json.responseDetails);
            }
        } catch (e) {
            alert("Translation error: " + e.message);
        }
    }
}
