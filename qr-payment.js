import { auth, storage, functions, httpsCallable } from './firebase-config.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { getCurrentCompanyId } from './company-config.js';

export function mountQrPayment(root, product) {
    if (!product.qrPayment?.enabled || !product.qrPayment.qrUrl || product.active === false) return;
    const host = root.querySelector('.product-page-info') || root;
    const section = document.createElement('section');
    section.className = 'qr-payment-panel';
    section.innerHTML = `<h2>Pay by QR code</h2>
      <p>Pay for one item or session at the retail price.</p>
      <p>Your details → Scan and pay → Upload receipt</p>
      <p class="qr-payment-note">Shipping is not included. Best suited to services and sessions.</p>
      <button type="button" class="qr-start">Pay by QR code</button>
      <form hidden>
        <fieldset><legend>1. Your information</legend>
          <label>Full name<input name="customerName" autocomplete="name" maxlength="160" required></label>
          <label>Phone number<input name="customerPhone" type="tel" autocomplete="tel" maxlength="40" required></label>
          <button type="submit">Continue to payment</button>
        </fieldset>
      </form>
      <div class="qr-transfer" hidden>
        <h3>2. Scan and pay <span class="qr-amount"></span></h3>
        <p class="qr-recipient"></p>
        <img class="qr-bank-image" alt="Bank payment QR code">
        <a class="qr-open" target="_blank" rel="noopener">Open QR image to save on your phone</a>
        <p>Check the recipient and amount in your banking app before sending.</p>
        <form class="qr-receipt-form">
          <h3>3. Upload your payment receipt</h3>
          <label>Receipt (JPG, PNG, WebP or PDF, under 5 MB)<input type="file" name="receipt" accept="image/jpeg,image/png,image/webp,application/pdf" required></label>
          <button type="submit">Submit receipt</button>
        </form>
      </div>
      <p class="qr-status" role="status" aria-live="polite"></p>`;
    const orderPanel = host.querySelector('.product-order-panel');
    if (orderPanel) orderPanel.before(section); else host.append(section);
    const start = section.querySelector('.qr-start');
    const info = section.querySelector('form');
    const transfer = section.querySelector('.qr-transfer');
    const status = section.querySelector('.qr-status');
    const receiptForm = section.querySelector('.qr-receipt-form');
    const key = `qr-payment:${getCurrentCompanyId()}:${product.id}`;
    let order = null;
    const showPayment = () => {
        start.hidden = true; info.hidden = true; transfer.hidden = false;
        section.querySelector('.qr-amount').textContent = `${order.total} KGS`;
        section.querySelector('.qr-recipient').textContent = `Recipient: ${order.accountName}`;
        section.querySelector('.qr-bank-image').src = order.qrUrl;
        section.querySelector('.qr-open').href = order.qrUrl;
    };
    try { order = JSON.parse(sessionStorage.getItem(key)); if (order?.orderId) showPayment(); } catch { order = null; }
    start.onclick = () => { start.hidden = true; info.hidden = false; info.elements.customerName.focus(); };
    info.onsubmit = async event => {
        event.preventDefault();
        const button = info.querySelector('button'); button.disabled = true;
        status.textContent = 'Preparing your payment…';
        try {
            await auth.authStateReady();
            if (!auth.currentUser) await signInAnonymously(auth);
            const result = await httpsCallable(functions, 'createQrProductOrder')({
                productId: product.id, companyId: getCurrentCompanyId(),
                customerName: info.elements.customerName.value.trim(), customerPhone: info.elements.customerPhone.value.trim()
            });
            order = result.data;
            try { sessionStorage.setItem(key, JSON.stringify(order)); } catch { /* Payment can continue without session storage. */ }
            showPayment(); status.textContent = '';
        } catch (error) { status.textContent = error.message || 'Could not prepare payment. Please try again.'; }
        finally { button.disabled = false; }
    };
    receiptForm.onsubmit = async event => {
        event.preventDefault();
        const file = receiptForm.elements.receipt.files[0];
        if (!file || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type) || file.size <= 0 || file.size >= 5 * 1024 * 1024) {
            status.textContent = 'Choose a JPG, PNG, WebP or PDF receipt under 5 MB.'; return;
        }
        const button = receiptForm.querySelector('button'); button.disabled = true;
        status.textContent = 'Uploading receipt…';
        try {
            await auth.authStateReady();
            if (!auth.currentUser) await signInAnonymously(auth);
            const receiptPath = order.receiptPath || `qr_receipts/${auth.currentUser.uid}/${order.orderId}/${crypto.randomUUID()}`;
            if (!order.receiptPath) {
                await uploadBytes(ref(storage, receiptPath), file, { contentType: file.type });
                order.receiptPath = receiptPath;
                try { sessionStorage.setItem(key, JSON.stringify(order)); } catch { /* Retain in memory for retry. */ }
            }
            await httpsCallable(functions, 'submitPaymentProof')({ ...order, receiptPath });
            transfer.hidden = true;
            status.textContent = `Receipt submitted. Payment is awaiting verification. Reference: ${order.orderId}. We will contact you using the phone number you provided.`;
            try { sessionStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
        } catch (error) { status.textContent = error.message || 'Upload failed. Please try again; do not pay again.'; }
        finally { button.disabled = false; }
    };
}
