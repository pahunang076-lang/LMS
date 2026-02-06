import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';
import { ReportsService } from './reports.service';
import { map, startWith, switchMap } from 'rxjs';
import { Borrow } from '../../core/models/borrow.model';
import { EntryLog } from '../../core/models/entry-log.model';

type RangeType = 'daily' | 'weekly' | 'monthly';

@Component({
  selector: 'app-reports-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reports-shell.component.html',
  styleUrl: './reports-shell.component.css',
})
export class ReportsShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly reportsService = inject(ReportsService);

  readonly rangeForm = this.fb.group({
    type:<'daily' | 'weekly' | 'monthly'>('daily'),
    date: this.fb.control<string>(this.toInputDate(new Date())),
  });

  private readonly range$ = this.rangeForm.valueChanges.pipe(
    startWith(this.rangeForm.value),
    map((value) => {
      const type = (value.type ?? 'daily') as RangeType;
      const base = value.date ? new Date(value.date) : new Date();
      return this.computeRange(type, base);
    })
  );

  readonly borrows$ = this.range$.pipe(
    switchMap(({ start, end }) =>
      this.reportsService.getBorrowsInRange$(start, end)
    )
  );

  readonly entries$ = this.range$.pipe(
    switchMap(({ start, end }) =>
      this.reportsService.getEntryLogsInRange$(start, end)
    )
  );

  readonly topBooks$ = this.borrows$.pipe(
    map((borrows) => {
      const counts: Record<string, number> = {};
      for (const b of borrows) {
        const key = b.bookTitle ?? 'Unknown';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return Object.entries(counts)
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    })
  );

  readonly peakHours$ = this.entries$.pipe(
    map((entries) => {
      const hours = new Array<number>(24).fill(0);
      for (const e of entries) {
        const time =
          (e.timeIn as any).toDate instanceof Function
            ? (e.timeIn as any).toDate()
            : new Date(e.timeIn as any);
        const h = time.getHours();
        hours[h] += 1;
      }
      return hours;
    })
  );

  readonly userActivity$ = this.entries$.pipe(
    map((entries) => {
      const counts: Record<string, number> = {};
      for (const e of entries) {
        const key = e.name ?? 'Unknown';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return Object.entries(counts).map(([name, visits]) => ({
        name,
        visits,
      }));
    })
  );

  readonly visitPurposes$ = this.entries$.pipe(
    map((entries) => {
      const counts: Record<string, number> = {};
      for (const e of entries) {
        const key = e.purpose ?? 'Unknown';
        counts[key] = (counts[key] ?? 0) + 1;
      }
      return Object.entries(counts).map(([purpose, count]) => ({
        purpose,
        count,
      }));
    })
  );

  exportEntriesCsv(entries: EntryLog[]): void {
    if (typeof window === 'undefined' || !entries?.length) {
      return;
    }

    const header = [
      'Name',
      'Purpose',
      'Time In',
      'Time Out',
      'Duration (min)',
      'Status',
    ];

    const rows = entries.map((e) => [
      e.name,
      e.purpose,
      this.formatDate(e.timeIn),
      this.formatDate(e.timeOut),
      String(e.durationMinutes ?? ''),
      e.status,
    ]);

    this.downloadCsv('visit-report.csv', [header, ...rows]);
  }

  exportBorrowsCsv(borrows: Borrow[]): void {
    if (typeof window === 'undefined' || !borrows?.length) {
      return;
    }

    const header = [
      'Book',
      'User ID',
      'Borrowed At',
      'Due At',
      'Returned At',
      'Status',
      'Fine',
    ];

    const rows = borrows.map((b) => [
      b.bookTitle,
      b.userId,
      this.formatDate(b.borrowedAt),
      this.formatDate(b.dueAt),
      this.formatDate(b.returnedAt),
      b.status,
      String(b.fineAmount ?? 0),
    ]);

    this.downloadCsv('borrows-report.csv', [header, ...rows]);
  }

  private computeRange(type: RangeType, base: Date): {
    start: Date;
    end: Date;
  } {
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(base);

    if (type === 'daily') {
      end.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const day = start.getDay(); // 0-6, Sunday first
      const diffToMonday = (day + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  private toInputDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatDate(value: unknown): string {
    if (!value) {
      return '';
    }
    const anyVal: any = value;
    const d: Date =
      anyVal.toDate instanceof Function ? anyVal.toDate() : new Date(anyVal);
    return d.toISOString();
  }

  private downloadCsv(filename: string, rows: string[][]): void {
    const csv = rows
      .map((cols) =>
        cols
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

