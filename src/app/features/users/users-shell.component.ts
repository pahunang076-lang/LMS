import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AppUser, UserRole } from '../../core/models/user.model';
import { Observable } from 'rxjs';
import { QrCodeComponent } from '../../shared/qr-code.component';

@Component({
  selector: 'app-users-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrCodeComponent],
  templateUrl: './users-shell.component.html',
  styleUrl: './users-shell.component.css',
})
export class UsersShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly users$: Observable<AppUser[]> = this.authService.getAllUsers();

  readonly isDialogOpen = signal(false);
  readonly qrUser = signal<AppUser | null>(null);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal(false);

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['student' as UserRole, [Validators.required]],
    studentId: [''],
  });

  openCreateDialog(): void {
    this.form.reset({
      name: '',
      email: '',
      password: '',
      role: 'student',
      studentId: '',
    });
    this.isDialogOpen.set(true);
    this.createError.set(null);
    this.createSuccess.set(false);
  }

  closeDialog(): void {
    this.isDialogOpen.set(false);
    this.form.reset();
    this.createError.set(null);
    this.createSuccess.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.createError.set(null);
    this.createSuccess.set(false);

    const formValue = this.form.getRawValue();

    try {
      await this.authService.createUser({
        name: formValue.name ?? '',
        email: formValue.email ?? '',
        password: formValue.password ?? '',
        role: formValue.role ?? 'student',
        studentId: formValue.studentId || null,
      });

      this.createSuccess.set(true);
      setTimeout(() => {
        this.closeDialog();
      }, 1500);
    } catch (error) {
      this.createError.set(
        (error as Error)?.message || 'Failed to create user account.'
      );
    }
  }

  openQrDialog(user: AppUser): void {
    this.qrUser.set(user);
  }

  closeQrDialog(): void {
    this.qrUser.set(null);
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
