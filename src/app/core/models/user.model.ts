export type UserRole = 'admin' | 'librarian' | 'student';

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string | null;
  qrCode: string;
  createdAt?: unknown;
  lastLoginAt?: unknown;
  isActive?: boolean;
}

