import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CirculationService } from '../circulation/circulation.service';
import { ReservationService } from '../reservations/reservation.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { map, switchMap, combineLatest } from 'rxjs';

@Component({
    selector: 'app-student-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './student-dashboard.component.html',
    styleUrl: './student-dashboard.component.css'
})
export class StudentDashboardComponent {
    private readonly auth = inject(AuthService);
    private readonly circulation = inject(CirculationService);
    private readonly reservations = inject(ReservationService);
    private readonly announcementsService = inject(AnnouncementService);

    readonly user$ = this.auth.currentUser$;

    readonly latestAnnouncement$ = this.announcementsService.announcements$.pipe(
        map(list => list.length > 0 ? list[0] : null)
    );

    readonly myActiveBorrows$ = this.user$.pipe(
        switchMap(u => this.circulation.getAllBorrows$().pipe(
            map(borrows => borrows.filter(b => b.userId === u?.uid && (b.status === 'borrowed' || b.status === 'overdue')))
        ))
    );

    readonly myPendingRequests$ = this.user$.pipe(
        switchMap(u => this.reservations.getAllReservations$().pipe(
            map(res => res.filter(r => r.userId === u?.uid && (r.status === 'pending' || r.status === 'ready')))
        ))
    );

    readonly dashboardData$ = combineLatest([
        this.user$,
        this.latestAnnouncement$,
        this.myActiveBorrows$,
        this.myPendingRequests$
    ]).pipe(
        map(([user, announcement, borrows, requests]) => ({ user, announcement, borrows, requests }))
    );

    dueCountdown(dueAt: unknown): string {
        if (!dueAt) return '';
        const due = dueAt instanceof Date ? dueAt : new Date(dueAt as any);
        const now = new Date();
        const diffMs = due.getTime() - now.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 1) return `in ${diffDays} days`;
        if (diffDays === 1) return 'tomorrow';
        if (diffDays === 0) return 'today';
        return `overdue by ${Math.abs(diffDays)}d`;
    }
}
