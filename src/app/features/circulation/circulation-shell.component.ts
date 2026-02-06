import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CirculationService } from './circulation.service';
import { BooksService } from '../books/books.service';
import { Book } from '../../core/models/book.model';
import { Borrow } from '../../core/models/borrow.model';
import { combineLatest, map, switchMap, filter } from 'rxjs';
import { QrScannerComponent } from '../../shared/qr-scanner.component';

@Component({
  selector: 'app-circulation-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrScannerComponent],
  templateUrl: './circulation-shell.component.html',
  styleUrl: './circulation-shell.component.css',
})
export class CirculationShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly circulationService = inject(CirculationService);
  private readonly booksService = inject(BooksService);

  readonly user$ = this.authService.currentUser$;
  readonly allBooks$ = this.booksService.getAllBooks$();

  readonly borrows$ = this.user$.pipe(
    filter((u): u is NonNullable<typeof u> => !!u),
    switchMap((user) => this.circulationService.getBorrowsForUser$(user.uid))
  );

  readonly activeBorrows$ = this.borrows$.pipe(
    map((items) => items.filter((b) => b.status === 'borrowed' || b.status === 'overdue'))
  );

  readonly historyBorrows$ = this.borrows$.pipe(
    map((items) => items.filter((b) => b.status === 'returned'))
  );

  readonly borrowForm = this.fb.group({
    bookId: ['', Validators.required],
    dueDate: ['', Validators.required],
  });

  readonly qrBorrowForm = this.fb.group({
    dueDate: ['', Validators.required],
  });

  mode: 'manual' | 'qrBorrow' | 'qrReturn' = 'manual';

  scannedStudentId: string | null = null;
  scannedBook: Book | null = null;
  scannedBorrowForReturn: Borrow | null = null;

  qrError: string | null = null;
  qrSuccessMessage: string | null = null;

  showBorrowConfirm = false;
  showReturnConfirm = false;

  readonly vm$ = combineLatest([this.user$, this.allBooks$, this.activeBorrows$, this.historyBorrows$]).pipe(
    map(([user, books, active, history]) => ({
      user,
      books,
      active,
      history,
    }))
  );

  setMode(next: 'manual' | 'qrBorrow' | 'qrReturn'): void {
    this.mode = next;
    this.qrError = null;
    this.qrSuccessMessage = null;
    this.scannedBook = null;
    this.scannedBorrowForReturn = null;
    this.showBorrowConfirm = false;
    this.showReturnConfirm = false;
  }

  async createBorrow(
    userId: string | undefined,
    books: Book[],
    activeBorrows: Borrow[]
  ): Promise<void> {
    if (!userId || this.borrowForm.invalid) {
      this.borrowForm.markAllAsTouched();
      return;
    }

    const { bookId, dueDate } = this.borrowForm.getRawValue();
    const book = books.find((b) => b.id === bookId);

    if (!book || !book.id || !dueDate) {
      return;
    }

    if (book.quantityAvailable <= 0) {
      this.qrError = 'Cannot borrow this book because there are no available copies.';
      return;
    }

    const BORROW_LIMIT = 3;
    if (activeBorrows.length >= BORROW_LIMIT) {
      this.qrError = `Borrow limit of ${BORROW_LIMIT} active books reached.`;
      return;
    }

    const hasOverdue = activeBorrows.some((b) => b.status === 'overdue');
    if (hasOverdue) {
      this.qrError = 'Cannot borrow while you have overdue books.';
      return;
    }

    const due = new Date(dueDate);
    await this.circulationService.borrowBook(
      userId,
      book,
      due,
      this.scannedStudentId
    );
    this.borrowForm.reset();
  }

  async markReturned(borrow: Borrow): Promise<void> {
    await this.circulationService.returnBook(borrow);
  }

  onStudentQrScanned(raw: string): void {
    this.scannedStudentId = raw.trim();
    this.qrError = null;
  }

  onBookQrScannedForBorrow(raw: string, books: Book[]): void {
    this.qrError = null;
    const code = raw.trim();
    const match = books.find(
      (b) => b.id === code || b.isbn === code
    );

    if (!match) {
      this.scannedBook = null;
      this.qrError = 'Book not found for scanned QR code.';
      return;
    }

    if (match.quantityAvailable <= 0) {
      this.scannedBook = null;
      this.qrError = 'Cannot borrow. No available copies for this book.';
      return;
    }

    this.scannedBook = match;
  }

  async openBorrowConfirm(
    userId: string | undefined,
    activeBorrows: Borrow[]
  ): Promise<void> {
    if (!userId || !this.scannedBook) {
      this.qrError = 'Scan a valid book QR code first.';
      return;
    }

    if (this.qrBorrowForm.invalid) {
      this.qrBorrowForm.markAllAsTouched();
      return;
    }

    const BORROW_LIMIT = 3;
    if (activeBorrows.length >= BORROW_LIMIT) {
      this.qrError = `Borrow limit of ${BORROW_LIMIT} active books reached.`;
      return;
    }

    const hasOverdue = activeBorrows.some((b) => b.status === 'overdue');
    if (hasOverdue) {
      this.qrError = 'Cannot borrow while you have overdue books.';
      return;
    }

    if (this.scannedBook.quantityAvailable <= 0) {
      this.qrError = 'Cannot borrow. No available copies for this book.';
      return;
    }

    this.showBorrowConfirm = true;
  }

  async confirmQrBorrow(userId: string | undefined): Promise<void> {
    if (!userId || !this.scannedBook) {
      this.qrError = 'Scan a valid book QR code first.';
      return;
    }

    const { dueDate } = this.qrBorrowForm.getRawValue();
    if (!dueDate) {
      this.qrError = 'Please select a due date.';
      return;
    }

    const due = new Date(dueDate);

    await this.circulationService.borrowBook(
      userId,
      this.scannedBook,
      due,
      this.scannedStudentId
    );

    this.qrBorrowForm.reset();
    this.scannedBook = null;
    this.showBorrowConfirm = false;
    this.qrSuccessMessage = 'Borrow transaction saved successfully.';
  }

  cancelBorrowConfirm(): void {
    this.showBorrowConfirm = false;
  }

  onBookQrScannedForReturn(raw: string, activeBorrows: Borrow[]): void {
    this.qrError = null;
    const code = raw.trim();
    const directMatch = activeBorrows.find((b) => b.bookId === code);

    if (directMatch) {
      this.scannedBorrowForReturn = directMatch;
      this.showReturnConfirm = true;
      return;
    }

    // Fallback: if the QR encodes an ISBN, resolve it to a book ID first.
    // (Some QR codes may be generated from ISBN when an internal ID is not available.)
    // Note: we cannot reliably resolve without the books list, so the template should pass it in.
    this.scannedBorrowForReturn = null;
    this.qrError = 'Unable to match this QR to an active borrowing. Please rescan.';
  }

  onBookQrScannedForReturnWithBooks(
    raw: string,
    activeBorrows: Borrow[],
    books: Book[]
  ): void {
    this.qrError = null;
    const code = raw.trim();

    const directMatch = activeBorrows.find((b) => b.bookId === code);
    if (directMatch) {
      this.scannedBorrowForReturn = directMatch;
      this.showReturnConfirm = true;
      return;
    }

    const book = books.find((b) => b.id === code || b.isbn === code);
    const resolvedBookId = book?.id ?? null;
    const resolvedMatch = resolvedBookId
      ? activeBorrows.find((b) => b.bookId === resolvedBookId)
      : undefined;

    if (!resolvedMatch) {
      this.scannedBorrowForReturn = null;
      this.qrError = 'No active borrow record found for this book.';
      return;
    }

    this.scannedBorrowForReturn = resolvedMatch;
    this.showReturnConfirm = true;
  }

  async confirmQrReturn(): Promise<void> {
    if (!this.scannedBorrowForReturn) {
      this.qrError = 'No borrow record selected for return.';
      return;
    }

    await this.circulationService.returnBook(this.scannedBorrowForReturn);
    this.showReturnConfirm = false;
    this.scannedBorrowForReturn = null;
    this.qrSuccessMessage = 'Return transaction saved successfully.';
  }

  cancelReturnConfirm(): void {
    this.showReturnConfirm = false;
  }

  onScannerError(message: string): void {
    // Only surface a generic error to avoid noisy per-frame messages.
    this.qrError = 'Unable to read QR code. Please adjust the camera and try again.';
  }

  asDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const anyVal: any = value;
    if (anyVal.toDate instanceof Function) {
      return anyVal.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    return new Date(anyVal as any);
  }
}

