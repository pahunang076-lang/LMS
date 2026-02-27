import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  collectionData,
  doc,
  updateDoc,
  where,
  query,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Borrow, BorrowStatus } from '../../core/models/borrow.model';
import { Book } from '../../core/models/book.model';
import { BooksService } from '../books/books.service';
import { calculateFine } from '../../shared/fines.util';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

const JSON_SERVER_URL = 'http://localhost:3000';

@Injectable({
  providedIn: 'root',
})
export class CirculationService {
  private readonly firestore = inject(Firestore);
  private readonly booksService = inject(BooksService);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'lms_borrows';
  private readonly useLocalStore =
    typeof window !== 'undefined' && CirculationService.isFirebasePlaceholderConfig();

  private readonly localBorrowsSubject = new BehaviorSubject<Borrow[]>(
    this.useLocalStore ? this.loadLocalBorrows() : []
  );

  constructor() {
    // On startup, sync borrows from JSON Server into localStorage
    if (this.useLocalStore && isPlatformBrowser(this.platformId)) {
      this.syncBorrowsFromServer();
    }
  }

  private syncBorrowsFromServer(): void {
    this.http.get<Borrow[]>(`${JSON_SERVER_URL}/borrows`).subscribe({
      next: (borrows) => {
        if (borrows && borrows.length > 0) {
          this.persistLocalBorrows(borrows);
          this.localBorrowsSubject.next(borrows);
        }
      },
      error: () => {
        console.warn('JSON Server not available for borrows. Using local storage data.');
      },
    });
  }

  private borrowsCollection() {
    return collection(this.firestore, 'borrows');
  }

  getBorrowsForUser$(userId: string): Observable<Borrow[]> {
    if (this.useLocalStore) {
      return this.localBorrowsSubject.asObservable().pipe(
        map((items) => items.filter((b) => b.userId === userId))
      );
    }

    const q = query(this.borrowsCollection(), where('userId', '==', userId));
    return collectionData(q, { idField: 'id' }) as unknown as Observable<
      Borrow[]
    >;
  }

  getAllBorrows$(): Observable<Borrow[]> {
    if (this.useLocalStore) {
      return this.localBorrowsSubject.asObservable();
    }
    return collectionData(this.borrowsCollection(), { idField: 'id' }) as unknown as Observable<Borrow[]>;
  }

  async borrowBook(
    userId: string,
    book: Book,
    dueDate: Date,
    studentId?: string | null
  ): Promise<void> {
    if (this.useLocalStore) {
      const borrowedAt = new Date();
      const dueAt = new Date(dueDate);

      const id = CirculationService.generateId('borrow');
      const next: Borrow = {
        id,
        userId,
        studentId: studentId ?? null,
        bookId: book.id ?? book.isbn,
        bookTitle: book.title,
        borrowedAt,
        dueAt,
        returnedAt: null,
        status: 'borrowed' as BorrowStatus,
        fineAmount: 0,
      };

      const updated = [...this.localBorrowsSubject.value, next];
      this.persistLocalBorrows(updated);
      this.localBorrowsSubject.next(updated);

      if (book.id) {
        await this.booksService.adjustAvailability(book.id, -1);
      }

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.post(`${JSON_SERVER_URL}/borrows`, {
          ...next,
          borrowedAt: borrowedAt.toISOString(),
          dueAt: dueAt.toISOString(),
        }).subscribe({ error: () => { } });
      }

      CirculationService.showToast('success', `"${book.title}" borrowed successfully!`);
      return;
    }

    const borrowedAt = Timestamp.now();
    const dueAt = Timestamp.fromDate(dueDate);

    await addDoc(this.borrowsCollection(), {
      userId,
      studentId: studentId ?? null,
      bookId: book.id,
      bookTitle: book.title,
      borrowedAt,
      dueAt,
      returnedAt: null,
      status: 'borrowed' as BorrowStatus,
      fineAmount: 0,
    });

    if (book.id) {
      await this.booksService.adjustAvailability(book.id, -1);
    }
    CirculationService.showToast('success', `"${book.title}" borrowed successfully!`);
  }

  async returnBook(borrow: Borrow, returnDate: Date = new Date()): Promise<void> {
    if (!borrow.id || !borrow.bookId) {
      return;
    }

    if (this.useLocalStore) {
      const due = borrow.dueAt instanceof Date ? borrow.dueAt : new Date(borrow.dueAt as any);
      const finePerDay = 5;
      const fineAmount = calculateFine(due, returnDate, finePerDay);
      const status: BorrowStatus = fineAmount > 0 ? 'overdue' : 'returned';

      const updated = this.localBorrowsSubject.value.map((b) =>
        b.id === borrow.id
          ? {
            ...b,
            returnedAt: new Date(returnDate),
            status,
            fineAmount,
          }
          : b
      );

      this.persistLocalBorrows(updated);
      this.localBorrowsSubject.next(updated);

      await this.booksService.adjustAvailability(borrow.bookId, 1);

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.patch(`${JSON_SERVER_URL}/borrows/${borrow.id}`, {
          returnedAt: returnDate.toISOString(),
          status,
          fineAmount,
        }).subscribe({ error: () => { } });
      }

      const msg = fineAmount > 0
        ? `Book returned with a fine of ₱${fineAmount}.`
        : `"${borrow.bookTitle}" returned successfully!`;
      CirculationService.showToast(fineAmount > 0 ? 'warning' : 'success', msg);
      return;
    }

    const due =
      borrow.dueAt instanceof Timestamp
        ? borrow.dueAt.toDate()
        : new Date(borrow.dueAt as any);

    const finePerDay = 5;
    const fineAmount = calculateFine(due, returnDate, finePerDay);
    const status: BorrowStatus = fineAmount > 0 ? 'overdue' : 'returned';

    const ref = doc(this.firestore, 'borrows', borrow.id);
    await updateDoc(ref, {
      returnedAt: Timestamp.fromDate(returnDate),
      status,
      fineAmount,
    });

    await this.booksService.adjustAvailability(borrow.bookId, 1);

    const msg = fineAmount > 0
      ? `Book returned with a fine of ₱${fineAmount}.`
      : `"${borrow.bookTitle}" returned successfully!`;
    CirculationService.showToast(fineAmount > 0 ? 'warning' : 'success', msg);
  }

  private static showToast(icon: 'success' | 'error' | 'warning', title: string): void {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
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

  private loadLocalBorrows(): Borrow[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as Borrow[]) : [];
    } catch {
      return [];
    }
  }

  private persistLocalBorrows(items: Borrow[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(items));
  }
}
