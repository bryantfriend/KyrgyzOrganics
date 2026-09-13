import { uploadImage } from './utils.js';

export function createQrPaymentEditor(form) {
    const panel = document.createElement('fieldset');
    panel.innerHTML = `<legend>QR payment with receipt</legend>
      <label><input type="checkbox" id="pQrEnabled"> Accept QR payments for this product</label>
      <p>Recommended for services such as Saikal’s therapy sessions. Shipping is not included, so this method is not recommended for products requiring delivery.</p>
      <div id="pQrDetails" hidden>
        <label for="pQrFile">Upload payment QR code</label>
        <input id="pQrFile" type="file" accept="image/png,image/jpeg,image/webp">
        <small>PNG, JPG or WebP, under 5 MB. Use the original bank QR image.</small>
        <img id="pQrPreview" alt="Payment QR preview" hidden style="max-width:220px;max-height:260px;margin:12px 0;object-fit:contain">
        <label for="pQrAccount">Recipient / bank name</label>
        <input id="pQrAccount" maxlength="160" placeholder="Name customers should verify before paying">
      </div>`;
    form.querySelector('#pSubmitBtn').before(panel);
    const enabled = panel.querySelector('#pQrEnabled');
    const details = panel.querySelector('#pQrDetails');
    const file = panel.querySelector('#pQrFile');
    const preview = panel.querySelector('#pQrPreview');
    const account = panel.querySelector('#pQrAccount');
    let savedUrl = '', objectUrl = '';
    const refresh = () => { details.hidden = !enabled.checked; };
    enabled.addEventListener('change', refresh);
    file.addEventListener('change', () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = file.files[0] ? URL.createObjectURL(file.files[0]) : '';
        preview.src = objectUrl || savedUrl;
        preview.hidden = !(objectUrl || savedUrl);
    });
    return {
        load(value = {}) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = ''; file.value = ''; savedUrl = value.qrUrl || '';
            enabled.checked = value.enabled === true; account.value = value.accountName || '';
            preview.src = savedUrl; preview.hidden = !savedUrl; refresh();
        },
        async save() {
            if (enabled.checked) {
                const image = file.files[0];
                if (image && (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type) || image.size >= 5 * 1024 * 1024)) {
                    throw new Error('Choose a PNG, JPG or WebP QR image under 5 MB.');
                }
                if (!savedUrl && !image) throw new Error('Upload a QR code before enabling QR payments.');
                if (!account.value.trim()) throw new Error('Enter the payment recipient / bank name.');
                if (image) savedUrl = await uploadImage(image, 'products', { autoCompress: false });
            }
            return { enabled: enabled.checked, qrUrl: savedUrl, accountName: account.value.trim() };
        }
    };
}
