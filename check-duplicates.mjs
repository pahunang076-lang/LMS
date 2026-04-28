import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8jArQZj0E2_8qBA99iijqS-J6keNnLQI",
  authDomain: "library-management-system-g2.firebaseapp.com",
  projectId: "library-management-system-g2",
  storageBucket: "library-management-system-g2.firebasestorage.app",
  messagingSenderId: "702980223535",
  appId: "1:702980223535:web:6195e0789a08e178f38cda"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function checkDuplicates() {
  try {
    await signInWithEmailAndPassword(auth, "admin@example.edu", "admin123");
    
    // Check books
    const booksSnap = await getDocs(collection(db, "books"));
    const books = [];
    booksSnap.forEach(b => books.push({ id: b.id, ...b.data() }));
    
    const titleCounts = {};
    const isbnCounts = {};
    let bookDups = false;
    
    books.forEach(b => {
      titleCounts[b.title] = (titleCounts[b.title] || 0) + 1;
      if (b.isbn) {
        isbnCounts[b.isbn] = (isbnCounts[b.isbn] || 0) + 1;
      }
    });
    
    console.log("--- BOOK DUPLICATES ---");
    for (const title in titleCounts) {
      if (titleCounts[title] > 1) {
        console.log(`Duplicate Title: "${title}" appears ${titleCounts[title]} times.`);
        bookDups = true;
      }
    }
    for (const isbn in isbnCounts) {
      if (isbnCounts[isbn] > 1) {
        console.log(`Duplicate ISBN: "${isbn}" appears ${isbnCounts[isbn]} times.`);
        bookDups = true;
      }
    }
    if (!bookDups) console.log("No duplicate books found!");

    // Check users
    const usersSnap = await getDocs(collection(db, "users"));
    const users = [];
    usersSnap.forEach(u => users.push({ id: u.id, ...u.data() }));
    
    const emailCounts = {};
    let userDups = false;
    
    users.forEach(u => {
      if (u.email) {
        emailCounts[u.email] = (emailCounts[u.email] || 0) + 1;
      }
    });

    console.log("\n--- USER DUPLICATES ---");
    for (const email in emailCounts) {
      if (emailCounts[email] > 1) {
        console.log(`Duplicate Email: "${email}" appears ${emailCounts[email]} times.`);
        userDups = true;
      }
    }
    if (!userDups) console.log("No duplicate users found!");

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDuplicates();
