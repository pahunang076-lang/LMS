import { Injectable, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  getDocs,
} from '@angular/fire/firestore';
import { Observable, interval, map, catchError, of } from 'rxjs';
import { Borrow, BorrowStatus } from '../../core/models/borrow.model';
import { Book } from '../../core/models/book.model';
import { BooksService } from '../books/books.service';
import { ReservationService } from '../reservations/reservation.service';
import { EmailNotificationService } from '../../core/services/email-notification.service';
import { calculateFine } from '../../shared/fines.util';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class CirculationService {
  private readonly firestore = inject(Firestore);
  private readonly booksService = inject(BooksService);
  private readonly reservationService = inject(ReservationService);
  private readonly emailService = inject(EmailNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  /** Fine charged per day for overdue books (₱ per day). */
  readonly FINE_PER_DAY = 5;

  constructor() {
    // Run overdue check every 60 seconds
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkAndMarkOverdue());
  }

  private borrowsCollection() {
    return collection(this.firestore, 'borrows');
  }

  /** Scans all active borrows in Firestore and marks any past their due date as overdue. */
  async checkAndMarkOverdue(): Promise<void> {
    try {
      const now = new Date();
      const q = query(this.borrowsCollection(), where('status', '==', 'borrowed'));
      const snap = await getDocs(q);

      for (const docSnap of snap.docs) {
        const b = { id: docSnap.id, ...docSnap.data() } as Borrow;
        const due =
          b.dueAt instanceof Timestamp
            ? b.dueAt.toDate()
            : new Date(b.dueAt as any);

        if (due < now) {
          const fine = calculateFine(due, now, this.FINE_PER_DAY);
          await updateDoc(docSnap.ref, { status: 'overdue', fineAmount: fine });
          this.emailService.sendOverdueAlert(b.userId, b.bookTitle, fine);
        }
      }
    } catch (err) {
      console.warn('checkAndMarkOverdue error:', err);
    }
  }

  getBorrowsForUser$(userId: string): Observable<Borrow[]> {
    const q = query(this.borrowsCollection(), where('userId', '==', userId));
    return (collectionData(q, { idField: 'id' }) as unknown as Observable<Borrow[]>).pipe(
      catchError((err) => {
        console.warn('Could not fetch borrows (permission or connection error):', err.message);
        return of([]);
      })
    );
  }

  getAllBorrows$(): Observable<Borrow[]> {
    return (collectionData(this.borrowsCollection(), { idField: 'id' }) as unknown as Observable<Borrow[]>).pipe(
      catchError((err) => {
        console.warn('Could not fetch all borrows:', err.message);
        return of([]);
      })
    );
  }

  async borrowBook(
    userId: string,
    book: Book,
    dueDate: Date,
    studentId?: string | null,
    userName?: string
  ): Promise<void> {
    const borrowedAt = Timestamp.now();
    const dueAt = Timestamp.fromDate(dueDate);

    const borrowData: any = {
      userId,
      studentId: studentId ?? null,
      bookId: book.id,
      bookTitle: book.title,
      borrowedAt,
      dueAt,
      returnedAt: null,
      status: 'borrowed' as BorrowStatus,
      fineAmount: 0,
    };

    if (userName) {
      borrowData.userName = userName;
    }

    await addDoc(this.borrowsCollection(), borrowData);

    if (book.id) {
      await this.booksService.adjustAvailability(book.id, -1);
      await this.booksService.incrementBorrowCount(book.id);
    }
    CirculationService.showToast('success', `"${book.title}" borrowed successfully!`);
  }

  async returnBook(borrow: Borrow, returnDate: Date = new Date()): Promise<void> {
    if (!borrow.id || !borrow.bookId) {
      return;
    }

    const due =
      borrow.dueAt instanceof Timestamp
        ? borrow.dueAt.toDate()
        : new Date(borrow.dueAt as any);

    const fineAmount = calculateFine(due, returnDate, this.FINE_PER_DAY);
    const status: BorrowStatus = 'returned';

    const ref = doc(this.firestore, 'borrows', borrow.id);
    await updateDoc(ref, {
      returnedAt: Timestamp.fromDate(returnDate),
      status,
      fineAmount,
    });

    await this.booksService.adjustAvailability(borrow.bookId, 1);
    await this.reservationService.autoFulfillNextInQueue(borrow.bookId);

    const msg = fineAmount > 0
      ? `Book returned with a fine of ₱${fineAmount}.`
      : `"${borrow.bookTitle}" returned successfully!`;
    CirculationService.showToast(fineAmount > 0 ? 'warning' : 'success', msg);
  }

  async payFine(borrow: Borrow): Promise<void> {
    if (!borrow.id || borrow.fineAmount <= 0 || borrow.finePaid) {
      return;
    }

    const ref = doc(this.firestore, 'borrows', borrow.id);
    await updateDoc(ref, { finePaid: true, finePaidAt: new Date().toISOString() });
    CirculationService.showToast('success', `Fine of ₱${borrow.fineAmount} paid successfully!`);
  }

  async submitReview(borrowId: string, rating: number, review?: string): Promise<void> {
    const ref = doc(this.firestore, 'borrows', borrowId);
    await updateDoc(ref, { rating, review });
    CirculationService.showToast('success', 'Review submitted successfully!');
  }

  static showToast(icon: 'success' | 'error' | 'warning', title: string): void {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
    }).fire({ icon, title });
  }
}
