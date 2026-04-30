import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CirculationService } from '../circulation/circulation.service';
import { EntryLogsService } from '../entry-logs/entry-logs.service';
import { AppUser } from '../../core/models/user.model';
import { Borrow } from '../../core/models/borrow.model';
import { EntryLog } from '../../core/models/entry-log.model';
import { combineLatest, map, take, catchError, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-student-profile',
    standalone: true,
    imports: [CommonModule],
    template: `
    @if (vm$ | async; as vm) {
      <section class="profile-root">
        <header class="profile-header">
          <button class="btn-back" (click)="goBack()">← Back</button>
          <div class="avatar">{{ getInitials(vm.user?.name ?? '') }}</div>
          <div class="profile-info">
            <h1>{{ vm.user?.name }}</h1>
            <p class="role-tag">{{ vm.user?.role | titlecase }}</p>
            <p class="email">{{ vm.user?.email }}</p>
            @if (vm.user?.studentId) {
              <p class="student-id">ID: {{ vm.user?.studentId }}</p>
            }
          </div>
        </header>
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-num">{{ vm.activeBorrows.length }}</span>
            <span class="stat-label">Active Borrows</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ vm.totalBorrows }}</span>
            <span class="stat-label">Total Borrows</span>
          </div>
          <div class="stat-card fine-card">
            <span class="stat-num">₱{{ vm.totalFines }}</span>
            <span class="stat-label">Total Fines</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ vm.visits }}</span>
            <span class="stat-label">Library Visits</span>
          </div>
        </div>
        <div class="sections">
          <section class="card">
            <h3>Active Borrows</h3>
            @if (vm.activeBorrows.length > 0) {
              <table class="table">
                <thead><tr><th>Book</th><th>Borrowed</th><th>Due</th><th>Status</th><th>Fine</th></tr></thead>
                <tbody>
                  @for (b of vm.activeBorrows; track $index) {
                    <tr>
                      <td>{{ b.bookTitle }}</td>
                      <td>{{ asDate(b.borrowedAt) | date:'shortDate' }}</td>
                      <td>{{ asDate(b.dueAt) | date:'shortDate' }}</td>
                      <td><span class="badge" [class.badge-overdue]="b.status==='overdue'">{{ b.status | titlecase }}</span></td>
                      <td [class.fine-red]="b.fineAmount > 0 && !b.finePaid">₱{{ b.fineAmount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="muted">No active borrows.</p>
            }
          </section>
          <section class="card">
            <h3>Borrow History</h3>
            @if (vm.borrowHistory.length > 0) {
              <table class="table">
                <thead><tr><th>Book</th><th>Borrowed</th><th>Returned</th><th>Fine</th></tr></thead>
                <tbody>
                  @for (b of vm.borrowHistory; track $index) {
                    <tr>
                      <td>{{ b.bookTitle }}</td>
                      <td>{{ asDate(b.borrowedAt) | date:'shortDate' }}</td>
                      <td>{{ asDate(b.returnedAt) | date:'shortDate' }}</td>
                      <td>₱{{ b.fineAmount }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="muted">No borrow history.</p>
            }
          </section>
          <section class="card">
            <h3>Visit History</h3>
            @if (vm.visitLogs.length > 0) {
              <table class="table">
                <thead><tr><th>Purpose</th><th>Time In</th><th>Time Out</th><th>Duration</th><th>Status</th></tr></thead>
                <tbody>
                  @for (v of vm.visitLogs; track $index) {
                    <tr>
                      <td>{{ v.purpose }}</td>
                      <td>{{ asDate(v.timeIn) | date:'short' }}</td>
                      <td>{{ asDate(v.timeOut) | date:'short' }}</td>
                      <td>{{ v.durationMinutes ?? '-' }} min</td>
                      <td>{{ v.status }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="muted">No visit records.</p>
            }
          </section>
        </div>
      </section>
    }
    
    @if (!(vm$ | async)) {
      <section class="profile-root">
        <p class="muted">Loading profile...</p>
      </section>
    }
    `,
    styles: [`
    .profile-root { display: flex; flex-direction: column; gap: 2rem; }
    .btn-back { background: none; border: none; color: #4f46e5; font-size: .9rem; cursor: pointer; font-weight: 500; padding: 0; margin-bottom: .5rem; }
    .btn-back:hover { text-decoration: underline; }
    .profile-header { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
    .avatar { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#6366f1); color: white; font-size: 1.5rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .profile-info h1 { margin: 0 0 .25rem 0; font-size: 1.75rem; font-weight: 700; color: #111827; }
    .role-tag { display: inline-block; background: #dbeafe; color: #1e40af; border-radius: 999px; font-size: .75rem; font-weight: 600; padding: .15rem .6rem; margin-bottom: .25rem; }
    .email, .student-id { color: #6b7280; font-size: .875rem; margin: 0; }
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
    .stat-card { background: white; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); border: 1px solid #e5e7eb; text-align: center; }
    .fine-card .stat-num { color: #dc2626; }
    .stat-num { display: block; font-size: 2rem; font-weight: 700; color: #4f46e5; margin-bottom: .25rem; }
    .stat-label { font-size: .75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; }
    .sections { display: flex; flex-direction: column; gap: 1.5rem; }
    .card { background: linear-gradient(135deg,#fff,#f9fafb); border-radius: 1rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); border: 1px solid rgba(229,231,235,.8); }
    .card h3 { margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: #111827; }
    .table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .table th, .table td { padding: .75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .table th { font-weight: 600; color: #374151; font-size: .75rem; text-transform: uppercase; background: #f9fafb; }
    .muted { color: #6b7280; font-size: .875rem; padding: 2rem; text-align: center; }
    .badge { display: inline-block; padding: .2rem .6rem; border-radius: 999px; font-size: .75rem; font-weight: 600; background: #dbeafe; color: #1e40af; }
    .badge-overdue { background: #fee2e2; color: #b91c1c; }
    .fine-red { color: #dc2626; font-weight: 600; }
  `]
})
export class StudentProfileComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly circulationService = inject(CirculationService);
    private readonly entryLogsService = inject(EntryLogsService);

    private readonly uid$ = this.route.paramMap.pipe(map((p) => p.get('uid') ?? ''));

    readonly vm$ = combineLatest([
        this.uid$,
        this.authService.getAllUsers().pipe(catchError(() => of([]))),
        this.circulationService.getAllBorrows$().pipe(catchError(() => of([]))),
        this.entryLogsService.getRecentLogs$(200).pipe(catchError(() => of([]))),
    ]).pipe(
        map(([uid, users, borrows, logs]) => {
            const user = users.find((u) => u.uid === uid) ?? null;
            const userBorrows: Borrow[] = borrows.filter((b) => b.userId === uid);
            const activeBorrows = userBorrows.filter((b) => b.status !== 'returned');
            const borrowHistory = userBorrows.filter((b) => b.status === 'returned');
            const totalFines = userBorrows.reduce((sum, b) => sum + (b.fineAmount ?? 0), 0);
            const visitLogs: EntryLog[] = logs.filter((l) => l.userId === uid);
            return { user, activeBorrows, borrowHistory, totalBorrows: userBorrows.length, totalFines, visits: visitLogs.length, visitLogs };
        })
    );

    goBack(): void { this.router.navigate(['/users']); }

    getInitials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
    }

    asDate(value: unknown): Date | null {
        if (!value) return null;
        const v: any = value;
        if (v.toDate instanceof Function) return v.toDate();
        if (value instanceof Date) return value;
        return new Date(v);
    }
}
