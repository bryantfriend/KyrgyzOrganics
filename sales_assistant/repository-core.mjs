import { COMPANY_ID, isStaff, eligibleProduct, activeCustomer, duplicateCustomers, normalized, phoneKey, parseExtraction } from "./domain.mjs";
function friendlyError(error) {
  const code = String(error && error.code || "");
  if (code.includes("permission-denied")) return "Access denied by Firebase. Check your staff profile and the deployed Sales Assistant rules. Your enquiry has not been confirmed saved.";
  if (code.includes("unauthenticated")) return "Your session has expired. Sign in again before saving.";
  if (code.includes("unavailable") || code.includes("deadline") || code.includes("timeout")) return "Firebase is unreachable. Keep this tab open and retry when connected. If a save was interrupted, reload the dashboard before creating another enquiry.";
  return error && error.message || "The operation failed. Keep this tab open and try again.";
}
function fail(message, code = "failed-precondition") {
  const error = new Error(message);
  error.code = code;
  throw error;
}
async function stableId(value) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function customerIdentity(buyer) {
  return phoneKey(buyer.phone) ? "phone:" + phoneKey(buyer.phone) : "email:" + normalized(buyer.email);
}
function rows(snapshot) {
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }));
}
function limitedRead(promise) {
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Server read timed out.");
      error.code = "timeout";
      reject(error);
    }, 18e3);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
function createRepository(sdk, db, auth) {
  async function loadIdentity() {
    const user = auth.currentUser;
    if (!user) fail("Sign in with an authorized staff account.", "unauthenticated");
    const profile = await limitedRead(sdk.getDocFromServer(sdk.doc(db, "users", user.uid)));
    const identity = profile.exists() ? { ...profile.data(), uid: user.uid } : null;
    if (!isStaff(identity)) fail("This account does not have CRM staff access.", "permission-denied");
    if (!auth.currentUser || auth.currentUser.uid !== user.uid) fail("Your session changed. Sign in again.", "unauthenticated");
    return identity;
  }
  async function catalogs() {
    await loadIdentity();
    const [customers, products] = await Promise.all([
      limitedRead(sdk.getDocsFromServer(sdk.collection(db, "customers"))),
      limitedRead(sdk.getDocsFromServer(sdk.collection(db, "products")))
    ]);
    return { customers: rows(customers).filter(activeCustomer), products: rows(products).filter(eligibleProduct) };
  }
  async function list() {
    await loadIdentity();
    const snapshot = await limitedRead(sdk.getDocsFromServer(sdk.query(sdk.collection(db, "sales_enquiries"), sdk.where("companyId", "==", COMPANY_ID))));
    return rows(snapshot).sort((a, b) => (b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0) - (a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0));
  }
  async function get(id) {
    await loadIdentity();
    if (!/^[a-f0-9]{64}$/.test(id)) fail("Invalid enquiry reference.");
    const snapshot = await limitedRead(sdk.getDocFromServer(sdk.doc(db, "sales_enquiries", id)));
    if (!snapshot.exists() || snapshot.data().companyId !== COMPANY_ID) fail("Enquiry not found.");
    return { ...snapshot.data(), id };
  }
  async function save(payload, expectedIdentity) {
    const identity = await loadIdentity();
    if (identity.uid !== expectedIdentity.uid) fail("Your session changed. Review and save again.", "unauthenticated");
    const fingerprint = await stableId(COMPANY_ID + "\n" + payload.originalMessage.trim());
    const id = payload.id || fingerprint;
    if (!/^[a-f0-9]{64}$/.test(id)) fail("Invalid enquiry reference.");
    const enquiryRef = sdk.doc(db, "sales_enquiries", id);
    const review = structuredClone(payload.review);
    const createsCustomer = review.createCustomer === true;
    const customerId = createsCustomer ? "sa_" + await stableId(customerIdentity(review.buyer)) : review.customerId || "";
    if (createsCustomer) {
      const existing = rows(await limitedRead(sdk.getDocsFromServer(sdk.collection(db, "customers"))));
      if (duplicateCustomers(review.buyer, existing.filter(activeCustomer)).length) fail("A matching CRM customer already exists. Refresh matches and explicitly link that record.");
    }
    const result = await sdk.runTransaction(db, async (transaction) => {
      const current = await transaction.get(enquiryRef);
      if (!payload.id && current.exists()) fail("This message already has an enquiry. Open it from the dashboard to continue.", "already-exists");
      if (payload.id && !current.exists()) fail("This enquiry no longer exists. Reload the dashboard.");
      if (current.exists() && current.data().revision !== payload.revision) fail("Another staff member updated this enquiry. Reload it before saving your changes.", "conflict");
      if (current.exists() && (current.data().companyId !== COMPANY_ID || current.data().originalMessage !== payload.originalMessage || current.data().rawJson !== payload.rawJson)) fail("Original message and extraction are immutable. Create a separate enquiry for a new message.");
      let customer = null;
      if (customerId) {
        customer = await transaction.get(sdk.doc(db, "customers", customerId));
        if (createsCustomer && customer.exists()) fail("This customer was already created. Refresh matches and link it.", "already-exists");
        if (!createsCustomer && (!customer.exists() || !activeCustomer(customer.data()))) fail("The linked customer is missing or archived. Review the match.");
      }
      const productIds = [...new Set(review.products.filter((item) => item.productConfirmed && item.productId).map((item) => item.productId))];
      for (const productId of productIds) {
        const product = await transaction.get(sdk.doc(db, "products", productId));
        if (!product.exists() || !eligibleProduct(product.data())) fail("A linked product is missing, inactive, or belongs to another store. Review product matches.");
      }
      if (!auth.currentUser || auth.currentUser.uid !== identity.uid) fail("Your session changed.", "unauthenticated");
      const stamp = sdk.serverTimestamp();
      if (createsCustomer) transaction.set(sdk.doc(db, "customers", customerId), {
        companyName: review.buyer.companyName,
        name: review.buyer.name || review.buyer.companyName,
        phone: review.buyer.phone,
        email: review.buyer.email,
        address: review.buyer.address,
        notes: "",
        category: review.category,
        pinCode: review.pinCode,
        createdAt: stamp,
        updatedAt: stamp
      });
      review.customerId = customerId;
      review.customerConfirmed = !!customerId;
      review.createCustomer = false;
      review.newCustomerConfirmed = false;
      review.pinCode = "";
      const record = {
        schemaVersion: 1,
        companyId: COMPANY_ID,
        source: "whatsapp-manual",
        originalMessage: payload.originalMessage,
        rawJson: payload.rawJson,
        extracted: current.exists() ? current.data().extracted : parseExtraction(payload.rawJson).data,
        review,
        revision: current.exists() ? current.data().revision + 1 : 1,
        createdAt: current.exists() ? current.data().createdAt : stamp,
        createdBy: current.exists() ? current.data().createdBy : identity.uid,
        updatedAt: stamp,
        updatedBy: identity.uid
      };
      transaction.set(enquiryRef, record);
      const eventRef = sdk.doc(db, "sales_enquiries", id, "activity", String(record.revision));
      transaction.set(eventRef, {
        actorId: identity.uid,
        createdAt: stamp,
        revision: record.revision,
        action: current.exists() ? "Enquiry updated" : "Enquiry created",
        status: review.status,
        customerId,
        customerCreated: createsCustomer,
        followUpDate: review.followUpDate || ""
      });
      return { id, revision: record.revision, review };
    });
    return result;
  }
  async function activity(id) {
    await loadIdentity();
    return rows(await limitedRead(sdk.getDocsFromServer(sdk.collection(db, "sales_enquiries", id, "activity")))).sort((a, b) => b.revision - a.revision);
  }
  return { loadIdentity, catalogs, list, get, save, activity };
}
export {
  createRepository,
  customerIdentity,
  friendlyError,
  stableId
};
