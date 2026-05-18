import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CirculationService } from '../circulation/circulation.service';
import { Borrow } from '../../core/models/borrow.model';
import { map, combineLatest } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';
import { Timestamp } from '@angular/fire/firestore';

export type FinesTab = 'outstanding' | 'history';

@Component({
    selector: 'app-fines-shell',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './fines-shell.component.html',
    styleUrl: './fines-shell.component.css'
})
export class FinesShellComponent {
    private readonly circulation = inject(CirculationService);

    readonly activeTab = signal<FinesTab>('outstanding');
    readonly searchQuery = signal('');

    private readonly allBorrows = toSignal(this.circulation.getAllBorrows$(), { initialValue: [] });

    readonly outstandingFines = computed(() =>
        this.allBorrows().filter(b => b.fineAmount > 0 && !b.finePaid && (b.userName || b.studentId))
    );

    readonly paidFines = computed(() =>
        this.allBorrows()
            .filter(b => b.fineAmount > 0 && b.finePaid === true && (b.userName || b.studentId))
            .sort((a, b) => {
                const dateA = a.finePaidAt ? new Date(a.finePaidAt as any).getTime() : 0;
                const dateB = b.finePaidAt ? new Date(b.finePaidAt as any).getTime() : 0;
                return dateB - dateA;
            })
    );

    readonly filteredOutstanding = computed(() => {
        const q = this.searchQuery().toLowerCase();
        if (!q) return this.outstandingFines();
        return this.outstandingFines().filter(b =>
            b.bookTitle?.toLowerCase().includes(q) ||
            b.userName?.toLowerCase().includes(q) ||
            b.studentId?.toLowerCase().includes(q) ||
            b.userId?.toLowerCase().includes(q)
        );
    });

    readonly filteredPaid = computed(() => {
        const q = this.searchQuery().toLowerCase();
        if (!q) return this.paidFines();
        return this.paidFines().filter(b =>
            b.bookTitle?.toLowerCase().includes(q) ||
            b.userName?.toLowerCase().includes(q) ||
            b.studentId?.toLowerCase().includes(q)
        );
    });

    readonly totalOutstandingSum = computed(() =>
        this.outstandingFines().reduce((sum, b) => sum + (b.fineAmount || 0), 0)
    );

    readonly totalPaidSum = computed(() =>
        this.paidFines().reduce((sum, b) => sum + (b.fineAmount || 0), 0)
    );

    readonly overdueCount = computed(() =>
        this.outstandingFines().filter(b => b.status === 'overdue').length
    );

    setActiveTab(tab: FinesTab): void {
        this.activeTab.set(tab);
        this.searchQuery.set('');
    }

    onSearch(val: string): void {
        this.searchQuery.set(val);
    }

    asDate(value: unknown): Date | null {
        if (!value) return null;
        if (value instanceof Timestamp) return value.toDate();
        if (value instanceof Date) return value;
        try { return new Date(value as any); } catch { return null; }
    }

    async processPayment(borrow: Borrow) {
        const result = await Swal.fire({
            title: 'Confirm Fine Payment',
            html: `
                <div style="text-align:left; padding: 0.5rem 0;">
                    <p style="margin:0 0 0.5rem; color:#6b7280; font-size:0.9rem;">You are processing a payment for:</p>
                    <p style="margin:0 0 0.25rem; font-weight:600;">${borrow.bookTitle}</p>
                    <p style="margin:0 0 1rem; color:#6b7280; font-size:0.85rem;">${borrow.userName || borrow.studentId || 'Student'}</p>
                    <div style="background:#fef3c7; border:1px solid #fcd34d; border-radius:8px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem; color:#92400e;">Fine Amount</span>
                        <span style="font-size:1.25rem; font-weight:700; color:#b45309;">₱${borrow.fineAmount.toFixed(2)}</span>
                    </div>
                </div>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            confirmButtonText: '✓ Confirm Payment',
            cancelButtonText: 'Cancel',
            customClass: { popup: 'swal2-modern' }
        });

        if (result.isConfirmed) {
            await this.circulation.payFine(borrow);
        }
    }
}
