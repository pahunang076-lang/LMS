import { Component, inject } from '@angular/core';
import { CommonModule, NgForOf, NgIf, KeyValuePipe } from '@angular/common';
import { DashboardService } from './dashboard.service';
import { EntryLogsService } from '../entry-logs/entry-logs.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf, KeyValuePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly entryLogsService = inject(EntryLogsService);

  readonly totalVisitsToday$ = this.dashboardService.getTodayVisits$();
  readonly currentlyInside$ = this.dashboardService.getCurrentlyInside$();
  readonly lastEntryTime$ = this.dashboardService.getLastEntryTime$();
  readonly hourlyTraffic$ = this.dashboardService.getTodayHourlyTraffic$();
  readonly purposeDistribution$ =
    this.dashboardService.getTodayPurposeDistribution$();
  readonly recentLogs$ = this.entryLogsService.getRecentLogs$();

  // Expose Math to template
  readonly Math = Math;

  asDate(value: unknown): Date | null {
    if (!value) {
      return null;
    }
    const anyVal: any = value;
    if (anyVal.toDate instanceof Function) {
      return anyVal.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    return new Date(anyVal as any);
  }

  getPurposePercentage(value: number, distribution: Record<string, number>): number {
    const total = Object.values(distribution).reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}


