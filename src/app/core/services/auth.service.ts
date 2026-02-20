import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppUser, UserRole } from '../models/user.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

const STORAGE_USERS_KEY = 'lms_users';
const STORAGE_CURRENT_USER_KEY = 'lms_current_user';

interface StoredUser extends AppUser {
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);

  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  private readonly currentUserSubject = new BehaviorSubject<AppUser | null>(
    AuthService.loadCurrentUserFromStorage()
  );

  readonly currentUser$: Observable<AppUser | null> =
    this.currentUserSubject.asObservable().pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );

  readonly isLoading = computed(() => this.loadingSignal());
  readonly error = computed(() => this.errorSignal());

  readonly isLoggedIn$ = this.currentUser$.pipe(
    map((user) => !!user)
  );

  constructor() {
    // Seed a default admin user if none exist yet (for local demo only).
    const users = AuthService.loadUsersFromStorage();
    if (users.length === 0) {
      const defaultAdmin: StoredUser = {
        uid: 'admin-1',
        name: 'Admin User',
        email: 'admin@example.edu',
        role: 'admin',
        studentId: null,
        qrCode: AuthService.generateUniqueQrCode(),
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        isActive: true,
        password: 'admin123',
      };
      AuthService.saveUsersToStorage([defaultAdmin]);
    } else {
      // Ensure all existing users have QR codes (migration)
      const needsUpdate = users.some((u) => !u.qrCode);
      if (needsUpdate) {
        const updatedUsers = users.map((u) => ({
          ...u,
          qrCode: u.qrCode || AuthService.generateUniqueQrCode(),
        }));
        AuthService.saveUsersToStorage(updatedUsers);
      }
    }
  }

  /**
   * Local email/password login using browser storage.
   * This is for development/demo only and is NOT secure.
   */
  async login(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const users = AuthService.loadUsersFromStorage();
      const match = users.find(
        (u) => u.email === email && u.password === password
      );

      if (!match) {
        this.errorSignal.set(
          'Invalid email or password (local demo auth).'
        );
        throw new Error('Invalid credentials');
      }

      const { password: _pw, ...user } = match;
      
      // Update last login time
      const updatedMatch = {
        ...match,
        lastLoginAt: new Date().toISOString(),
      };
      const updatedUsers = users.map((u) =>
        u.uid === match.uid ? updatedMatch : u
      );
      AuthService.saveUsersToStorage(updatedUsers);
      
      const updatedUser = { ...user, lastLoginAt: updatedMatch.lastLoginAt };
      this.currentUserSubject.next(updatedUser);
      AuthService.saveCurrentUserToStorage(updatedUser);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Sign the current user out and navigate to the login page.
   */
  async logout(): Promise<void> {
    this.currentUserSubject.next(null);
    AuthService.clearCurrentUserFromStorage();
    await this.router.navigate(['/login']);
  }

  /**
   * Redirect after login based on role.
   */
  async redirectAfterLogin(user: AppUser | null): Promise<void> {
    if (!user) {
      await this.router.navigate(['/login']);
      return;
    }

    if (user.role === 'admin' || user.role === 'librarian') {
      await this.router.navigate(['/dashboard']);
    } else {
      await this.router.navigate(['/catalog']);
    }
  }

  /**
   * Check whether the current user has at least one of the given roles.
   */
  hasRole(allowedRoles: UserRole[]): Observable<boolean> {
    return this.currentUser$.pipe(
      map((user) => !!user && allowedRoles.includes(user.role))
    );
  }

  /**
   * Login using QR code.
   * This is for development/demo only and is NOT secure.
   */
  async loginWithQrCode(qrCode: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const users = AuthService.loadUsersFromStorage();
      const match = users.find((u) => u.qrCode === qrCode && u.isActive !== false);

      if (!match) {
        this.errorSignal.set('Invalid QR code.');
        throw new Error('Invalid QR code');
      }

      const { password: _pw, ...user } = match;
      
      // Update last login time
      const updatedMatch = {
        ...match,
        lastLoginAt: new Date().toISOString(),
      };
      const updatedUsers = users.map((u) =>
        u.uid === match.uid ? updatedMatch : u
      );
      AuthService.saveUsersToStorage(updatedUsers);
      
      const updatedUser = { ...user, lastLoginAt: updatedMatch.lastLoginAt };
      this.currentUserSubject.next(updatedUser);
      AuthService.saveCurrentUserToStorage(updatedUser);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Create a new user account (admin only).
   * This is for development/demo only and is NOT secure.
   */
  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    studentId?: string | null;
  }): Promise<AppUser> {
    const current = this.currentUserSubject.value;
    if (!current || current.role !== 'admin') {
      this.errorSignal.set('Only administrators can create user accounts.');
      throw new Error('Unauthorized');
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const users = AuthService.loadUsersFromStorage();

      // Check if email already exists
      const emailTaken = users.some((u) => u.email === userData.email);
      if (emailTaken) {
        this.errorSignal.set('That email address is already in use.');
        throw new Error('Email already in use');
      }

      // Generate unique UID
      const uid = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Generate unique QR code
      let qrCode = AuthService.generateUniqueQrCode();
      // Ensure QR code is unique
      while (users.some((u) => u.qrCode === qrCode)) {
        qrCode = AuthService.generateUniqueQrCode();
      }

      const newUser: StoredUser = {
        uid,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        studentId: userData.studentId ?? null,
        qrCode,
        password: userData.password,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        isActive: true,
      };

      users.push(newUser);
      AuthService.saveUsersToStorage(users);

      const { password: _pw, ...appUser } = newUser;
      return appUser;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /**
   * Get all users (admin only).
   */
  getAllUsers(): Observable<AppUser[]> {
    return this.currentUser$.pipe(
      map((current) => {
        if (!current || current.role !== 'admin') {
          return [];
        }
        const users = AuthService.loadUsersFromStorage();
        return users.map(({ password: _pw, ...user }) => user);
      })
    );
  }

  /**
   * Generate a unique QR code string.
   */
  private static generateUniqueQrCode(): string {
    // Generate a unique identifier: timestamp + random string
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `LMS-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Update the currently logged-in user's profile details in local storage.
   * This is for development/demo only and is NOT secure.
   */
  async updateCurrentUser(
    changes: Partial<Pick<AppUser, 'name' | 'email' | 'studentId'>> & {
      password?: string;
    }
  ): Promise<void> {
    const current = this.currentUserSubject.value;
    if (!current) {
      return;
    }

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const users = AuthService.loadUsersFromStorage();
      const index = users.findIndex((u) => u.uid === current.uid);

      if (index === -1) {
        this.errorSignal.set('Current user could not be found.');
        throw new Error('Current user could not be found.');
      }

      // Prevent duplicate email addresses between users.
      if (changes.email && changes.email !== current.email) {
        const emailTaken = users.some(
          (u) => u.email === changes.email && u.uid !== current.uid
        );

        if (emailTaken) {
          this.errorSignal.set('That email address is already in use.');
          throw new Error('That email address is already in use.');
        }
      }

      const updatedStoredUser: StoredUser = {
        ...users[index],
        ...changes,
      };

      users[index] = updatedStoredUser;
      AuthService.saveUsersToStorage(users);

      const { password: _pw, ...updatedAppUser } = updatedStoredUser;
      this.currentUserSubject.next(updatedAppUser);
      AuthService.saveCurrentUserToStorage(updatedAppUser);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private static loadUsersFromStorage(): StoredUser[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_USERS_KEY);
      return raw ? (JSON.parse(raw) as StoredUser[]) : [];
    } catch {
      return [];
    }
  }

  private static saveUsersToStorage(users: StoredUser[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }

  private static loadCurrentUserFromStorage(): AppUser | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  }

  private static saveCurrentUserToStorage(user: AppUser): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(
      STORAGE_CURRENT_USER_KEY,
      JSON.stringify(user)
    );
  }

  private static clearCurrentUserFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  }
}

