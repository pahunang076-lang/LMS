import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { EntryLog } from '../../core/models/entry-log.model';
import { EntryLogsService } from '../entry-logs/entry-logs.service';

interface PurposeDistribution {
  [purpose: string]: number;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly entryLogsService = inject(EntryLogsService);

  // Helper to safely convert Firebase Timestamp or String to Date
  private convertToDate(timeIn: any): Date {
    if (timeIn && typeof timeIn.toDate === 'function') {
      return timeIn.toDate();
    }
    return new Date(timeIn);
  }

  private isToday(dateStr: any): boolean {
    if (!dateStr) return false;
    const date = this.convertToDate(dateStr);
    const now = new Date();
    return (
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  getTodayVisits$(): Observable<number> {
    return this.entryLogsService.getAllLogs$().pipe(
      map(logs => logs.filter(log => this.isToday(log.timeIn)).length)
    );
  }

  getCurrentlyInside$(): Observable<number> {
    return this.entryLogsService.getAllLogs$().pipe(
      map(logs => logs.filter(log => log.status === 'Inside').length)
    );
  }

  getLastEntryTime$(): Observable<Date | null> {
    return this.entryLogsService.getAllLogs$().pipe(
      map(logs => {
        const todayLogs = logs.filter(log => this.isToday(log.timeIn));
        if (todayLogs.length === 0) return null;

        todayLogs.sort((a, b) => {
          const tA = this.convertToDate(a.timeIn).getTime();
          const tB = this.convertToDate(b.timeIn).getTime();
          return tA - tB;
        });

        const last = todayLogs[todayLogs.length - 1];
        return this.convertToDate(last.timeIn);
      })
    );
  }

  getTodayPurposeDistribution$(): Observable<PurposeDistribution> {
    return this.entryLogsService.getAllLogs$().pipe(
      map(logs => {
        const dist: PurposeDistribution = {};
        const todayLogs = logs.filter(log => this.isToday(log.timeIn));
        for (const log of todayLogs) {
          const key = log.purpose ?? 'Unknown';
          dist[key] = (dist[key] ?? 0) + 1;
        }
        return dist;
      })
    );
  }

  getTodayHourlyTraffic$(): Observable<number[]> {
    return this.entryLogsService.getAllLogs$().pipe(
      map(logs => {
        const hours = new Array<number>(24).fill(0);
        const todayLogs = logs.filter(log => this.isToday(log.timeIn));
        for (const log of todayLogs) {
          if (!log.timeIn) continue;
          const d = this.convertToDate(log.timeIn);
          hours[d.getHours()] += 1;
        }
        return hours;
      })
    );
  }
}