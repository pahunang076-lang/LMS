import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { BookRequestService } from './book-request.service';
import { BookRequest, BookRequestStatus } from '../../core/models/book-request.model';
import { map, switchMap, filter, combineLatest } from 'rxjs';

@Component({
    selector: 'app-book-requests-shell',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './book-requests-shell.component.html',
    styleUrl: './book-requests-shell.component.css',
})
export class BookRequestsShellComponent {
    private readonly fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly requestService = inject(BookRequestService);

    readonly user$ = this.auth.currentUser$;
    readonly isAdminOrLibrarian$ = this.auth.hasRole(['admin', 'librarian']);

    /** Students see only their own. Admin/librarian see all. */
    readonly requests$ = combineLatest([this.user$, this.isAdminOrLibrarian$]).pipe(
        switchMap(([user, isAdmin]) => {
            return isAdmin
                ? this.requestService.getAll$()
                : user
                    ? this.requestService.getForUser$(user.uid)
                    : this.requestService.getForUser$('');
        })
    );

    readonly pendingCount$ = this.requests$.pipe(
        map((reqs) => reqs.filter((r) => r.status === 'pending').length)
    );

    readonly form = this.fb.group({
        title: ['', Validators.required],
        author: [''],
        isbn: [''],
        notes: [''],
    });

    submitting = false;
    submitSuccess = false;

    async submit(user: { uid: string; name: string }): Promise<void> {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }
        this.submitting = true;
        const v = this.form.getRawValue();
        await this.requestService.create({
            userId: user.uid,
            userName: user.name ?? user.uid,
            title: v.title ?? '',
            author: v.author ?? '',
            isbn: v.isbn ?? '',
            notes: v.notes ?? '',
            status: 'pending',
            requestedAt: new Date().toISOString(),
        });
        this.form.reset();
        this.submitting = false;
        this.submitSuccess = true;
        setTimeout(() => { this.submitSuccess = false; }, 4000);
    }

    async updateStatus(req: BookRequest, status: BookRequestStatus): Promise<void> {
        await this.requestService.updateStatus(req, status);
    }

    statusLabel(s: BookRequestStatus): string {
        const map: Record<BookRequestStatus, string> = {
            pending: '🕐 Pending', approved: '✅ Approved', rejected: '❌ Rejected', fulfilled: '📦 Fulfilled',
        };
        return map[s] ?? s;
    }

    statusClass(s: BookRequestStatus): string {
        const map: Record<BookRequestStatus, string> = {
            pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', fulfilled: 'badge-fulfilled',
        };
        return map[s] ?? '';
    }
}
