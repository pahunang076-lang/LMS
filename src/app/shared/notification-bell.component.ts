import { Component, inject, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationsService, AppNotification } from '../core/services/notifications.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bell-wrapper" (click)="toggle($event)">
      <button class="bell-btn" [class.has-alerts]="count > 0" aria-label="Notifications">
        🔔
        @if (count > 0) {
          <span class="badge">{{ count > 9 ? '9+' : count }}</span>
        }
      </button>
    
      @if (open) {
        <div class="panel" (click)="$event.stopPropagation()">
          <div class="panel-header">
            <span>Notifications</span>
            <span class="count-tag">{{ count }}</span>
          </div>
          <div class="panel-body">
            @if ((notifications$ | async); as items) {
              @if (items.length === 0) {
                <div class="empty">🎉 All clear! No alerts.</div>
              }
              @for (n of items; track $index) {
                <div class="notif-item"
                  [class.notif-overdue]="n.type === 'overdue'"
                  [class.notif-due-soon]="n.type === 'due-soon'"
                  [class.notif-ready]="n.type === 'reservation-ready'"
                  [class.notif-new-res]="n.type === 'reservation-new'"
                  [class.notif-book-request]="n.type === 'book-request'"
                  (click)="navigate(n)">
                  <span class="notif-icon">
                    {{ n.type === 'overdue' ? '🚨'
                    : n.type === 'due-soon' ? '⏰'
                    : n.type === 'reservation-ready' ? '✅'
                    : n.type === 'reservation-new' ? '📋'
                    : '📖' }}
                  </span>
                  <div class="notif-content">
                    <span class="notif-msg">{{ n.message }}</span>
                    <span class="notif-link-hint">Tap to view →</span>
                  </div>
                </div>
              }
            }
          </div>
          <div class="panel-footer">
            <a routerLink="/circulation" class="footer-link" (click)="open = false">View Borrows</a>
            <a routerLink="/reservations" class="footer-link" (click)="open = false">Reservations</a>
          </div>
        </div>
      }
    </div>
    `,
  styles: [`
    .bell-wrapper { position: relative; display: inline-flex; align-items: center; }
    .bell-btn {
      background: transparent; border: none; font-size: 1.25rem; cursor: pointer;
      position: relative; padding: 0.35rem; border-radius: 0.5rem;
      transition: background 0.2s; line-height: 1;
    }
    .bell-btn:hover { background: rgba(0,0,0,0.06); }
    .bell-btn.has-alerts { animation: ring 1.5s ease infinite; }
    @keyframes ring {
      0%, 100% { transform: rotate(0); }
      10% { transform: rotate(-15deg); }
      20% { transform: rotate(15deg); }
      30% { transform: rotate(-10deg); }
      40% { transform: rotate(10deg); }
      50% { transform: rotate(0); }
    }
    .badge {
      position: absolute; top: 0; right: 0;
      background: #ef4444; color: white; font-size: 0.6rem; font-weight: 700;
      border-radius: 999px; min-width: 16px; height: 16px;
      display: flex; align-items: center; justify-content: center; padding: 0 3px;
      line-height: 1; transform: translate(25%, -25%);
    }
    .panel {
      position: absolute; top: calc(100% + 0.5rem); right: 0;
      width: 320px;
      background: var(--bg-card, white);
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      border: 1px solid var(--border-color, #e5e7eb);
      z-index: 100; overflow: hidden;
      animation: fadeDown 0.2s ease;
    }
    @keyframes fadeDown {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.9rem 1rem; border-bottom: 1px solid var(--border-color, #f3f4f6);
      font-weight: 600; font-size: 0.9rem; color: var(--text-main, #111827);
    }
    .count-tag {
      background: #4f46e5; color: white; font-size: 0.7rem;
      font-weight: 700; border-radius: 999px; padding: 0.1rem 0.5rem;
    }
    .panel-body { max-height: 320px; overflow-y: auto; }
    .empty { padding: 2rem 1rem; text-align: center; color: var(--text-muted, #6b7280); font-size: 0.9rem; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 0.6rem;
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color, #f9fafb);
      transition: background 0.15s; cursor: pointer;
    }
    .notif-item:hover { background: var(--bg-hover, #f0f0ff); }
    .notif-overdue { border-left: 3px solid #ef4444; }
    .notif-due-soon { border-left: 3px solid #f59e0b; }
    .notif-ready { border-left: 3px solid #10b981; }
    .notif-new-res { border-left: 3px solid #8b5cf6; }
    .notif-book-request { border-left: 3px solid #3b82f6; }
    .notif-icon { font-size: 1rem; flex-shrink: 0; margin-top: 2px; }
    .notif-content { display: flex; flex-direction: column; gap: 2px; }
    .notif-msg { font-size: 0.825rem; color: var(--text-main, #374151); line-height: 1.45; }
    .notif-link-hint { font-size: 0.7rem; color: #6366f1; font-weight: 500; }
    .panel-footer {
      display: flex; gap: 0.5rem; justify-content: flex-end;
      padding: 0.65rem 1rem; border-top: 1px solid var(--border-color, #f3f4f6);
      background: var(--bg-section, #f9fafb);
    }
    .footer-link {
      font-size: 0.8rem; color: #4f46e5; text-decoration: none; font-weight: 500;
      padding: 0.3rem 0.65rem; border-radius: 0.375rem; transition: background 0.15s;
    }
    .footer-link:hover { background: var(--bg-hover, #eff6ff); }
  `]
})
export class NotificationBellComponent {
  private readonly el = inject(ElementRef);
  private readonly router = inject(Router);
  readonly notificationsService = inject(NotificationsService);
  readonly notifications$ = this.notificationsService.notifications$;

  count = 0;
  open = false;

  constructor() {
    this.notifications$.subscribe((n) => { this.count = n.length; });
  }

  toggle(e: MouseEvent): void {
    e.stopPropagation();
    this.open = !this.open;
  }

  navigate(n: AppNotification): void {
    this.open = false;
    this.notificationsService.markAsRead(n.id);
    this.router.navigate([n.link]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.open = false;
    }
  }
}
