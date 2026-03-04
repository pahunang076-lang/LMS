// seed-firebase-auth.js
// Creates all LMS accounts in Firebase Authentication using the REST API

const API_KEY = 'AIzaSyA8jArQZj0E2_8qBA99iijqS-J6keNnLQI';

const accounts = [
    { email: 'admin@example.edu', password: 'admin123', name: 'Admin User', role: 'admin' },
    { email: 'librarian@example.edu', password: 'librarian123', name: 'Jane Librarian', role: 'librarian' },
    { email: 'alice@students.edu', password: 'student123', name: 'Alice Santos', role: 'student' },
    { email: 'bob@students.edu', password: 'student123', name: 'Bob Cruz', role: 'student' },
    { email: 'carol@students.edu', password: 'student123', name: 'Carol Reyes', role: 'student' },
    { email: 'lloyd@gmail.com', password: 'lloyd123', name: 'Lloyd', role: 'student' },
];

async function createAccount(account) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: account.email,
            password: account.password,
            displayName: account.name,
            returnSecureToken: true,
        }),
    });

    const data = await res.json();

    if (data.error) {
        if (data.error.message === 'EMAIL_EXISTS') {
            console.log(`⚠️  Already exists: ${account.email} (${account.role})`);
        } else {
            console.log(`❌ Failed: ${account.email} — ${data.error.message}`);
        }
    } else {
        console.log(`✅ Created: ${account.email} (${account.role}) — UID: ${data.localId}`);
    }
}

async function main() {
    console.log('🔥 Seeding Firebase Authentication accounts...\n');
    for (const account of accounts) {
        await createAccount(account);
    }
    console.log('\n✅ Done! All accounts processed.');
}

main();
