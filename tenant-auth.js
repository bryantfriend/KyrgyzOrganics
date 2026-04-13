import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { COMPANY_ID, setCompanyId } from './company-config.js';

export async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
}

export async function getUserProfile(userId) {
    if (!userId) return null;
    const userDoc = await getDoc(doc(db, "users", userId));
    return userDoc.exists() ? userDoc.data() : null;
}

export async function getUserCompany(userId) {
    if (!userId) return null;
    const userDoc = await getDoc(doc(db, "users", userId));
    return userDoc.exists() ? userDoc.data().companyId : null;
}

export async function loadUserCompany(user) {
    const companyId = await getUserCompany(user?.uid);
    if (!companyId) {
        console.warn("User missing companyId. Falling back to default company:", user?.uid);
    }
    setCompanyId(companyId || COMPANY_ID);
    return companyId || COMPANY_ID;
}

export async function ensureBaseCompanies() {
    const companies = [
        {
            companyId: "kyrgyz-organics",
            name: "Kyrgyz Organic",
            slug: "oako",
            plan: "pro"
        },
        {
            companyId: "dailybread",
            name: "Daily Bread",
            slug: "dailybread",
            plan: "free"
        }
    ];

    await Promise.all(companies.map(async (company) => {
        const companyRef = doc(db, "companies", company.companyId);
        const existing = await getDoc(companyRef);
        await setDoc(companyRef, {
            ...company,
            ...(existing.exists() ? {} : { createdAt: serverTimestamp() })
        }, { merge: true });
    }));
}
