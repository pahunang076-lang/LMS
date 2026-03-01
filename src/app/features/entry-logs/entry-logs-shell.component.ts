import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { EntryLogsService } from './entry-logs.service';
import { EntryLog, VisitPurpose } from '../../core/models/entry-log.model';
import { AppUser } from '../../core/models/user.model';
import { QrScannerComponent } from '../../shared/qr-scanner.component';
import { combineLatest, map } from 'rxjs';

@Component({
  selector: 'app-entry-logs-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrScannerComponent],
  templateUrl: './entry-logs-shell.component.html',
  styleUrl: './entry-logs-shell.component.css',
})
export class EntryLogsShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly entryLogsService = inject(EntryLogsService);

  readonly inside$ = this.entryLogsService.getCurrentInside$();
  readonly recentLogs$ = this.entryLogsService.getRecentLogs$(100);
  readonly insideCount$ = this.inside$.pipe(map((logs) => logs.length));

  /* All users for admin manual check-in dropdown */
  readonly allStudents$ = this.authService.getAllUsers().pipe(
    map((users) => users.filter((u) => u.role === 'student'))
  );

  /* Search & filter state */
  searchName = '';
  filterPurpose: VisitPurpose | 'all' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  readonly purposes: VisitPurpose[] = ['Study', 'Borrow/Return', 'Research', 'Others'];

  /* QR scan state */
  showQrScanner = false;
  qrError: string | null = null;

  /* Manual admin check-in form */
  readonly manualForm = this.fb.group({
    studentId: ['', Validators.required],
    purpose: ['Study' as VisitPurpose, Validators.required],
  });

  /* Filtered recent logs */
  readonly filteredLogs$ = this.recentLogs$.pipe(
    map((logs) => this.applyFilters(logs))
  );

  private applyFilters(logs: EntryLog[]): EntryLog[] {
    return logs.filter((log) => {
      const matchName = !this.searchName || log.name.toLowerCase().includes(this.searchName.toLowerCase());
      const matchPurpose = this.filterPurpose === 'all' || log.purpose === this.filterPurpose;
      let matchDate = true;
      if (this.filterDateFrom || this.filterDateTo) {
        const logDate = this.asDate(log.timeIn);
        if (logDate) {
          if (this.filterDateFrom) matchDate = matchDate && logDate >= new Date(this.filterDateFrom);
          if (this.filterDateTo) {
            const to = new Date(this.filterDateTo);
            to.setHours(23, 59, 59, 999);
            matchDate = matchDate && logDate <= to;
          }
        }
      }
      return matchName && matchPurpose && matchDate;
    });
  }

  onSearch(val: string): void { this.searchName = val; }
  onPurposeFilter(val: string): void { this.filterPurpose = val as VisitPurpose | 'all'; }
  onDateFrom(val: string): void { this.filterDateFrom = val; }
  onDateTo(val: string): void { this.filterDateTo = val; }
  clearFilters(): void { this.searchName = ''; this.filterPurpose = 'all'; this.filterDateFrom = ''; this.filterDateTo = ''; }

  async manualCheckIn(students: AppUser[]): Promise<void> {
    if (this.manualForm.invalid) { this.manualForm.markAllAsTouched(); return; }
    const { studentId, purpose } = this.manualForm.getRawValue();
    const student = students.find((s) => s.uid === studentId);
    if (!student || !purpose) return;
    await this.entryLogsService.logEntry(student, purpose as VisitPurpose);
    this.manualForm.reset({ studentId: '', purpose: 'Study' });
  }

  async forceCheckout(log: EntryLog): Promise<void> {
    await this.entryLogsService.forceCheckout(log);
  }

  onStudentQrScanned(raw: string, students: AppUser[]): void {
    this.qrError = null;
    const student = students.find((s) => s.qrCode === raw.trim());
    if (!student) { this.qrError = 'No student found for this QR code.'; return; }
    const purpose = (this.manualForm.get('purpose')?.value ?? 'Study') as VisitPurpose;
    this.entryLogsService.logEntry(student, purpose);
    this.showQrScanner = false;
  }

  asDate(value: unknown): Date | null {
    if (!value) return null;
    const v: any = value;
    if (v.toDate instanceof Function) return v.toDate();
    if (value instanceof Date) return value;
    return new Date(v as any);
  }
}
