export type BorrowStatus = 'borrowed' | 'returned' | 'overdue';

export interface Borrow {
  id?: string;
  userId: string;
  userName?: string; // Display name of the borrower
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
  finePaid?: boolean;
  finePaidAt?: string; // ISO timestamp when the fine was paid
  rating?: number; // 1-5 stars
  review?: string; // Optional text review
}

