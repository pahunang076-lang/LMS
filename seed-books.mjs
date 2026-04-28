import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, writeBatch, doc, Timestamp } from "firebase/firestore";

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

const dummyData = [
  { title: "Advanced Angular", author: "John Doe", category: "Programming" },
  { title: "The Cosmic Perspective", author: "Neil deGrasse Tyson", category: "Science" },
  { title: "Atomic Habits", author: "James Clear", category: "Self-Help" },
  { title: "To Kill a Mockingbird", author: "Harper Lee", category: "Fiction" },
  { title: "Refactoring UI", author: "Adam Wathan", category: "Design" },
  { title: "Clean Architecture", author: "Robert C. Martin", category: "Programming" },
  { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Science" },
  { title: "1984", author: "George Orwell", category: "Fiction" },
  { title: "A Brief History of Time", author: "Stephen Hawking", category: "History" },
  { title: "Deep Work", author: "Cal Newport", category: "Business" }
];

async function runSeed() {
  console.log("Connecting to Firebase...");
  try {
    await signInWithEmailAndPassword(auth, "admin@example.edu", "admin123");
    console.log("✅ Authenticated as Admin");
    
    // 1. Delete existing books
    console.log("Fetching existing books to delete...");
    const booksCol = collection(db, "books");
    const snapshot = await getDocs(booksCol);
    let batch = writeBatch(db);
    let count = 0;
    
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${count} old books.`);
    } else {
      console.log("No existing books found.");
    }
    
    // 2. Insert 50+ new dummy books
    console.log("Starting insertion of 55 dummy books...");
    batch = writeBatch(db); // Create a fresh batch
    
    for (let i = 1; i <= 55; i++) {
      const template = dummyData[i % dummyData.length];
      const newDocRef = doc(booksCol); // auto-generate ID
      
      const qty = Math.floor(Math.random() * 5) + 1; // 1 to 5
      
      batch.set(newDocRef, {
        title: `${template.title} Vol. ${i}`,
        author: template.author,
        category: template.category,
        isbn: `978-0100${i.toString().padStart(4, '0')}`,
        quantityTotal: qty,
        quantityAvailable: qty,
        status: "available",
        description: `This is a generated test book based on ${template.title}. Explore the vast world of ${template.category} through this placeholder volume.`,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    }
    
    await batch.commit();
    console.log("✅ Successfully inserted 55 books into Firestore!");
    
    console.log("Process complete. Exiting...");
    process.exit(0);
    
  } catch (err) {
    console.error("❌ Error during seeding process:", err);
    process.exit(1);
  }
}

runSeed();
