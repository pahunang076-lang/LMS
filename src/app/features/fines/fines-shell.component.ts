import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CirculationService } from '../circulation/circulation.service';
import { map } from 'rxjs';
import { TableModule } from 'primeng/table';

@Component({
    selector: 'app-fines-shell',
    standalone: true,
    imports: [CommonModule, TableModule],
    templateUrl: './fines-shell.component.html',
    styleUrl: './fines-shell.component.css'
})
export class FinesShellComponent {
    private readonly circulation = inject(CirculationService);

    readonly outstandingFines$ = this.circulation.getAllBorrows$().pipe(
        map(borrows => borrows.filter(b => b.fineAmount && b.fineAmount > 0 && !b.finePaid))
    );

    readonly totalFinesSum$ = this.outstandingFines$.pipe(
        map(borrows => borrows.reduce((sum, b) => sum + (b.fineAmount || 0), 0))
    );

    async processPayment(borrow: any) {
        if (confirm(`Are you sure you want to process the payment of ₱${borrow.fineAmount} for ${borrow.bookTitle}?`)) {
            await this.circulation.payFine(borrow);
        }
    }
}
