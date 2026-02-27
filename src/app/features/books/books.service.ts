import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

const JSON_SERVER_URL = 'http://localhost:3000';

@Injectable({
  providedIn: 'root',
})
export class BooksService {
  private readonly firestore = inject(Firestore);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'lms_books';
  private readonly useLocalStore =
    typeof window !== 'undefined' && BooksService.isFirebasePlaceholderConfig();

  private readonly localBooksSubject = new BehaviorSubject<Book[]>(
    this.useLocalStore ? this.loadLocalBooks() : []
  );

  constructor() {
    // On startup, sync books from JSON Server into localStorage
    if (this.useLocalStore && isPlatformBrowser(this.platformId)) {
      this.syncBooksFromServer();
    }
  }

  private syncBooksFromServer(): void {
    this.http.get<Book[]>(`${JSON_SERVER_URL}/books`).subscribe({
      next: (books) => {
        if (books && books.length > 0) {
          const sorted = BooksService.sortByTitle(books);
          this.persistLocalBooks(sorted);
          this.localBooksSubject.next(sorted);
        }
      },
      error: () => {
        console.warn('JSON Server not available for books. Using local storage data.');
      },
    });
  }

  private booksCollection() {
    return collection(this.firestore, 'books');
  }

  getAllBooks$(): Observable<Book[]> {
    if (this.useLocalStore) {
      return this.localBooksSubject.asObservable();
    }

    const q = query(this.booksCollection(), orderBy('title'));
    return collectionData(q, { idField: 'id' }) as unknown as Observable<
      Book[]
    >;
  }

  async addBook(input: Omit<Book, 'id' | 'createdAt' | 'updatedAt'>) {
    if (this.useLocalStore) {
      const nowIso = new Date().toISOString();
      const id = BooksService.generateId('book');
      const next: Book = {
        id,
        ...input,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const updated = BooksService.sortByTitle([
        ...this.localBooksSubject.value,
        next,
      ]);
      this.persistLocalBooks(updated);
      this.localBooksSubject.next(updated);

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.post(`${JSON_SERVER_URL}/books`, next)
          .subscribe({ error: () => { } });
      }

      // Success toast
      BooksService.showToast('success', `"${input.title}" added successfully!`);
      return;
    }

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
    if (this.useLocalStore) {
      const nowIso = new Date().toISOString();
      const updated = BooksService.sortByTitle(
        this.localBooksSubject.value.map((b) =>
          b.id === id
            ? {
              ...b,
              ...changes,
              updatedAt: nowIso,
            }
            : b
        )
      );
      this.persistLocalBooks(updated);
      this.localBooksSubject.next(updated);

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.patch(`${JSON_SERVER_URL}/books/${id}`, { ...changes, updatedAt: nowIso })
          .subscribe({ error: () => { } });
      }

      BooksService.showToast('success', 'Book updated successfully!');
      return;
    }

    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      ...changes,
      updatedAt: Timestamp.now(),
    });
    BooksService.showToast('success', 'Book updated successfully!');
  }

  async deleteBook(id: string): Promise<boolean> {
    // Confirm before deleting
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

    if (this.useLocalStore) {
      const updated = this.localBooksSubject.value.filter((b) => b.id !== id);
      this.persistLocalBooks(updated);
      this.localBooksSubject.next(updated);

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.delete(`${JSON_SERVER_URL}/books/${id}`)
          .subscribe({ error: () => { } });
      }

      BooksService.showToast('success', 'Book deleted.');
      return true;
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
    if (this.useLocalStore) {
      const nowIso = new Date().toISOString();
      const updated = BooksService.sortByTitle(
        this.localBooksSubject.value.map((b) => {
          if (b.id !== id) {
            return b;
          }

          const nextAvailable = Math.max(
            0,
            Math.min(b.quantityTotal, b.quantityAvailable + delta)
          );

          return {
            ...b,
            quantityAvailable: nextAvailable,
            updatedAt: nowIso,
          };
        })
      );

      this.persistLocalBooks(updated);
      this.localBooksSubject.next(updated);

      // Sync to JSON Server (best-effort)
      const book = updated.find((b) => b.id === id);
      if (book && isPlatformBrowser(this.platformId)) {
        this.http.patch(`${JSON_SERVER_URL}/books/${id}`, {
          quantityAvailable: book.quantityAvailable,
          updatedAt: nowIso,
        }).subscribe({ error: () => { } });
      }
      return;
    }

    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      quantityAvailable: increment(delta),
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

  private static isFirebasePlaceholderConfig(): boolean {
    const fb = environment.firebase as any;
    const apiKey = String(fb?.apiKey ?? '');
    const projectId = String(fb?.projectId ?? '');
    return (
      apiKey.startsWith('YOUR_') ||
      projectId.startsWith('YOUR_') ||
      apiKey.length < 10 ||
      projectId.length < 2
    );
  }

  private static generateId(prefix: string): string {
    const rand = Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now()}-${rand}`;
  }

  private static sortByTitle(books: Book[]): Book[] {
    return [...books].sort((a, b) =>
      (a.title ?? '').localeCompare(b.title ?? '', undefined, {
        sensitivity: 'base',
      })
    );
  }

  private loadLocalBooks(): Book[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      const parsed = raw ? (JSON.parse(raw) as Book[]) : [];

      // Ensure all books have stable IDs in local mode.
      const normalized = parsed.map((b) => ({
        ...b,
        id: b.id ?? b.isbn ?? BooksService.generateId('book'),
      }));

      const sorted = BooksService.sortByTitle(normalized);
      this.persistLocalBooks(sorted);
      return sorted;
    } catch {
      return [];
    }
  }

  private persistLocalBooks(books: Book[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(books));
  }
}
