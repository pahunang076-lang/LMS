import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';
import { BookRequest, BookRequestStatus } from '../../core/models/book-request.model';

@Injectable({ providedIn: 'root' })
export class BookRequestService {
    private readonly firestore = inject(Firestore);

    private requestsCollection() {
        return collection(this.firestore, 'bookRequests');
    }

    getAll$(): Observable<BookRequest[]> {
        return (collectionData(this.requestsCollection(), { idField: 'id' }) as unknown as Observable<BookRequest[]>).pipe(
            catchError((err) => {
                console.warn('Could not fetch book requests:', err.message);
                return of([]);
            })
        );
    }

    getForUser$(userId: string): Observable<BookRequest[]> {
        const q = query(this.requestsCollection(), where('userId', '==', userId));
        return (collectionData(q, { idField: 'id' }) as unknown as Observable<BookRequest[]>).pipe(
            catchError((err) => {
                console.warn('Could not fetch user book requests:', err.message);
                return of([]);
            })
        );
    }

    async create(req: Omit<BookRequest, 'id'>): Promise<void> {
        try {
            await addDoc(this.requestsCollection(), req);
        } catch (err) {
            console.error('Failed to create book request:', err);
            throw err;
        }
    }

    async updateStatus(req: BookRequest, status: BookRequestStatus, adminNote?: string): Promise<void> {
        if (!req.id) return;
        const resolvedAt = new Date().toISOString();
        try {
            const ref = doc(this.firestore, 'bookRequests', req.id);
            await updateDoc(ref, {
                status,
                resolvedAt,
                ...(adminNote !== undefined ? { adminNote } : {}),
            });
        } catch (err) {
            console.error('Failed to update book request status:', err);
            throw err;
        }
    }
}
