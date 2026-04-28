import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, writeBatch } from "firebase/firestore";

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

// A curated list of gorgeous, premium book cover placeholders from Unsplash
const premiumCovers = [
  "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1511108690759-009324a5034e?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1588666309990-d68f08e3d4a6?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1506880018603-806fba944060?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1513001900722-370f803f498d?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1521123845561-140c18408cb8?q=80&w=800&auto=format&fit=crop"
];

async function updateCovers() {
  console.log("Connecting to Firebase...");
  try {
    await signInWithEmailAndPassword(auth, "admin@example.edu", "admin123");
    console.log("✅ Authenticated as Admin");
    
    console.log("Fetching existing books...");
    const booksCol = collection(db, "books");
    const snapshot = await getDocs(booksCol);
    let batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.forEach(docSnap => {
      // Remove the cover image by setting it to empty string
      batch.update(docSnap.ref, { coverImage: "" });
      updatedCount++;
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully removed pictures from ${updatedCount} books!`);
    } else {
      console.log("No books found.");
    }
    
    console.log("Process complete. Exiting...");
    process.exit(0);
    
  } catch (err) {
    console.error("❌ Error during update process:", err);
    process.exit(1);
  }
}

updateCovers();
