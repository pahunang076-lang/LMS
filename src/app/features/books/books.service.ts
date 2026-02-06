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
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BooksService {
  private readonly firestore = inject(Firestore);

  private readonly storageKey = 'lms_books';
  private readonly useLocalStore =
    typeof window !== 'undefined' && BooksService.isFirebasePlaceholderConfig();

  private readonly localBooksSubject = new BehaviorSubject<Book[]>(
    this.useLocalStore ? this.loadLocalBooks() : []
  );

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
      return;
    }

    const now = Timestamp.now();
    await addDoc(this.booksCollection(), {
      ...input,
      createdAt: now,
      updatedAt: now,
    });
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
      return;
    }

    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      ...changes,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteBook(id: string) {
    if (this.useLocalStore) {
      const updated = this.localBooksSubject.value.filter((b) => b.id !== id);
      this.persistLocalBooks(updated);
      this.localBooksSubject.next(updated);
      return;
    }

    const ref = doc(this.firestore, 'books', id);
    await deleteDoc(ref);
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
      return;
    }

    const ref = doc(this.firestore, 'books', id);
    await updateDoc(ref, {
      quantityAvailable: increment(delta),
      updatedAt: Timestamp.now(),
    });
  }

  private static isFirebasePlaceholderConfig(): boolean {
    const fb = environment.firebase as any;
    const apiKey = String(fb?.apiKey ?? '');
    const projectId = String(fb?.projectId ?? '');
    // If the environment file still contains placeholders, use local storage mode.
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

