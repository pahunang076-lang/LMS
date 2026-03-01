import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Reservation, ReservationStatus } from '../../core/models/reservation.model';
import { AppUser } from '../../core/models/user.model';
import { Book } from '../../core/models/book.model';
import Swal from 'sweetalert2';

const JSON_SERVER_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class ReservationService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);
    private readonly storageKey = 'lms_reservations';

    private readonly localSubject = new BehaviorSubject<Reservation[]>(this.load());

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.http.get<Reservation[]>(`${JSON_SERVER_URL}/reservations`).subscribe({
                next: (items) => {
                    if (items?.length) { this.persist(items); this.localSubject.next(items); }
                },
                error: () => { }
            });
        }
    }

    getUserReservations$(userId: string): Observable<Reservation[]> {
        return this.localSubject.pipe(
            map(all => this.calculateQueuePositions(all).filter((r) => r.userId === userId))
        );
    }

    getAllReservations$(): Observable<Reservation[]> {
        return this.localSubject.pipe(map(all => this.calculateQueuePositions(all)));
    }

    async reserveBook(user: AppUser, book: Book): Promise<void> {
        const existing = this.localSubject.value.find(
            (r) => r.userId === user.uid && r.bookId === (book.id ?? book.isbn) &&
                (r.status === 'pending' || r.status === 'ready')
        );
        if (existing) {
            ReservationService.showToast('warning', 'You already have a pending reservation for this book.');
            return;
        }

        const id = ReservationService.genId();
        const reservation: Reservation = {
            id,
            userId: user.uid,
            userName: user.name || user.email,
            bookId: book.id ?? book.isbn,
            bookTitle: book.title,
            reservedAt: new Date().toISOString(),
            status: 'pending',
        };

        const updated = [...this.localSubject.value, reservation];
        this.persist(updated);
        this.localSubject.next(updated);

        if (isPlatformBrowser(this.platformId)) {
            this.http.post(`${JSON_SERVER_URL}/reservations`, reservation).subscribe({ error: () => { } });
        }
        ReservationService.showToast('success', `"${book.title}" has been reserved!`);
    }

    async cancelReservation(id: string): Promise<void> {
        const updated = this.localSubject.value.map((r) =>
            r.id === id ? { ...r, status: 'cancelled' as ReservationStatus } : r
        );
        this.persist(updated);
        this.localSubject.next(updated);

        if (isPlatformBrowser(this.platformId)) {
            this.http.patch(`${JSON_SERVER_URL}/reservations/${id}`, { status: 'cancelled' }).subscribe({ error: () => { } });
        }
        ReservationService.showToast('info', 'Reservation cancelled.');
    }

    async updateStatus(id: string, status: ReservationStatus): Promise<void> {
        const updated = this.localSubject.value.map((r) =>
            r.id === id ? { ...r, status } : r
        );
        this.persist(updated);
        this.localSubject.next(updated);

        if (isPlatformBrowser(this.platformId)) {
            this.http.patch(`${JSON_SERVER_URL}/reservations/${id}`, { status }).subscribe({ error: () => { } });
        }
        const labels: Record<ReservationStatus, string> = {
            ready: 'Reservation marked as Ready for pickup!',
            fulfilled: 'Reservation fulfilled.',
            cancelled: 'Reservation cancelled.',
            pending: 'Reservation set back to pending.',
        };
        ReservationService.showToast('success', labels[status]);
    }

    async autoFulfillNextInQueue(bookId: string): Promise<void> {
        const allPending = this.calculateQueuePositions(this.localSubject.value)
            .filter(r => r.bookId === bookId && r.status === 'pending');

        if (allPending.length === 0) return;

        const nextInLine = allPending.find(r => r._queuePosition === 1);
        if (nextInLine && nextInLine.id) {
            await this.updateStatus(nextInLine.id, 'ready');
            ReservationService.showToast('info', `Waitlist #1 for "${nextInLine.bookTitle}" has been moved to Ready for pickup.`);
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

    private static genId(): string {
        return `res-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    private load(): Reservation[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    private persist(items: Reservation[]): void {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(this.storageKey, JSON.stringify(items));
    }
}
