import { Injectable, inject } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { CirculationService } from '../../features/circulation/circulation.service';
import { ReservationService } from '../../features/reservations/reservation.service';
import { AuthService } from './auth.service';
import { BookRequestService } from '../../features/book-requests/book-request.service';

export interface AppNotification {
    id: string;
    type: 'overdue' | 'due-soon' | 'reservation-ready' | 'book-request';
    message: string;
    userId?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private readonly auth = inject(AuthService);
    private readonly circulation = inject(CirculationService);
    private readonly reservations = inject(ReservationService);
    private readonly bookRequests = inject(BookRequestService);

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

            // Filter borrows relevant to current user (students see own, admins see all)
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
                    });
                } else if (due && due.getTime() - now.getTime() <= twoDaysMs && due > now) {
                    alerts.push({
                        id: `due-soon-${b.id}`,
                        type: 'due-soon',
                        message: isAdminOrLibrarian
                            ? `Due soon: "${b.bookTitle}" (due ${due.toLocaleDateString()})`
                            : `Due soon: "${b.bookTitle}" is due on ${due.toLocaleDateString()}`,
                        userId: b.userId,
                    });
                }
            }

            // Reservation-ready alerts
            const myReservations = isAdminOrLibrarian
                ? reservations.filter((r) => r.status === 'ready')
                : reservations.filter((r) => r.userId === user?.uid && r.status === 'ready');

            for (const r of myReservations) {
                alerts.push({
                    id: `res-ready-${r.id}`,
                    type: 'reservation-ready',
                    message: isAdminOrLibrarian
                        ? `Reservation ready: "${r.bookTitle}" for ${r.userName}`
                        : `Your reservation for "${r.bookTitle}" is ready for pickup!`,
                    userId: r.userId,
                });
            }

            // Book request alerts
            if (isAdminOrLibrarian) {
                const pendingRequests = requests.filter((r) => r.status === 'pending');
                for (const req of pendingRequests) {
                    alerts.push({
                        id: `book-req-${req.id}`,
                        type: 'book-request',
                        message: `New book request from ${req.userName}: "${req.title}"`,
                        userId: req.userId,
                    });
                }
            }

            return alerts;
        })
    );
}
