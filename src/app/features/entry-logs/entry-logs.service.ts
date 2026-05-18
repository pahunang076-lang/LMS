import { Injectable, inject } from '@angular/core';
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
import { Observable } from 'rxjs';
import { EntryLog, EntryStatus, VisitPurpose } from '../../core/models/entry-log.model';
import { AppUser } from '../../core/models/user.model';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class EntryLogsService {
  private readonly firestore = inject(Firestore);

  private logsCollection() {
    return collection(this.firestore, 'entryLogs');
  }

  /**
   * Users currently inside the library.
   */
  getCurrentInside$(): Observable<EntryLog[]> {
    const q = query(this.logsCollection(), where('status', '==', 'Inside'));
    return collectionData(q, { idField: 'id' }) as unknown as Observable<EntryLog[]>;
  }

  /**
   * Recent entry logs, newest first.
   */
  getRecentLogs$(max = 20): Observable<EntryLog[]> {
    const q = query(
      this.logsCollection(),
      orderBy('timeIn', 'desc'),
      limit(max)
    );
    return collectionData(q, { idField: 'id' }) as unknown as Observable<EntryLog[]>;
  }

  /**
   * All logs (used by Dashboard for aggregations).
   */
  getAllLogs$(): Observable<EntryLog[]> {
    return collectionData(this.logsCollection(), { idField: 'id' }) as unknown as Observable<EntryLog[]>;
  }

  async logEntry(user: AppUser, purpose: VisitPurpose): Promise<void> {
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
}
