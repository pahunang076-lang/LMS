import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { CirculationService } from '../circulation/circulation.service';
import { map, switchMap, combineLatest } from 'rxjs';

@Component({
    selector: 'app-my-profile',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './my-profile.component.html',
    styleUrl: './my-profile.component.css',
})
export class MyProfileComponent {
    private readonly auth = inject(AuthService);
    private readonly circulation = inject(CirculationService);

    readonly user$ = this.auth.currentUser$;

    readonly allBorrows$ = this.user$.pipe(
        switchMap(u => this.circulation.getAllBorrows$().pipe(
            map(borrows => borrows.filter(b => b.userId === u?.uid))
        ))
    );

    readonly stats$ = this.allBorrows$.pipe(
        map(borrows => {
            const total = borrows.length;
            const returned = borrows.filter(b => b.status === 'returned').length;
            const active = borrows.filter(b => b.status === 'borrowed').length;
            const overdue = borrows.filter(b => b.status === 'overdue').length;
            const totalFines = borrows.reduce((s, b) => s + (b.fineAmount ?? 0), 0);
            const paidFines = borrows.filter(b => b.finePaid).reduce((s, b) => s + (b.fineAmount ?? 0), 0);
            const reviews = borrows.filter(b => b.rating && b.rating > 0).length;
            const avgRating = reviews > 0
                ? borrows.filter(b => b.rating).reduce((s, b) => s + (b.rating ?? 0), 0) / reviews
                : 0;

            // Favorite category
            const catCount: Record<string, number> = {};
            borrows.filter(b => (b as any).bookCategory).forEach(b => {
                const cat = (b as any).bookCategory as string;
                catCount[cat] = (catCount[cat] ?? 0) + 1;
            });
            const favoriteCategory = Object.keys(catCount).sort((a, z) => catCount[z] - catCount[a])[0] ?? null;

            return { total, returned, active, overdue, totalFines, paidFines, reviews, avgRating, favoriteCategory };
        })
    );

    readonly history$ = this.allBorrows$.pipe(
        map(borrows => [...borrows].sort((a, b) => {
            const da = new Date((a.borrowedAt ?? 0) as any).getTime();
            const db = new Date((b.borrowedAt ?? 0) as any).getTime();
            return db - da;
        }))
    );

    getInitials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.substring(0, 2).toUpperCase();
    }

    stars(rating: number | undefined): string[] {
        const r = Math.round(rating ?? 0);
        return Array.from({ length: 5 }, (_, i) => i < r ? '★' : '☆');
    }

    asDate(val: unknown): Date {
        return val instanceof Date ? val : new Date(val as any);
    }
}
