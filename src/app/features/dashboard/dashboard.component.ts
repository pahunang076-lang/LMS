import { Component, inject } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { DashboardService } from './dashboard.service';
import { EntryLogsService } from '../entry-logs/entry-logs.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf],
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
}


