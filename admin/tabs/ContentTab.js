import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
            const docSnap = await getDoc(doc(db, 'pages', pageId));
            if (docSnap.exists()) {
                this.quill.root.innerHTML = docSnap.data()[lang] || '';
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
            await setDoc(doc(db, 'pages', pageId), { [lang]: content }, { merge: true });
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
            const docSnap = await getDoc(doc(db, 'pages', this.pageSelect.value));
            const source = docSnap.exists() ? (docSnap.data().en || '') : '';
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
