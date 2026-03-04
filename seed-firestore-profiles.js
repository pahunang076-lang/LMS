// seed-firestore-profiles.js
// Seeds user profiles into Firestore using the Firebase REST API
// Run with: node seed-firestore-profiles.js

const API_KEY = 'AIzaSyA8jArQZj0E2_8qBA99iijqS-J6keNnLQI';
const PROJECT_ID = 'library-management-system-g2';

// Firebase Auth UIDs assigned when we ran seed-firebase-auth.js
const users = [
    {
        uid: 'ocRbvd9UY9dbOf37zh7bMh4zCm22',
        name: 'Admin User',
        email: 'admin@example.edu',
        password: 'admin123',
        role: 'admin',
        studentId: null,
        qrCode: 'LMS-ADMIN-001-QRCODE',
        createdAt: '2025-01-01T00:00:00.000Z',
        lastLoginAt: null,
        isActive: true,
    },
    {
        uid: 'rn7bhUA54Ba66SfWEaRvNvbjr9g2',
        name: 'Jane Librarian',
        email: 'librarian@example.edu',
        password: 'librarian123',
        role: 'librarian',
        studentId: null,
        qrCode: 'LMS-LIBRARIAN-001-QRCODE',
        createdAt: '2025-01-01T00:00:00.000Z',
        lastLoginAt: null,
        isActive: true,
    },
    {
        uid: 'o6eviWyuaKcNn46nT9f1tTf6wVk1',
        name: 'Alice Santos',
        email: 'alice@students.edu',
        password: 'student123',
        role: 'student',
        studentId: '2021-00001',
        qrCode: 'LMS-STUDENT-001-QRCODE',
        createdAt: '2025-01-02T00:00:00.000Z',
        lastLoginAt: null,
        isActive: true,
    },
    {
        uid: 'rfV0DKmR0NVZSkwQglINrco2phT2',
        name: 'Bob Cruz',
        email: 'bob@students.edu',
        password: 'student123',
        role: 'student',
        studentId: '2021-00002',
        qrCode: 'LMS-STUDENT-002-QRCODE',
        createdAt: '2025-01-02T00:00:00.000Z',
        lastLoginAt: null,
        isActive: true,
    },
    {
        uid: 'DGSg3RiXwTaIMCknMroI00PGVG02',
        name: 'Carol Reyes',
        email: 'carol@students.edu',
        password: 'student123',
        role: 'student',
        studentId: '2021-00003',
        qrCode: 'LMS-STUDENT-003-QRCODE',
        createdAt: '2025-01-03T00:00:00.000Z',
        lastLoginAt: null,
        isActive: true,
    },
    {
        uid: 'veJaJ9PgB5TSHKL56QAQrdnADeu2',
        name: 'Lloyd',
        email: 'lloyd@gmail.com',
        password: 'lloyd123',
        role: 'student',
        studentId: '2024302103',
        qrCode: 'LMS-MM8G5PVZ-743C07XF1P4',
        createdAt: '2026-03-02T00:34:51.599Z',
        lastLoginAt: null,
        isActive: true,
    },
];

// First sign in to get an ID token, then write to Firestore
async function getIdToken(email, password) {
    const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        }
    );
    const data = await res.json();
    if (data.error) throw new Error(`Auth failed for ${email}: ${data.error.message}`);
    return data.idToken;
}

async function writeToFirestore(idToken, uid, profile) {
    const { password, ...firestoreData } = profile; // exclude password
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;

    // Convert JS object to Firestore document format
    const fields = {};
    for (const [key, value] of Object.entries(firestoreData)) {
        if (value === null) {
            fields[key] = { nullValue: null };
        } else if (typeof value === 'boolean') {
            fields[key] = { booleanValue: value };
        } else {
            fields[key] = { stringValue: String(value) };
        }
    }

    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ fields }),
    });

    const data = await res.json();
    if (data.error) {
        throw new Error(`Firestore write failed: ${JSON.stringify(data.error)}`);
    }
    return data;
}

async function main() {
    console.log('🔥 Seeding Firestore user profiles...\n');

    for (const user of users) {
        try {
            // Sign in as this user to get their token (they write their own doc)
            const idToken = await getIdToken(user.email, user.password);
            await writeToFirestore(idToken, user.uid, user);
            console.log(`✅ Firestore profile saved: ${user.email} (${user.role})`);
        } catch (err) {
            console.log(`❌ Failed: ${user.email} — ${err.message}`);
        }
    }

    console.log('\n✅ Done! All Firestore profiles processed.');
    console.log('\n📋 You can now log in with:');
    console.log('   Admin:     admin@example.edu / admin123');
    console.log('   Librarian: librarian@example.edu / librarian123');
    console.log('   Student:   alice@students.edu / student123');
}

main();
