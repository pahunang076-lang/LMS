import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, map, catchError, of } from 'rxjs';
import { Reservation, ReservationStatus } from '../../core/models/reservation.model';
import { AppUser } from '../../core/models/user.model';
import { Book } from '../../core/models/book.model';
import { DueDateReminderService } from '../../core/services/due-date-reminder.service';
import { EmailNotificationService } from '../../core/services/email-notification.service';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class ReservationService {
    private readonly firestore = inject(Firestore);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly emailService = inject(EmailNotificationService);

    private reservationsCollection() {
        return collection(this.firestore, 'reservations');
    }

    getUserReservations$(userId: string): Observable<Reservation[]> {
        const q = query(this.reservationsCollection(), where('userId', '==', userId));
        return (collectionData(q, { idField: 'id' }) as unknown as Observable<Reservation[]>).pipe(
            map(all => this.calculateQueuePositions(all)),
            catchError((err) => {
                console.warn('Could not fetch user reservations:', err.message);
                return of([]);
            })
        );
    }

    getAllReservations$(): Observable<Reservation[]> {
        return (collectionData(this.reservationsCollection(), { idField: 'id' }) as unknown as Observable<Reservation[]>).pipe(
            map(all => this.calculateQueuePositions(all)),
            catchError((err) => {
                console.warn('Could not fetch all reservations:', err.message);
                return of([]);
            })
        );
    }

    async reserveBook(user: AppUser, book: Book): Promise<void> {
        if (!isPlatformBrowser(this.platformId)) return;

        const reservation = {
            userId: user.uid,
            userName: user.name || user.email,
            bookId: book.id ?? book.isbn,
            bookTitle: book.title,
            reservedAt: new Date().toISOString(),
            status: 'pending' as ReservationStatus,
        };

        try {
            await addDoc(this.reservationsCollection(), reservation);
            ReservationService.showToast('success', `"${book.title}" has been reserved!`);
        } catch (err) {
            console.error('Failed to reserve book:', err);
            ReservationService.showToast('warning', 'Could not save reservation. Please try again.');
        }
    }

    async cancelReservation(id: string): Promise<void> {
        try {
            const ref = doc(this.firestore, 'reservations', id);
            await updateDoc(ref, { status: 'cancelled' as ReservationStatus });
            ReservationService.showToast('info', 'Reservation cancelled.');
        } catch (err) {
            console.error('Failed to cancel reservation:', err);
        }
    }

    async updateStatus(id: string, status: ReservationStatus): Promise<void> {
        try {
            const ref = doc(this.firestore, 'reservations', id);
            await updateDoc(ref, { status });
            const labels: Record<ReservationStatus, string> = {
                ready: 'Reservation marked as Ready for pickup!',
                fulfilled: 'Reservation fulfilled.',
                cancelled: 'Reservation cancelled.',
                pending: 'Reservation set back to pending.',
            };
            ReservationService.showToast('success', labels[status]);
        } catch (err) {
            console.error('Failed to update reservation status:', err);
        }
    }

    async autoFulfillNextInQueue(bookId: string): Promise<void> {
        // We fetch the current snapshot from Firestore to find the next in queue
        try {
            const { getDocs, query: fsQuery, where: fsWhere, orderBy } = await import('@angular/fire/firestore');
            const q = fsQuery(
                this.reservationsCollection(),
                fsWhere('bookId', '==', bookId),
                fsWhere('status', '==', 'pending'),
                orderBy('reservedAt', 'asc')
            );
            const snap = await getDocs(q);
            if (snap.empty) return;

            const nextDoc = snap.docs[0];
            const next = { id: nextDoc.id, ...nextDoc.data() } as Reservation;

            await this.updateStatus(next.id!, 'ready');
            ReservationService.showToast('info', `Waitlist #1 for "${next.bookTitle}" has been moved to Ready for pickup.`);

            DueDateReminderService.addReadyNotification({
                userId: next.userId,
                bookTitle: next.bookTitle,
                reservationId: next.id!,
            });

            await this.emailService.sendReadyForPickup(next.userId, next.bookTitle);
        } catch (err) {
            console.warn('autoFulfillNextInQueue error:', err);
        }
    }

    private calculateQueuePositions(reservations: Reservation[]): Reservation[] {
        const pendingByBook = new Map<string, Reservation[]>();

        reservations.forEach(r => {
            if (r.status === 'pending') {
                if (!pendingByBook.has(r.bookId)) pendingByBook.set(r.bookId, []);
                pendingByBook.get(r.bookId)!.push(r);
            }
        });

        pendingByBook.forEach(list => {
            list.sort((a, b) => new Date(a.reservedAt as string).getTime() - new Date(b.reservedAt as string).getTime());
        });

        return reservations.map(r => {
            if (r.status === 'pending') {
                const list = pendingByBook.get(r.bookId)!;
                const index = list.findIndex(pending => pending.id === r.id);
                return { ...r, _queuePosition: index + 1 };
            }
            return r;
        });
    }

    private static showToast(icon: 'success' | 'warning' | 'info', title: string): void {
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true })
            .fire({ icon, title });
    }
}
