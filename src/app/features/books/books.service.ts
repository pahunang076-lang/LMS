import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import { increment } from 'firebase/firestore';
import { Book } from '../../core/models/book.model';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class BooksService {
  private readonly firestore = inject(Firestore);

  private booksCollection() {
    return collection(this.firestore, 'books');
  }

  getAllBooks$(): Observable<Book[]> {
    const q = query(this.booksCollection(), orderBy('title'));
    return (collectionData(q, { idField: 'id' }) as unknown as Observable<Book[]>).pipe(
      catchError((err) => {
        console.warn('Could not fetch books (permission or connection error):', err.message);
        return of([]);
      })
    );
  }

  async addBook(input: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Timestamp.now();
    await addDoc(this.booksCollection(), {
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    BooksService.showToast('success', `"${input.title}" added successfully!`);
  }

  async updateBook(
    id: string,
    changes: Partial<Omit<Book, 'id' | 'createdAt'>>
  ) {
    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      ...changes,
      updatedAt: Timestamp.now(),
    });
    BooksService.showToast('success', 'Book updated successfully!');
  }

  async deleteBook(id: string): Promise<boolean> {
    const result = await Swal.fire({
      title: 'Delete Book?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) {
      return false;
    }

    const ref = doc(this.firestore, 'books', id);
    await deleteDoc(ref);
    BooksService.showToast('success', 'Book deleted.');
    return true;
  }

  /**
   * Adjust the available quantity of a book atomically.
   * Positive delta increases availability; negative decreases it.
   */
  async adjustAvailability(id: string, delta: number) {
    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      quantityAvailable: increment(delta),
      updatedAt: Timestamp.now(),
    });
  }

  /** Increment the borrow count when a book is borrowed. */
  async incrementBorrowCount(id: string): Promise<void> {
    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      borrowCount: increment(1),
      updatedAt: Timestamp.now(),
    });
  }

  private static showToast(icon: 'success' | 'error' | 'warning', title: string): void {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    }).fire({ icon, title });
  }
}
