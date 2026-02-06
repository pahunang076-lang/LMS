import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  collectionData,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Borrow } from '../../core/models/borrow.model';
import { EntryLog } from '../../core/models/entry-log.model';

@Injectable({
  providedIn: 'root',
})
export class ReportsService {
  private readonly firestore = inject(Firestore);

  private borrowsCollection() {
    return collection(this.firestore, 'borrows');
  }

  private entryLogsCollection() {
    return collection(this.firestore, 'entryLogs');
  }

  getBorrowsInRange$(start: Date, end: Date): Observable<Borrow[]> {
    const from = Timestamp.fromDate(start);
    const to = Timestamp.fromDate(end);
    const q = query(
      this.borrowsCollection(),
      where('borrowedAt', '>=', from),
      where('borrowedAt', '<=', to)
    );
    return collectionData(q, { idField: 'id' }) as unknown as Observable<
      Borrow[]
    >;
  }

  getEntryLogsInRange$(start: Date, end: Date): Observable<EntryLog[]> {
    const from = Timestamp.fromDate(start);
    const to = Timestamp.fromDate(end);
    const q = query(
      this.entryLogsCollection(),
      where('timeIn', '>=', from),
      where('timeIn', '<=', to)
    );
    return collectionData(q, { idField: 'id' }) as unknown as Observable<
      EntryLog[]
    >;
  }
}

