import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CirculationService } from '../../features/circulation/circulation.service';
import Swal from 'sweetalert2';

const READY_NOTIFICATIONS_KEY = 'lms_ready_notifications';

export interface ReadyNotification {
    userId: string;
    bookTitle: string;
    reservationId: string;
}

@Injectable({ providedIn: 'root' })
export class DueDateReminderService {
    private readonly circulationService = inject(CirculationService);

    /**
     * Called after a successful login.
     * 1. Shows a Swal alert for any books due within 3 days or overdue.
     * 2. Shows Swal alerts for any waitlist reservations that are now "Ready for Pickup".
     */
    async checkReminders(userId: string): Promise<void> {
        // Small delay so the welcome toast doesn't overlap
        await new Promise((r) => setTimeout(r, 1200));

        // ── Check 1: Due date warnings ─────────────────────────────────────────
        await this.checkDueDateWarnings(userId);

        // ── Check 2: Waitlist ready notifications ──────────────────────────────
        await this.checkReadyNotifications(userId);
    }

    private async checkDueDateWarnings(userId: string): Promise<void> {
        const borrows = await firstValueFrom(
            this.circulationService.getBorrowsForUser$(userId)
        );

        const now = new Date();
        const warningThresholdMs = 3 * 24 * 60 * 60 * 1000; // 3 days

        const urgent: { title: string; daysLeft: number; overdue: boolean }[] = [];

        for (const b of borrows) {
            if (b.status !== 'borrowed' && b.status !== 'overdue') continue;

            const due = b.dueAt instanceof Date ? b.dueAt : new Date(b.dueAt as any);
            const msLeft = due.getTime() - now.getTime();
            const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

            if (daysLeft <= 3) {
                urgent.push({
                    title: b.bookTitle,
                    daysLeft,
                    overdue: daysLeft < 0,
                });
            }
        }

        if (urgent.length === 0) return;

        // Build HTML table for all urgent books
        const rows = urgent
            .map((u) => {
                const icon = u.overdue ? '🚨' : u.daysLeft <= 1 ? '⚠️' : '📅';
                const status = u.overdue
                    ? `<span style="color:#ef4444;font-weight:700">Overdue by ${Math.abs(u.daysLeft)} day(s)</span>`
                    : `<span style="color:${u.daysLeft <= 1 ? '#f59e0b' : '#6366f1'};font-weight:600">Due in ${u.daysLeft} day(s)</span>`;
                return `<tr>
          <td style="padding:6px 10px;text-align:left">${icon} <strong>${u.title}</strong></td>
          <td style="padding:6px 10px;text-align:right">${status}</td>
        </tr>`;
            })
            .join('');

        await Swal.fire({
            icon: urgent.some((u) => u.overdue) ? 'warning' : 'info',
            title: '📚 Book Due Date Reminder',
            html: `
        <p style="margin-bottom:12px;color:#6b7280">
          You have ${urgent.length} book${urgent.length > 1 ? 's' : ''} that need${urgent.length === 1 ? 's' : ''} attention:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
          ${rows}
        </table>
      `,
            confirmButtonText: 'Got it!',
            confirmButtonColor: '#4f46e5',
        });
    }

    private async checkReadyNotifications(userId: string): Promise<void> {
        const all = DueDateReminderService.loadReadyNotifications();
        const mine = all.filter((n) => n.userId === userId);

        if (mine.length === 0) return;

        // Clear the user's notifications now that they'll see them
        const remaining = all.filter((n) => n.userId !== userId);
        DueDateReminderService.saveReadyNotifications(remaining);

        for (const n of mine) {
            await Swal.fire({
                icon: 'success',
                title: '🎉 Your reserved book is ready!',
                html: `<p><strong>"${n.bookTitle}"</strong> is now <span style="color:#059669;font-weight:700">ready for pickup</span> at the library.</p>
               <p style="color:#6b7280;font-size:0.9rem;margin-top:8px">Please collect it soon before your reservation expires.</p>`,
                confirmButtonText: 'Great, thanks!',
                confirmButtonColor: '#059669',
            });
        }
    }

    /** Write a ready notification for a user (called by ReservationService). */
    static addReadyNotification(notification: ReadyNotification): void {
        const all = DueDateReminderService.loadReadyNotifications();
        all.push(notification);
        DueDateReminderService.saveReadyNotifications(all);
    }

    private static loadReadyNotifications(): ReadyNotification[] {
        if (typeof window === 'undefined') return [];
        try {
            const raw = window.localStorage.getItem(READY_NOTIFICATIONS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    private static saveReadyNotifications(items: ReadyNotification[]): void {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem(READY_NOTIFICATIONS_KEY, JSON.stringify(items));
    }
}
