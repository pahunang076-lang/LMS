import { Component, Input, Output, EventEmitter, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { AppUser } from '../../core/models/user.model';
import { Borrow } from '../../core/models/borrow.model';
import { CirculationService } from '../circulation/circulation.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-user-history-modal',
  standalone: true,
  imports: [CommonModule, ProgressSpinnerModule, TitleCasePipe],
  template: `
    @if (isOpen) {
      <div class="modal-overlay" (click)="close.emit()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="modal-header">
            <div>
              <h2 class="title">{{ user?.name }}'s History</h2>
              <p class="subtitle">Total Books Borrowed: {{ totalBorrows() }}</p>
            </div>
            <button type="button" class="close-btn" (click)="close.emit()">&times;</button>
          </div>
          <!-- Body -->
          <div class="modal-body" (scroll)="onScroll($event)">
            @if (loading()) {
              <div class="state-container">
                <p-progressSpinner styleClass="w-2rem h-2rem"></p-progressSpinner>
                <span style="margin-top: 8px;">Loading history...</span>
              </div>
            }
            @if (!loading() && visibleBorrows().length === 0) {
              <div class="state-container">
                No borrowing history found.
              </div>
            }
            @if (!loading() && visibleBorrows().length > 0) {
              <div class="timeline">
                @for (borrow of visibleBorrows(); track $index) {
                  <div class="timeline-item">
                    <div class="status-indicator" [ngClass]="getIndicatorClass(borrow.status)"></div>
                    <div class="item-content">
                      <div class="book-title">{{ borrow.bookTitle }}</div>
                      <div class="item-details">
                        <span>Borrowed: {{ formatDate(borrow.borrowedAt) }}</span>
                        @if (borrow.returnedAt) {
                          <span> • Returned: {{ formatDate(borrow.returnedAt) }}</span>
                        }
                        @if (!borrow.returnedAt) {
                          <span> • Due: {{ formatDate(borrow.dueAt) }}</span>
                        }
                      </div>
                    </div>
                    <div class="pill" [ngClass]="getPillClass(borrow.status)">
                      {{ borrow.status | titlecase }}
                    </div>
                  </div>
                }
              </div>
            }
            @if (!loading() && visibleBorrows().length < allBorrows().length) {
              <div class="load-more">
                <button type="button" class="load-more-btn" (click)="loadMore()">
                  Load More ({{allBorrows().length - visibleBorrows().length}} older)
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
    `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
      display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-content {
      background: white; width: 450px; max-width: 90vw; max-height: 80vh;
      border-radius: 16px; display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
    .modal-header {
      padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
      display: flex; justify-content: space-between; align-items: flex-start;
      background: #f9fafb;
    }
    .title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #111827; }
    .subtitle { margin: 4px 0 0 0; font-size: 0.8rem; font-weight: 500; color: #6b7280; }
    .close-btn { 
      background: transparent; border: none; font-size: 1.5rem; 
      color: #9ca3af; cursor: pointer; padding: 0; line-height: 1;
    }
    .close-btn:hover { color: #4b5563; }
    .modal-body {
      padding: 24px; overflow-y: auto; flex: 1; background: #ffffff;
    }
    .state-container {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px 0; color: #6b7280; font-size: 0.9rem;
    }
    .timeline { display: flex; flex-direction: column; gap: 16px; }
    .timeline-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding-bottom: 16px; border-bottom: 1px solid #f3f4f6;
    }
    .timeline-item:last-child { border-bottom: none; padding-bottom: 0; }
    .status-indicator { width: 10px; height: 10px; border-radius: 50%; background: #e5e7eb; flex-shrink: 0; margin-top: 5px;}
    .item-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    .book-title { font-weight: 600; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.95rem; }
    .item-details { font-size: 0.75rem; color: #6b7280; line-height: 1.3;}
    .pill {
      font-size: 0.7rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; white-space: nowrap; align-self: center;
    }
    
    .indicator-returned { background: #22c55e; }
    .pill-returned { background: #dcfce7; color: #166534; }
    
    .indicator-borrowed { background: #eab308; }
    .pill-borrowed { background: #fef3c7; color: #92400e; }

    .indicator-overdue { background: #ef4444; }
    .pill-overdue { background: #fee2e2; color: #991b1b; }

    .load-more { display: flex; justify-content: center; margin-top: 16px; }
    .load-more-btn {
      background: #f3f4f6; border: none; padding: 8px 16px; border-radius: 8px;
      font-size: 0.8rem; font-weight: 600; color: #4b5563; cursor: pointer;
      transition: background 0.2s;
    }
    .load-more-btn:hover { background: #e5e7eb; }
  `]
})
export class UserHistoryModalComponent implements OnChanges {
  @Input() user: AppUser | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  private circulationService = inject(CirculationService);

  readonly loading = signal(false);
  readonly allBorrows = signal<Borrow[]>([]);
  readonly visibleBorrows = signal<Borrow[]>([]);
  readonly totalBorrows = signal(0);
  
  private readonly PAGE_SIZE = 5;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.user) {
      this.loadHistory();
    } else if (!this.isOpen) {
      this.allBorrows.set([]);
      this.visibleBorrows.set([]);
      this.totalBorrows.set(0);
    }
  }

  loadHistory() {
    if (!this.user) return;
    this.loading.set(true);
    
    this.circulationService.getBorrowsForUser$(this.user.uid).pipe(take(1)).subscribe({
      next: (borrows) => {
        // Sort descending by borrowedAt date
        const sorted = borrows.sort((a, b) => {
           const dateA = a.borrowedAt && typeof (a.borrowedAt as any).toDate === 'function' ? (a.borrowedAt as any).toDate() : new Date(a.borrowedAt as any);
           const dateB = b.borrowedAt && typeof (b.borrowedAt as any).toDate === 'function' ? (b.borrowedAt as any).toDate() : new Date(b.borrowedAt as any);
           return dateB.getTime() - dateA.getTime();
        });
        
        this.allBorrows.set(sorted);
        this.totalBorrows.set(sorted.length);
        this.visibleBorrows.set(sorted.slice(0, this.PAGE_SIZE));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadMore() {
    const current = this.visibleBorrows().length;
    const next = this.allBorrows().slice(current, current + this.PAGE_SIZE);
    this.visibleBorrows.update(v => [...v, ...next]);
  }

  onScroll(event: Event) {
    const target = event.target as HTMLElement;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
      if (this.visibleBorrows().length < this.allBorrows().length) {
        this.loadMore();
      }
    }
  }

  getIndicatorClass(status: string): string {
    if (status === 'returned') return 'indicator-returned';
    if (status === 'overdue') return 'indicator-overdue';
    return 'indicator-borrowed';
  }

  getPillClass(status: string): string {
    if (status === 'returned') return 'pill-returned';
    if (status === 'overdue') return 'pill-overdue';
    return 'pill-borrowed';
  }

  formatDate(val: any): string {
    if (!val) return '';
    const d = typeof val.toDate === 'function' ? val.toDate() : new Date(val);
    return d.toLocaleDateString();
  }
}
