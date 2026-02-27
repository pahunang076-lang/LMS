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
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { EntryLog, EntryStatus, VisitPurpose } from '../../core/models/entry-log.model';
import { AppUser } from '../../core/models/user.model';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

const JSON_SERVER_URL = 'http://localhost:3000';

@Injectable({
  providedIn: 'root',
})
export class EntryLogsService {
  private readonly firestore = inject(Firestore);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly storageKey = 'lms_entry_logs';
  private readonly useLocalStore =
    typeof window !== 'undefined' && EntryLogsService.isFirebasePlaceholderConfig();

  private readonly localLogsSubject = new BehaviorSubject<EntryLog[]>(
    this.useLocalStore ? this.loadLocalLogs() : []
  );

  constructor() {
    // On startup, sync entry logs from JSON Server into localStorage
    if (this.useLocalStore && isPlatformBrowser(this.platformId)) {
      this.syncLogsFromServer();
    }
  }

  private syncLogsFromServer(): void {
    this.http.get<EntryLog[]>(`${JSON_SERVER_URL}/entryLogs`).subscribe({
      next: (logs) => {
        if (logs && logs.length > 0) {
          this.persistLocalLogs(logs);
          this.localLogsSubject.next(logs);
        }
      },
      error: () => {
        console.warn('JSON Server not available for entry logs. Using local storage data.');
      },
    });
  }

  private logsCollection() {
    return collection(this.firestore, 'entryLogs');
  }

  /**
   * Users currently inside the library.
   */
  getCurrentInside$(): Observable<EntryLog[]> {
    if (this.useLocalStore) {
      return new Observable((observer) => {
        this.localLogsSubject.subscribe((logs) => {
          observer.next(logs.filter((l) => l.status === 'Inside'));
        });
      });
    }

    const q = query(this.logsCollection(), where('status', '==', 'Inside'));
    return collectionData(q, { idField: 'id' }) as unknown as Observable<EntryLog[]>;
  }

  /**
   * Recent entry logs, newest first.
   */
  getRecentLogs$(max = 20): Observable<EntryLog[]> {
    if (this.useLocalStore) {
      return new Observable((observer) => {
        this.localLogsSubject.subscribe((logs) => {
          const sorted = [...logs].sort((a, b) => {
            const tA = new Date(a.timeIn as string).getTime();
            const tB = new Date(b.timeIn as string).getTime();
            return tB - tA;
          });
          observer.next(sorted.slice(0, max));
        });
      });
    }

    const q = query(
      this.logsCollection(),
      orderBy('timeIn', 'desc'),
      limit(max)
    );
    return collectionData(q, { idField: 'id' }) as unknown as Observable<EntryLog[]>;
  }

  async logEntry(user: AppUser, purpose: VisitPurpose): Promise<void> {
    if (this.useLocalStore) {
      const now = new Date().toISOString();
      const id = EntryLogsService.generateId('log');
      const newLog: EntryLog = {
        id,
        userId: user.uid,
        studentId: user.studentId ?? null,
        name: user.name || user.email,
        purpose,
        timeIn: now,
        timeOut: null,
        durationMinutes: undefined,
        status: 'Inside' as EntryStatus,
        forcedCheckout: false,
      };

      const updated = [...this.localLogsSubject.value, newLog];
      this.persistLocalLogs(updated);
      this.localLogsSubject.next(updated);

      // Sync to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        this.http.post(`${JSON_SERVER_URL}/entryLogs`, newLog)
          .subscribe({ error: () => { } });
      }

      EntryLogsService.showToast('success', `${user.name} has entered the library.`);
      return;
    }

    const now = Timestamp.now();
    await addDoc(this.logsCollection(), {
      userId: user.uid,
      studentId: user.studentId ?? null,
      name: user.name || user.email,
      purpose,
      timeIn: now,
      timeOut: null,
      durationMinutes: null,
      status: 'Inside' as EntryStatus,
      forcedCheckout: false,
    });
    EntryLogsService.showToast('success', `${user.name} has entered the library.`);
  }

  async logExit(userId: string): Promise<void> {
    if (this.useLocalStore) {
      const now = new Date();
      const logsToUpdate: EntryLog[] = [];
      const updated = this.localLogsSubject.value.map((log) => {
        if (log.userId !== userId || log.status !== 'Inside') {
          return log;
        }
        const timeIn = new Date(log.timeIn as string);
        const diffMs = now.getTime() - timeIn.getTime();
        const durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        const modified = {
          ...log,
          timeOut: now.toISOString(),
          durationMinutes,
          status: 'Left' as EntryStatus,
        };
        logsToUpdate.push(modified);
        return modified;
      });

      this.persistLocalLogs(updated);
      this.localLogsSubject.next(updated);

      // Sync exits to JSON Server (best-effort)
      if (isPlatformBrowser(this.platformId)) {
        logsToUpdate.forEach((log) => {
          this.http.patch(`${JSON_SERVER_URL}/entryLogs/${log.id}`, {
            timeOut: log.timeOut,
            durationMinutes: log.durationMinutes,
            status: 'Left',
          }).subscribe({ error: () => { } });
        });
      }

      EntryLogsService.showToast('info', 'Exit logged successfully.');
      return;
    }

    const q = query(
      this.logsCollection(),
      where('userId', '==', userId),
      where('status', '==', 'Inside')
    );
    const snapshot = await getDocs(q);

    const now = Timestamp.now();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as any;
      const timeIn =
        data.timeIn instanceof Timestamp
          ? data.timeIn.toDate()
          : new Date(data.timeIn);
      const diffMs = now.toDate().getTime() - timeIn.getTime();
      const durationMinutes = Math.max(
        0,
        Math.round(diffMs / (1000 * 60))
      );

      await updateDoc(docSnap.ref, {
        timeOut: now,
        durationMinutes,
        status: 'Left' as EntryStatus,
      });
    }
    EntryLogsService.showToast('info', 'Exit logged successfully.');
  }

  async forceCheckout(log: EntryLog): Promise<void> {
    if (!log.id) {
      return;
    }

    // Confirm before forcing checkout
    const result = await Swal.fire({
      title: 'Force Checkout?',
      text: `This will mark ${log.name} as having left the library.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, force checkout',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) {
      return;
    }

    if (this.useLocalStore) {
      const now = new Date();
      const updated = this.localLogsSubject.value.map((l) => {
        if (l.id !== log.id) return l;
        const timeIn = new Date(l.timeIn as string);
        const diffMs = now.getTime() - timeIn.getTime();
        const durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        return {
          ...l,
          timeOut: now.toISOString(),
          durationMinutes,
          status: 'Left' as EntryStatus,
          forcedCheckout: true,
        };
      });

      this.persistLocalLogs(updated);
      this.localLogsSubject.next(updated);

      // Sync to JSON Server (best-effort)
      const updatedLog = updated.find((l) => l.id === log.id);
      if (updatedLog && isPlatformBrowser(this.platformId)) {
        this.http.patch(`${JSON_SERVER_URL}/entryLogs/${log.id}`, {
          timeOut: updatedLog.timeOut,
          durationMinutes: updatedLog.durationMinutes,
          status: 'Left',
          forcedCheckout: true,
        }).subscribe({ error: () => { } });
      }

      EntryLogsService.showToast('warning', `${log.name} has been force checked out.`);
      return;
    }

    const ref = doc(this.firestore, 'entryLogs', log.id);
    const now = Timestamp.now();

    let durationMinutes = log.durationMinutes ?? null;

    if (!log.timeOut && log.timeIn) {
      const timeIn =
        log.timeIn instanceof Timestamp
          ? log.timeIn.toDate()
          : new Date(log.timeIn as any);
      const diffMs = now.toDate().getTime() - timeIn.getTime();
      durationMinutes = Math.max(
        0,
        Math.round(diffMs / (1000 * 60))
      );
    }

    await updateDoc(ref, {
      timeOut: now,
      durationMinutes,
      status: 'Left' as EntryStatus,
      forcedCheckout: true,
    });
    EntryLogsService.showToast('warning', `${log.name} has been force checked out.`);
  }

  private static showToast(icon: 'success' | 'error' | 'warning' | 'info', title: string): void {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
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

  private loadLocalLogs(): EntryLog[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as EntryLog[]) : [];
    } catch {
      return [];
    }
  }

  private persistLocalLogs(logs: EntryLog[]): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(this.storageKey, JSON.stringify(logs));
  }
}
