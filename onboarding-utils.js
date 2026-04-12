import { db } from './firebase-config.js';
import { doc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function createCompany({ companyId, name, slug, plan = 'free' }) {
    if (!companyId || !name || !slug) {
        throw new Error('companyId, name, and slug are required.');
    }

    await setDoc(doc(db, 'companies', companyId), {
        companyId,
        name,
        slug,
        plan,
        createdAt: serverTimestamp()
    }, { merge: true });
}

export async function createUserProfile({ userId, email, companyId, role = 'admin' }) {
    if (!userId || !email || !companyId) {
        throw new Error('userId, email, and companyId are required.');
    }

    await setDoc(doc(db, 'users', userId), {
        userId,
        email,
        companyId,
        role,
        createdAt: serverTimestamp()
    }, { merge: true });
}

export async function onboardDailyBreadAdmin({ userId, email }) {
    await createCompany({
        companyId: 'dailybread',
        name: 'Daily Bread',
        slug: 'dailybread',
        plan: 'free'
    });

    await createUserProfile({
        userId,
        email,
        companyId: 'dailybread',
        role: 'admin'
    });
}
