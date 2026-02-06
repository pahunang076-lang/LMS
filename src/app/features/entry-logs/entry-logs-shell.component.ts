import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { EntryLogsService } from './entry-logs.service';
import { VisitPurpose, EntryLog } from '../../core/models/entry-log.model';
import { map } from 'rxjs';

@Component({
  selector: 'app-entry-logs-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './entry-logs-shell.component.html',
  styleUrl: './entry-logs-shell.component.css',
})
export class EntryLogsShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly entryLogsService = inject(EntryLogsService);

  readonly user$ = this.authService.currentUser$;
  readonly inside$ = this.entryLogsService.getCurrentInside$();
  readonly recentLogs$ = this.entryLogsService.getRecentLogs$();

  readonly insideCount$ = this.inside$.pipe(map((logs) => logs.length));

  readonly form = this.fb.group({
    purpose: ['Study' as VisitPurpose, Validators.required],
  });

  async checkIn(): Promise<void> {
    const user = await this.user$.pipe().toPromise();
    if (!user || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { purpose } = this.form.getRawValue();
    if (!purpose) {
      return;
    }

    await this.entryLogsService.logEntry(user, purpose as VisitPurpose);
  }

  async checkOut(): Promise<void> {
    const user = await this.user$.pipe().toPromise();
    if (!user) {
      return;
    }
    await this.entryLogsService.logExit(user.uid);
  }

  async forceCheckout(log: EntryLog): Promise<void> {
    await this.entryLogsService.forceCheckout(log);
  }

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

