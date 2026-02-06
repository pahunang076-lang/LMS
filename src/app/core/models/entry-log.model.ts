export type EntryStatus = 'Inside' | 'Left';

export type VisitPurpose = 'Study' | 'Borrow/Return' | 'Research' | 'Others';

export interface EntryLog {
  id?: string;
  userId: string;
  studentId?: string | null;
  name: string;
  purpose: VisitPurpose;
  timeIn: unknown;
  timeOut?: unknown | null;
  durationMinutes?: number;
  status: EntryStatus;
  forcedCheckout?: boolean;
}

