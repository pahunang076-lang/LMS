export type BorrowStatus = 'borrowed' | 'returned' | 'overdue';

export interface Borrow {
  id?: string;
  userId: string;
  /**
   * Optional student identifier for reporting / QR-based flows.
   * This may mirror AppUser.studentId when available.
   */
  studentId?: string | null;
  bookId: string;
  bookTitle: string;
  borrowedAt: unknown;
  dueAt: unknown;
  returnedAt?: unknown | null;
  status: BorrowStatus;
  fineAmount: number;
}

