import { Injectable, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AppUser, UserRole } from '../models/user.model';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { DueDateReminderService } from './due-date-reminder.service';
import Swal from 'sweetalert2';

// Firebase Auth
import { Auth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, updateEmail, updateProfile, User as FirebaseUser } from '@angular/fire/auth';

// Firestore
import { Firestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, collectionData } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';

// ─── Storage key (session-only for QR logins) ────────────────────────────────
const SESSION_CURRENT_USER_KEY = 'lms_current_user';

// ─── Firestore user profile (what we store in /users/{uid}) ──────────────────
export interface FirestoreUserProfile {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  studentId: string | null;
  qrCode: string;
  createdAt: string;
  lastLoginAt: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly reminderService = inject(DueDateReminderService);

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

  triggerStateRefresh(): void {
    const current = this.currentUserSubject.value;
    if (current) {
      this.currentUserSubject.next({ ...current });
    }
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Listen to Firebase Auth state changes for session persistence
      onAuthStateChanged(this.auth, async (firebaseUser) => {
        if (firebaseUser) {
          // User is signed in — load their Firestore profile
          const profile = await this.loadProfileFromFirestore(firebaseUser.uid);
          if (profile) {
            const appUser = this.profileToAppUser(profile);
            this.currentUserSubject.next(appUser);
            AuthService.saveCurrentUserToStorage(appUser);
          }
        } else {
          // Only clear if we don't have a QR-based session
          // (QR logins populate the Subject without a Firebase Auth session)
          const stored = AuthService.loadCurrentUserFromStorage();
          if (!stored) {
            this.currentUserSubject.next(null);
          }
        }
      });
    }
  }

  // ─── Error helpers ──────────────────────────────────────────────────────────

  clearError(): void {
    this.errorSignal.set(null);
  }

  // ─── Login ──────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      const profile = await this.loadProfileFromFirestore(credential.user.uid);

      if (!profile) {
        this.errorSignal.set('User profile not found. Please contact an administrator.');
        await signOut(this.auth);
        throw new Error('Profile not found');
      }

      if (profile.isActive === false) {
        this.errorSignal.set('Your account has been deactivated.');
        await signOut(this.auth);
        throw new Error('Account deactivated');
      }

      // Update last login
      await this.updateLastLogin(profile.uid);
      profile.lastLoginAt = new Date().toISOString();

      const appUser = this.profileToAppUser(profile);
      this.currentUserSubject.next(appUser);
      AuthService.saveCurrentUserToStorage(appUser);

      this.showToast('success', `Welcome back, ${appUser.name}!`);
      this.reminderService.checkReminders(appUser.uid);
    } catch (err: unknown) {
      if (!this.errorSignal()) {
        this.errorSignal.set(this.mapFirebaseError(err));
      }
      throw err;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    const userName = this.currentUserSubject.value?.name;
    this.currentUserSubject.next(null);
    AuthService.clearCurrentUserFromStorage();

    // Sign out from Firebase if there is an active session
    try {
      await signOut(this.auth);
    } catch {
      // No Firebase session (e.g., QR login) – that's fine
    }

    this.showToast('info', userName ? `Goodbye, ${userName}!` : 'Logged out successfully.');
    await this.router.navigate(['/login']);
  }

  // ─── Redirect after login ───────────────────────────────────────────────────

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

  // ─── Role check ─────────────────────────────────────────────────────────────

  hasRole(allowedRoles: UserRole[]): Observable<boolean> {
    return this.currentUser$.pipe(
      map((user) => !!user && allowedRoles.includes(user.role))
    );
  }

  // ─── Password reset (Firebase sends the real email) ─────────────────────────

  async resetPassword(email: string): Promise<void> {
    if (!email) {
      await Swal.fire({
        icon: 'error',
        title: 'Email required',
        text: 'Please enter your email address.',
        confirmButtonColor: '#4f46e5',
        color: '#111827',
        background: '#ffffff',
      });
      return;
    }

    this.loadingSignal.set(true);
    try {
      await sendPasswordResetEmail(this.auth, email);
      await Swal.fire({
        icon: 'success',
        title: 'Reset email sent!',
        text: `Check your inbox at ${email} for a password reset link.`,
        confirmButtonColor: '#4f46e5',
        color: '#111827',
        background: '#ffffff',
        timer: 4000,
        timerProgressBar: true,
      });
    } catch (err: unknown) {
      await Swal.fire({
        icon: 'error',
        title: 'Could not send email',
        text: this.mapFirebaseError(err),
        confirmButtonColor: '#4f46e5',
        color: '#111827',
        background: '#ffffff',
      });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ─── QR code login ──────────────────────────────────────────────────────────

  async loginWithQrCode(qrCode: string): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      // Query Firestore for a user with this QR code
      const usersCol = collection(this.firestore, 'users');
      const q = query(usersCol, where('qrCode', '==', qrCode), where('isActive', '==', true));
      const snap = await getDocs(q);

      if (snap.empty) {
        this.errorSignal.set('Invalid QR code. Please try again.');
        throw new Error('Invalid QR code');
      }

      const profile = snap.docs[0].data() as FirestoreUserProfile;

      // Update last login
      await this.updateLastLogin(profile.uid);
      profile.lastLoginAt = new Date().toISOString();

      const appUser = this.profileToAppUser(profile);
      // Populate the session (without a full Firebase Auth session — demo only)
      this.currentUserSubject.next(appUser);
      AuthService.saveCurrentUserToStorage(appUser);

      this.showToast('success', `Welcome back, ${appUser.name}!`);
      this.reminderService.checkReminders(appUser.uid);
    } catch (err: unknown) {
      if (!this.errorSignal()) {
        this.errorSignal.set('QR login failed. Please try again.');
      }
      throw err;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ─── Create user (admin only) ───────────────────────────────────────────────

  async createUser(userData: {
    name: string;
    email: string;
    password: string;
    phoneNumber: string;
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
      // Create Firebase Auth account.
      // NOTE: This will sign in as the new user in the Firebase Auth SDK.
      // We immediately re-sign-in the admin below.
      const credential = await createUserWithEmailAndPassword(
        this.auth,
        userData.email,
        userData.password
      );

      const uid = credential.user.uid;

      // Update Firebase display name
      await updateProfile(credential.user, { displayName: userData.name });

      // Generate a unique QR code
      const qrCode = AuthService.generateUniqueQrCode();

      const profile: FirestoreUserProfile = {
        uid,
        name: userData.name,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        studentId: userData.studentId ?? null,
        qrCode,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        isActive: true,
      };

      // Write profile to Firestore
      const userDocRef = doc(this.firestore, 'users', uid);
      await setDoc(userDocRef, profile);

      // Re-sign-in the admin so current session is restored
      // (createUserWithEmailAndPassword switches the auth state)
      // We can't re-sign-in silently, so we restore from our BehaviorSubject.
      // The onAuthStateChanged handler will fire with the new user UID; we override it.
      this.currentUserSubject.next(current);
      AuthService.saveCurrentUserToStorage(current);

      const appUser: AppUser = this.profileToAppUser(profile);

      // Send Email Notification via EmailJS
      try {
        const emailjs = await import('@emailjs/browser');
        // NOTE: Replace these with your actual Service ID, Template ID, and Public Key from emailjs.com
        await emailjs.send(
          'service_w34wlrc',
          'template_twe94sn',
          {
            to_name: userData.name,
            to_email: userData.email,
            password: userData.password,
            role: userData.role
          },
          {
            publicKey: 'KribdKzb-OxrM25yI',
          }
        );
        console.log('Welcome email sent successfully!');
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
        // We don't throw the error so the account creation still succeeds
      }

      return appUser;
    } catch (err: unknown) {
      if (!this.errorSignal()) {
        this.errorSignal.set(this.mapFirebaseError(err));
      }
      throw new Error(this.mapFirebaseError(err));
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ─── Get all users (admin only) ─────────────────────────────────────────────

  getAllUsers(): Observable<AppUser[]> {
    const usersCol = collection(this.firestore, 'users');
    return (collectionData(usersCol, { idField: 'uid' }) as Observable<FirestoreUserProfile[]>).pipe(
      map((profiles) => {
        const current = this.currentUserSubject.value;
        if (!current || current.role !== 'admin') return [];
        return profiles.map((p) => this.profileToAppUser(p));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  // ─── Update current user's profile ──────────────────────────────────────────

  async updateCurrentUser(
    changes: Partial<Pick<AppUser, 'name' | 'email' | 'studentId'>> & {
      password?: string;
    }
  ): Promise<void> {
    const current = this.currentUserSubject.value;
    if (!current) return;

    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const userDocRef = doc(this.firestore, 'users', current.uid);

      // Build Firestore update payload
      const firestoreChanges: Partial<FirestoreUserProfile> = {};
      if (changes.name !== undefined) firestoreChanges.name = changes.name;
      if (changes.email !== undefined) firestoreChanges.email = changes.email;
      if (changes.studentId !== undefined) firestoreChanges.studentId = changes.studentId ?? null;

      await updateDoc(userDocRef, firestoreChanges as Record<string, unknown>);

      // Update Firebase Auth profile if we have an active session
      const firebaseUser: FirebaseUser | null = this.auth.currentUser;
      if (firebaseUser) {
        if (changes.name) {
          await updateProfile(firebaseUser, { displayName: changes.name });
        }
        if (changes.email && changes.email !== current.email) {
          await updateEmail(firebaseUser, changes.email);
        }
      }

      const updatedUser: AppUser = {
        ...current,
        ...changes,
        studentId: changes.studentId ?? current.studentId,
      };

      this.currentUserSubject.next(updatedUser);
      AuthService.saveCurrentUserToStorage(updatedUser);
    } catch (err: unknown) {
      const msg = this.mapFirebaseError(err);
      this.errorSignal.set(msg);
      throw new Error(msg);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async loadProfileFromFirestore(uid: string): Promise<FirestoreUserProfile | null> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      const snap = await getDoc(userDocRef);
      return snap.exists() ? (snap.data() as FirestoreUserProfile) : null;
    } catch {
      return null;
    }
  }

  private async updateLastLogin(uid: string): Promise<void> {
    try {
      const userDocRef = doc(this.firestore, 'users', uid);
      await updateDoc(userDocRef, { lastLoginAt: new Date().toISOString() });
    } catch {
      // Non-critical
    }
  }

  private profileToAppUser(profile: FirestoreUserProfile): AppUser {
    return {
      uid: profile.uid,
      name: profile.name,
      email: profile.email,
      phoneNumber: profile.phoneNumber || '',
      role: profile.role,
      studentId: profile.studentId,
      qrCode: profile.qrCode,
      createdAt: profile.createdAt,
      lastLoginAt: profile.lastLoginAt,
      isActive: profile.isActive,
    };
  }

  private mapFirebaseError(err: unknown): string {
    const code = (err as { code?: string })?.code ?? '';
    const map: Record<string, string> = {
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/wrong-password': 'Invalid email or password.',
      'auth/user-not-found': 'No account found with this email address.',
      'auth/email-already-in-use': 'That email address is already in use.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/requires-recent-login': 'Please log out and log back in to make this change.',
      'auth/network-request-failed': 'Network error. Check your internet connection.',
    };
    return map[code] ?? (err as Error)?.message ?? 'An unexpected error occurred.';
  }

  private showToast(icon: 'success' | 'info' | 'error', title: string): void {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
    Toast.fire({ icon, title });
  }

  private static generateUniqueQrCode(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `LMS-${timestamp}-${random}`.toUpperCase();
  }

  private static loadCurrentUserFromStorage(): AppUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(SESSION_CURRENT_USER_KEY);
      return raw ? (JSON.parse(raw) as AppUser) : null;
    } catch {
      return null;
    }
  }

  private static saveCurrentUserToStorage(user: AppUser): void {
    if (typeof window === 'undefined') return;
    // Use sessionStorage so QR sessions don't persist across tabs/restarts
    window.sessionStorage.setItem(SESSION_CURRENT_USER_KEY, JSON.stringify(user));
  }

  private static clearCurrentUserFromStorage(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(SESSION_CURRENT_USER_KEY);
    // Also clean up any old localStorage key from previous versions
    window.localStorage.removeItem('lms_current_user');
    window.localStorage.removeItem('lms_users');
  }
}
