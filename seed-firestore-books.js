// seed-firestore-books.js
// Seeds the books collection into Firestore using the Firebase REST API
// Run with: node seed-firestore-books.js

const API_KEY = 'AIzaSyA8jArQZj0E2_8qBA99iijqS-J6keNnLQI';
const PROJECT_ID = 'library-management-system-g2';

// Sign in credentials for an existing admin/librarian
const ADMIN_EMAIL = 'librarian@example.edu';
const ADMIN_PASSWORD = 'librarian123';

// Books data to seed (from db.json)
const books = [
    {
        id: 'book-001',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        category: 'Programming',
        isbn: '978-0132350884',
        quantityTotal: 3,
        quantityAvailable: 2,
        status: 'available',
        description: 'A handbook of agile software craftsmanship.',
        createdAt: '2025-01-05T00:00:00.000Z',
        updatedAt: '2025-01-05T00:00:00.000Z',
    },
    {
        id: 'book-002',
        title: 'The Pragmatic Programmer',
        author: 'David Thomas, Andrew Hunt',
        category: 'Programming',
        isbn: '978-0135957059',
        quantityTotal: 2,
        quantityAvailable: 2,
        status: 'available',
        description: 'Your journey to mastery in software development.',
        createdAt: '2025-01-05T00:00:00.000Z',
        updatedAt: '2025-01-05T00:00:00.000Z',
    },
    {
        id: 'book-003',
        title: 'Introduction to Algorithms',
        author: 'Thomas H. Cormen',
        category: 'Computer Science',
        isbn: '978-0262033848',
        quantityTotal: 4,
        quantityAvailable: 4,
        status: 'available',
        description: 'Comprehensive introduction to modern algorithm design.',
        createdAt: '2025-01-06T00:00:00.000Z',
        updatedAt: '2025-01-06T00:00:00.000Z',
    },
    {
        id: 'book-004',
        title: 'Design Patterns',
        author: 'Gang of Four',
        category: 'Programming',
        isbn: '978-0201633610',
        quantityTotal: 2,
        quantityAvailable: 1,
        status: 'available',
        description: 'Elements of reusable object-oriented software.',
        createdAt: '2025-01-07T00:00:00.000Z',
        updatedAt: '2025-01-07T00:00:00.000Z',
    },
    {
        id: 'book-005',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        category: 'Fiction',
        isbn: '978-0743273565',
        quantityTotal: 5,
        quantityAvailable: 5,
        status: 'available',
        description: 'A classic American novel set in the Jazz Age.',
        createdAt: '2025-01-08T00:00:00.000Z',
        updatedAt: '2025-01-08T00:00:00.000Z',
    },
    {
        id: 'book-006',
        title: 'Sapiens: A Brief History of Humankind',
        author: 'Yuval Noah Harari',
        category: 'History',
        isbn: '978-0062316097',
        quantityTotal: 3,
        quantityAvailable: 3,
        status: 'available',
        description: 'How Homo sapiens came to dominate the Earth.',
        createdAt: '2025-01-09T00:00:00.000Z',
        updatedAt: '2025-01-09T00:00:00.000Z',
    },
    {
        id: 'book-007',
        title: 'Atomic Habits',
        author: 'James Clear',
        category: 'Self-Help',
        isbn: '978-0735211292',
        quantityTotal: 4,
        quantityAvailable: 4,
        status: 'available',
        description: 'An easy and proven way to build good habits.',
        createdAt: '2025-01-10T00:00:00.000Z',
        updatedAt: '2025-01-10T00:00:00.000Z',
    },
    {
        id: 'book-008',
        title: 'Deep Work',
        author: 'Cal Newport',
        category: 'Self-Help',
        isbn: '978-1455586691',
        quantityTotal: 2,
        quantityAvailable: 0,
        status: 'unavailable',
        description: 'Rules for focused success in a distracted world.',
        createdAt: '2025-01-11T00:00:00.000Z',
        updatedAt: '2025-01-11T00:00:00.000Z',
    },
];

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

function toFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return { integerValue: String(value) };
    if (typeof value === 'string') return { stringValue: value };
    return { stringValue: String(value) };
}

async function writeBookToFirestore(idToken, book) {
    const { id, ...rest } = book;
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/books/${id}`;

    const fields = {};
    for (const [key, value] of Object.entries(rest)) {
        fields[key] = toFirestoreValue(value);
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
        throw new Error(`Firestore write failed for "${book.title}": ${JSON.stringify(data.error)}`);
    }
    return data;
}

async function main() {
    console.log('📚 Seeding Firestore books collection...\n');

    let idToken;
    try {
        idToken = await getIdToken(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log(`✅ Authenticated as ${ADMIN_EMAIL}\n`);
    } catch (err) {
        console.error(`❌ Authentication failed: ${err.message}`);
        process.exit(1);
    }

    for (const book of books) {
        try {
            await writeBookToFirestore(idToken, book);
            console.log(`✅ Seeded: "${book.title}" (${book.id})`);
        } catch (err) {
            console.error(`❌ Failed: "${book.title}" — ${err.message}`);
        }
    }

    console.log('\n🎉 Done! All books have been seeded to Firestore.');
    console.log('   Refresh the Book Catalog page to see the books.');
}

main();
