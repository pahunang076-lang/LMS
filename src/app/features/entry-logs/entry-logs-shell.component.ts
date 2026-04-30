import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { EntryLogsService } from './entry-logs.service';
import { EntryLog, VisitPurpose } from '../../core/models/entry-log.model';
import { AppUser } from '../../core/models/user.model';
import { QrScannerComponent } from '../../shared/qr-scanner.component';
import { BehaviorSubject, combineLatest, map } from 'rxjs';

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

  /* Search & filter state — backed by a Subject so filteredLogs$ reacts */
  private readonly filterSubject = new BehaviorSubject<{
    searchName: string;
    filterPurpose: VisitPurpose | 'all';
    filterDateFrom: string;
    filterDateTo: string;
  }>({ searchName: '', filterPurpose: 'all', filterDateFrom: '', filterDateTo: '' });

  get searchName() { return this.filterSubject.value.searchName; }
  get filterPurpose() { return this.filterSubject.value.filterPurpose; }
  get filterDateFrom() { return this.filterSubject.value.filterDateFrom; }
  get filterDateTo() { return this.filterSubject.value.filterDateTo; }

  readonly purposes: VisitPurpose[] = ['Study', 'Borrow/Return', 'Research', 'Others'];

  /* QR scan state */
  showQrScanner = false;
  qrError: string | null = null;

  /* Manual admin check-in form */
  readonly manualForm = this.fb.group({
    studentId: ['', Validators.required],
    purpose: ['Study' as VisitPurpose, Validators.required],
  });

  /* Filtered recent logs — reacts to both data AND filter changes */
  readonly filteredLogs$ = combineLatest([this.recentLogs$, this.filterSubject]).pipe(
    map(([logs, filters]) => this.applyFilters(logs, filters))
  );

  private applyFilters(logs: EntryLog[], filters: typeof this.filterSubject.value): EntryLog[] {
    return logs.filter((log) => {
      const matchName = !filters.searchName || log.name.toLowerCase().includes(filters.searchName.toLowerCase());
      const matchPurpose = filters.filterPurpose === 'all' || log.purpose === filters.filterPurpose;
      let matchDate = true;
      if (filters.filterDateFrom || filters.filterDateTo) {
        const logDate = this.asDate(log.timeIn);
        if (logDate) {
          if (filters.filterDateFrom) matchDate = matchDate && logDate >= new Date(filters.filterDateFrom);
          if (filters.filterDateTo) {
            const to = new Date(filters.filterDateTo);
            to.setHours(23, 59, 59, 999);
            matchDate = matchDate && logDate <= to;
          }
        }
      }
      return matchName && matchPurpose && matchDate;
    });
  }

  onSearch(val: string): void { this.filterSubject.next({ ...this.filterSubject.value, searchName: val }); }
  onPurposeFilter(val: string): void { this.filterSubject.next({ ...this.filterSubject.value, filterPurpose: val as VisitPurpose | 'all' }); }
  onDateFrom(val: string): void { this.filterSubject.next({ ...this.filterSubject.value, filterDateFrom: val }); }
  onDateTo(val: string): void { this.filterSubject.next({ ...this.filterSubject.value, filterDateTo: val }); }
  clearFilters(): void { this.filterSubject.next({ searchName: '', filterPurpose: 'all', filterDateFrom: '', filterDateTo: '' }); }


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
    let finalCode = raw.trim();
    try {
      const parsed = JSON.parse(raw) as { type?: string; value?: string };
      if (parsed.type === 'user' && parsed.value) {
        finalCode = parsed.value;
      } else if (parsed.type) {
        this.qrError = 'Invalid QR code type. Expected a Student/User QR code.';
        return;
      }
    } catch {
      // Not JSON — treat raw as plain string (backward compatibility)
    }

    const student = students.find((s) => s.qrCode === finalCode || s.uid === finalCode);
    if (!student) { this.qrError = 'No student found for this QR code.'; return; }
    const purpose = (this.manualForm.get('purpose')?.value ?? 'Study') as VisitPurpose;
    this.entryLogsService.logEntry(student, purpose);
    this.showQrScanner = false;
  }

  asDate(value: unknown): Date | null {
    if (!value) return null;
    const v = value as Record<string, unknown>;
    if (typeof v['toDate'] === 'function') return (v['toDate'] as () => Date)();
    if (value instanceof Date) return value;
    return new Date(String(value));
  }
}
