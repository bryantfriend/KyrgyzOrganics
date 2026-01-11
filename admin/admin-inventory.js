
/* ---------- INVENTORY SYSTEM ---------- */
const invDateInput = document.getElementById('invDate');
const loadInvBtn = document.getElementById('loadInvBtn');
const saveInvBtn = document.getElementById('saveInvBtn');
const inventoryList = document.getElementById('inventoryList');
const invStatus = document.getElementById('invStatus');

// Set Default Date to Today
if (invDateInput) {
    invDateInput.valueAsDate = new Date();
}

let inventoryCache = {}; // Stores loaded inventory for current date

async function loadInventory() {
    const dateStr = invDateInput.value;
    if (!dateStr) return alert("Please select a date");

    if (!loadInvBtn) return;
    loadInvBtn.textContent = "Loading...";
    loadInvBtn.disabled = true;

    try {
        // 1. Ensure products loaded
        if (allProductsCache.length === 0) {
            const tempQ = query(collection(db, 'products'));
            const snap = await getDocs(tempQ);
            allProductsCache = [];
            snap.forEach(d => allProductsCache.push({ id: d.id, ...d.data() }));
        }

        // 2. Fetch Inventory Doc
        const invRef = doc(db, 'inventory', dateStr);
        const invSnap = await getDoc(invRef);

        if (invSnap.exists()) {
            inventoryCache = invSnap.data();
            invStatus.textContent = `Loaded existing inventory for ${dateStr}`;
            invStatus.style.display = 'block';
        } else {
            inventoryCache = {};
            invStatus.textContent = `No inventory set for ${dateStr}. System defaults to 0 (Unavailable).`;
            invStatus.style.display = 'block';
        }

        renderInventoryList();

    } catch (e) {
        console.error(e);
        alert("Error loading inventory: " + e.message);
    } finally {
        loadInvBtn.textContent = "Load Inventory";
        loadInvBtn.disabled = false;
    }
}

function renderInventoryList() {
    if (!inventoryList) return;
    inventoryList.innerHTML = '';

    allProductsCache.forEach(p => {
        const prodId = p.id;
        // inv data structure: { [prodId]: { available: X, sold: Y, price: Z } }
        const invItem = inventoryCache[prodId] || { available: 0, sold: 0 };

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid #eee';

        row.innerHTML = `
            <td style="padding: 10px;">
                <strong>${p.name_ru || 'Unknown Product'}</strong><br>
                <span style="font-size:0.85em; color:#777;">${p.name_en || ''}</span>
            </td>
            <td style="padding: 10px;">
                <input type="number" min="0" class="inv-qty-input" 
                    data-id="${prodId}" 
                    value="${invItem.available}" 
                    style="width: 80px; padding: 6px; border: 1px solid #ccc; border-radius: 4px;">
            </td>
            <td style="padding: 10px; color: #555;">
                ${invItem.sold || 0}
            </td>
        `;
        inventoryList.appendChild(row);
    });
}

async function saveInventory() {
    const dateStr = invDateInput.value;
    if (!dateStr) return;

    if (!saveInvBtn) return;
    saveInvBtn.textContent = "Saving...";
    saveInvBtn.disabled = true;

    try {
        const inputs = document.querySelectorAll('.inv-qty-input');
        const updateData = {}; // Will hold the map

        // Re-construct the map based on inputs plus existing 'sold' data
        inputs.forEach(input => {
            const prodId = input.dataset.dataId || input.getAttribute('data-id');
            const qty = parseInt(input.value) || 0;

            // Preserve existing 'sold' stats if any
            const existing = inventoryCache[prodId] || {};

            updateData[prodId] = {
                available: qty,
                sold: existing.sold || 0,
                price: existing.price || allProductsCache.find(p => p.id === prodId)?.price || 0 // Store price snapshot? Optional but good for history
            };
        });

        // Write to Firestore
        await setDoc(doc(db, 'inventory', dateStr), updateData);

        invStatus.textContent = `Saved successfully at ${new Date().toLocaleTimeString()}`;
        invStatus.style.background = '#e8f5e9';
        invStatus.style.color = '#2e7d32';

        // Update Local Cache
        inventoryCache = updateData;

    } catch (e) {
        console.error(e);
        alert("Error saving inventory: " + e.message);
    } finally {
        saveInvBtn.textContent = "💾 Save Inventory";
        saveInvBtn.disabled = false;
    }
}

// Listeners
if (loadInvBtn) loadInvBtn.addEventListener('click', loadInventory);
if (saveInvBtn) saveInvBtn.addEventListener('click', saveInventory);

// Auto-load on load if tab is active? Or just wait for user.
// Let's at least hook up the "Inventory" tab button to trigger a load if first time?
// Or just let user click "Load". Simple is better.
