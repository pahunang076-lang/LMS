import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  query,
  where,
} from '@angular/fire/firestore';
import { map, Observable } from 'rxjs';
import { EntryLog } from '../../core/models/entry-log.model';

interface PurposeDistribution {
  [purpose: string]: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly firestore = inject(Firestore);

  private entryLogsCollection() {
    return collection(this.firestore, 'entryLogs');
  }

  private todayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      start: Timestamp.fromDate(start),
      end: Timestamp.fromDate(end),
    };
  }

  getTodayVisits$(): Observable<number> {
    const { start, end } = this.todayRange();
    const q = query(
      this.entryLogsCollection(),
      where('timeIn', '>=', start),
      where('timeIn', '<=', end)
    );
    return collectionData(q).pipe(map((logs) => logs.length));
  }

  getCurrentlyInside$(): Observable<number> {
    const q = query(
      this.entryLogsCollection(),
      where('status', '==', 'Inside')
    );
    return collectionData(q).pipe(map((logs) => logs.length));
  }

  getLastEntryTime$(): Observable<Date | null> {
    const { start, end } = this.todayRange();
    const q = query(
      this.entryLogsCollection(),
      where('timeIn', '>=', start),
      where('timeIn', '<=', end)
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) => {
        if (!items.length) {
          return null;
        }
        const sorted = items.sort(
          (a, b) =>
            (a.timeIn as Timestamp).toMillis() -
            (b.timeIn as Timestamp).toMillis()
        );
        return (sorted[sorted.length - 1].timeIn as Timestamp).toDate();
      })
    );
  }

  getTodayPurposeDistribution$(): Observable<PurposeDistribution> {
    const { start, end } = this.todayRange();
    const q = query(
      this.entryLogsCollection(),
      where('timeIn', '>=', start),
      where('timeIn', '<=', end)
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) => {
        const dist: PurposeDistribution = {};
        for (const log of items as EntryLog[]) {
          const key = log.purpose ?? 'Unknown';
          dist[key] = (dist[key] ?? 0) + 1;
        }
        return dist;
      })
    );
  }

  getTodayHourlyTraffic$(): Observable<number[]> {
    const { start, end } = this.todayRange();
    const q = query(
      this.entryLogsCollection(),
      where('timeIn', '>=', start),
      where('timeIn', '<=', end)
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((items: any[]) => {
        const hours = new Array<number>(24).fill(0);
        for (const raw of items as any[]) {
          const ts: Timestamp | undefined = raw.timeIn;
          if (!ts) continue;
          const d = ts.toDate();
          const h = d.getHours();
          hours[h] += 1;
        }
        return hours;
      })
    );
  }
}

