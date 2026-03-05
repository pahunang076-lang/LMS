import { Injectable, inject } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { CirculationService } from '../../features/circulation/circulation.service';
import { ReservationService } from '../../features/reservations/reservation.service';
import { AuthService } from './auth.service';
import { BookRequestService } from '../../features/book-requests/book-request.service';

export interface AppNotification {
    id: string;
    type: 'overdue' | 'due-soon' | 'reservation-ready' | 'reservation-new' | 'book-request';
    message: string;
    userId?: string;
    link: string; // route to navigate when clicked
    isRead?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private readonly auth = inject(AuthService);
    private readonly circulation = inject(CirculationService);
    private readonly reservations = inject(ReservationService);
    private readonly bookRequests = inject(BookRequestService);

    // Track dismissed notification IDs in local storage
    private get dismissedIds(): string[] {
        if (typeof window === 'undefined') return [];
        try {
            const stored = window.localStorage.getItem('lms_dismissed_notifications');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    private addDismissedId(id: string): void {
        if (typeof window === 'undefined') return;
        const current = this.dismissedIds;
        if (!current.includes(id)) {
            current.push(id);
            // Keep array from growing infinitely (store max 100 recent dismissals)
            if (current.length > 100) current.shift();
            window.localStorage.setItem('lms_dismissed_notifications', JSON.stringify(current));
        }
    }

    readonly notifications$: Observable<AppNotification[]> = combineLatest([
        this.auth.currentUser$,
        this.circulation.getAllBorrows$(),
        this.reservations.getAllReservations$(),
        this.bookRequests.getAll$(),
    ]).pipe(
        map(([user, borrows, reservations, requests]) => {
            const alerts: AppNotification[] = [];
            const now = new Date();
            const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

            const isAdminOrLibrarian = user?.role === 'admin' || user?.role === 'librarian';

            // ── Borrow alerts ────────────────────────────────────────────────
            const relevantBorrows = isAdminOrLibrarian
                ? borrows
                : borrows.filter((b) => b.userId === user?.uid);

            for (const b of relevantBorrows) {
                if (b.status === 'returned' || b.finePaid) continue;

                const due = b.dueAt ? new Date(b.dueAt as any) : null;

                if (b.status === 'overdue') {
                    alerts.push({
                        id: `overdue-${b.id}`,
                        type: 'overdue',
                        message: isAdminOrLibrarian
                            ? `Overdue: "${b.bookTitle}" borrowed by ${b.userId}`
                            : `Overdue: "${b.bookTitle}" – ₱${b.fineAmount} fine`,
                        userId: b.userId,
                        link: '/circulation',
                    });
                } else if (due && due.getTime() - now.getTime() <= twoDaysMs && due > now) {
                    alerts.push({
                        id: `due-soon-${b.id}`,
                        type: 'due-soon',
                        message: isAdminOrLibrarian
                            ? `Due soon: "${b.bookTitle}" (due ${due.toLocaleDateString()})`
                            : `Due soon: "${b.bookTitle}" is due on ${due.toLocaleDateString()}`,
                        userId: b.userId,
                        link: '/circulation',
                    });
                }
            }

            // ── Reservation alerts ───────────────────────────────────────────
            if (isAdminOrLibrarian) {
                // Notify librarian about every PENDING reservation (new reservations from students)
                const pendingReservations = reservations.filter((r) => r.status === 'pending');
                for (const r of pendingReservations) {
                    alerts.push({
                        id: `res-pending-${r.id}`,
                        type: 'reservation-new',
                        message: `New reservation: "${r.bookTitle}" by ${r.userName}`,
                        userId: r.userId,
                        link: '/reservations',
                    });
                }

                // Notify librarian about ready reservations too
                const readyReservations = reservations.filter((r) => r.status === 'ready');
                for (const r of readyReservations) {
                    alerts.push({
                        id: `res-ready-${r.id}`,
                        type: 'reservation-ready',
                        message: `Ready for pickup: "${r.bookTitle}" for ${r.userName}`,
                        userId: r.userId,
                        link: '/reservations',
                    });
                }
            } else {
                // Student: show only their own ready reservations
                const myReady = reservations.filter(
                    (r) => r.userId === user?.uid && r.status === 'ready'
                );
                for (const r of myReady) {
                    alerts.push({
                        id: `res-ready-${r.id}`,
                        type: 'reservation-ready',
                        message: `Your reservation for "${r.bookTitle}" is ready for pickup!`,
                        userId: r.userId,
                        link: '/reservations',
                    });
                }
            }

            // ── Book request alerts (admin/librarian only) ───────────────────
            if (isAdminOrLibrarian) {
                const pendingRequests = requests.filter((r) => r.status === 'pending');
                for (const req of pendingRequests) {
                    alerts.push({
                        id: `book-req-${req.id}`,
                        type: 'book-request',
                        message: `New book request from ${req.userName}: "${req.title}"`,
                        userId: req.userId,
                        link: '/book-requests',
                    });
                }
            }

            // Filter out notifications that the user has already dismissed/read
            const dismissed = this.dismissedIds;
            return alerts.filter(a => !dismissed.includes(a.id));
        })
    );

    markAsRead(id: string): void {
        this.addDismissedId(id);
        // We force an emission on the auth subject just to trigger a re-evaluation
        // of the combineLatest stream above, so the notification immediately disappears.
        this.auth.triggerStateRefresh();
    }
}
