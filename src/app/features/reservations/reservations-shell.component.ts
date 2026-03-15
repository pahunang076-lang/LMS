import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from './reservation.service';
import { Reservation, ReservationStatus } from '../../core/models/reservation.model';
import { map, switchMap, filter } from 'rxjs';

@Component({
    selector: 'app-reservations-shell',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterModule],
    templateUrl: './reservations-shell.component.html',
    styleUrl: './reservations-shell.component.css',
})
export class ReservationsShellComponent {
    private readonly authService = inject(AuthService);
    private readonly reservationService = inject(ReservationService);

    readonly user$ = this.authService.currentUser$;
    readonly isAdmin$ = this.user$.pipe(map((u) => u?.role === 'admin' || u?.role === 'librarian'));

    readonly myReservations$ = this.user$.pipe(
        filter((u): u is NonNullable<typeof u> => !!u),
        switchMap((u) => this.reservationService.getUserReservations$(u.uid))
    );

    readonly allReservations$ = this.reservationService.getAllReservations$();

    readonly pendingCount$ = this.allReservations$.pipe(
        map((all) => all.filter((r) => r.status === 'pending').length)
    );

    asDate(value: unknown): Date | null {
        if (!value) return null;
        const v: any = value;
        if (v.toDate instanceof Function) return v.toDate();
        if (value instanceof Date) return value;
        return new Date(v);
    }

    async cancel(r: Reservation): Promise<void> {
        if (r.id) await this.reservationService.cancelReservation(r.id);
    }

    async markReady(r: Reservation): Promise<void> {
        if (r.id) await this.reservationService.updateStatus(r.id, 'ready');
    }

    async markFulfilled(r: Reservation): Promise<void> {
        if (r.id) await this.reservationService.updateStatus(r.id, 'fulfilled');
    }

    statusLabel(s: ReservationStatus): string {
        return { pending: 'Pending', ready: 'Ready for Pickup', cancelled: 'Cancelled', fulfilled: 'Completed' }[s] ?? s;
    }
}
