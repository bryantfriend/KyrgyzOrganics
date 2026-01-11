import { BaseTab } from './BaseTab.js';
import { db } from '../../firebase-config.js';
import { uploadImage } from '../utils.js';
import {
    collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class BannersTab extends BaseTab {
    constructor() {
        super('banners');
        this.list = document.getElementById('bannerList');
        this.form = document.getElementById('bannerForm');
        this.fileInput = document.getElementById('bImageFile');
        // Inputs
        this.bActive = document.getElementById('bActive');
        this.bStartAt = document.getElementById('bStartAt');
        this.bEndAt = document.getElementById('bEndAt');

        this.bannerCount = 0;
    }

    async init() {
        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Mobile Preview helpers (global window functions needed? No, can use class method)
        // But admin.js used window.showPreview. 
        // We can attach to window if we want to keep inline HTML onclicks, 
        // OR render generic listeners. admin.js rendered HTML with local onclick buttons.
        // I will use event delegation or attach listeners on creation.

        this.loadBanners();
    }

    async loadBanners() {
        const q = query(collection(db, 'banners'), orderBy('order'));
        onSnapshot(q, async snapshot => {
            await this.autoEnableScheduledBanners(snapshot);
            await this.autoDisableExpiredBanners(snapshot);

            this.list.innerHTML = '';
            this.bannerCount = snapshot.size;

            snapshot.forEach(docSnap => {
                const b = docSnap.data();
                const el = document.createElement('div');
                el.className = 'list-item';
                el.draggable = true;
                el.dataset.id = docSnap.id;

                const now = new Date();
                const startAt = b.startAt?.toDate?.();
                const isScheduled = !b.active && startAt && startAt > now;

                if (isScheduled) {
                    el.style.opacity = '0.6';
                    el.title = 'Scheduled banner';
                }

                el.innerHTML = `
                    <img src="${b.imageUrl}" class="preview-img" />
                    <div class="banner-controls">
                        <input type="checkbox" class="toggle" ${b.active ? 'checked' : ''} />
                        <button class="btn-secondary btn-preview">📱</button>
                        <button class="btn-danger btn-delete">Del</button>
                    </div>
                `;

                // Listeners
                el.querySelector('.toggle').onchange = (e) =>
                    updateDoc(doc(db, 'banners', docSnap.id), { active: e.target.checked });

                el.querySelector('.btn-delete').onclick = () =>
                    deleteDoc(doc(db, 'banners', docSnap.id));

                el.querySelector('.btn-preview').onclick = () => {
                    // Assuming global mobilePreview/mobilePreviewImg still exist in DOM
                    const previewModal = document.getElementById('mobilePreview');
                    const previewImg = document.getElementById('mobilePreviewImg');
                    if (previewModal && previewImg) {
                        previewImg.src = b.imageUrl;
                        previewModal.classList.remove('hidden');
                    }
                };

                this.list.appendChild(el);
            });

            this.initDragAndDrop();
        });
    }

    async handleSubmit(e) {
        e.preventDefault();
        const file = this.fileInput.files[0];
        if (!file) return;

        try {
            const imageUrl = await uploadImage(file, 'banners');
            const startAt = this.bStartAt.value ? new Date(this.bStartAt.value) : null;
            const endAt = this.bEndAt.value ? new Date(this.bEndAt.value) : null;

            await addDoc(collection(db, 'banners'), {
                imageUrl,
                active: this.bActive.checked,
                startAt,
                endAt,
                order: this.bannerCount++,
                createdAt: serverTimestamp()
            });

            this.form.reset();
        } catch (err) {
            console.error(err);
            alert("Error adding banner: " + err.message);
        }
    }

    initDragAndDrop() {
        let dragged;
        this.list.querySelectorAll('.list-item').forEach(item => {
            item.addEventListener('dragstart', () => dragged = item);
            item.addEventListener('dragover', e => e.preventDefault());
            item.addEventListener('drop', async () => {
                if (dragged === item) return;
                this.list.insertBefore(dragged, item);
                await this.persistOrder();
            });
        });
    }

    async persistOrder() {
        const items = [...this.list.children];
        for (let i = 0; i < items.length; i++) {
            await updateDoc(doc(db, 'banners', items[i].dataset.id), { order: i });
        }
    }

    async autoEnableScheduledBanners(snapshot) {
        const now = new Date();
        const updates = snapshot.docs.map(async docSnap => {
            const data = docSnap.data();
            const startAt = data.startAt?.toDate?.();
            const endAt = data.endAt?.toDate?.();
            if (data.active === false && startAt && startAt <= now && (!endAt || endAt >= now)) {
                await updateDoc(doc(db, 'banners', docSnap.id), { active: true });
            }
        });
        await Promise.all(updates);
    }

    async autoDisableExpiredBanners(snapshot) {
        const now = new Date();
        const updates = snapshot.docs.map(async docSnap => {
            const data = docSnap.data();
            if (data.active === true && data.endAt?.toDate && data.endAt.toDate() < now) {
                await updateDoc(doc(db, 'banners', docSnap.id), { active: false });
            }
        });
        await Promise.all(updates);
    }
}
