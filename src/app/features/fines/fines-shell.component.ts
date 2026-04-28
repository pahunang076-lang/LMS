import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CirculationService } from '../circulation/circulation.service';
import { map } from 'rxjs';
import { TableModule } from 'primeng/table';
import Swal from 'sweetalert2';

export type FinesTab = 'outstanding' | 'history';

@Component({
    selector: 'app-fines-shell',
    standalone: true,
    imports: [CommonModule, TableModule],
    templateUrl: './fines-shell.component.html',
    styleUrl: './fines-shell.component.css'
})
export class FinesShellComponent {
    private readonly circulation = inject(CirculationService);

    readonly activeTab = signal<FinesTab>('outstanding');

    readonly outstandingFines$ = this.circulation.getAllBorrows$().pipe(
        map(borrows => borrows.filter(b => b.fineAmount && b.fineAmount > 0 && !b.finePaid))
    );

    readonly totalFinesSum$ = this.outstandingFines$.pipe(
        map(borrows => borrows.reduce((sum, b) => sum + (b.fineAmount || 0), 0))
    );

    readonly paidFines$ = this.circulation.getAllBorrows$().pipe(
        map(borrows => borrows.filter(b => b.fineAmount && b.fineAmount > 0 && b.finePaid === true).sort((a, b) => {
            const dateA = a.finePaidAt ? new Date(a.finePaidAt as any).getTime() : 0;
            const dateB = b.finePaidAt ? new Date(b.finePaidAt as any).getTime() : 0;
            return dateB - dateA;
        }))
    );

    setActiveTab(tab: FinesTab): void {
        this.activeTab.set(tab);
    }

    async processPayment(borrow: any) {
        const result = await Swal.fire({
            title: 'Confirm Payment',
            text: `Process the payment of ₱${borrow.fineAmount} for ${borrow.bookTitle}?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'Yes, process payment'
        });

        if (result.isConfirmed) {
            await this.circulation.payFine(borrow);
            Swal.fire({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                icon: 'success',
                title: 'Payment processed successfully'
            });
        }
    }
}
