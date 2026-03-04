import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AppUser, UserRole } from '../../core/models/user.model';
import { Observable } from 'rxjs';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, QrCodeComponent, TableModule, ProgressSpinnerModule],
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
    phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9+() -]*$')]],
    role: ['student' as UserRole, [Validators.required]],
    studentId: [''],
  });

  openCreateDialog(): void {
    this.form.reset({
      name: '',
      email: '',
      password: '',
      phoneNumber: '',
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
        phoneNumber: formValue.phoneNumber ?? '',
        role: formValue.role ?? 'student',
        studentId: formValue.studentId || null,
      });

      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      Toast.fire({
        icon: 'success',
        title: 'User created successfully.',
      });
      this.closeDialog();
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

  /** Feature 4 — Show a printable ID card in a Swal modal */
  viewIdCard(user: AppUser): void {
    const roleColors: Record<string, string> = {
      admin: '#4f46e5',
      librarian: '#0ea5e9',
      student: '#059669',
    };
    const roleColor = roleColors[user.role] ?? '#6b7280';
    const initials = this.getInitials(user.name);

    const html = `
      <div id="lms-id-card" style="
        font-family:'Segoe UI',system-ui,sans-serif;
        background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%);
        border-radius:16px; padding:28px 24px 20px; color:#fff;
        max-width:340px; margin:0 auto; position:relative; overflow:hidden;
        box-shadow:0 20px 60px rgba(67,56,202,0.5);">

        <!-- Watermark circles -->
        <div style="position:absolute;top:-30px;right:-30px;width:150px;height:150px;
          border-radius:50%;background:rgba(255,255,255,0.05);"></div>
        <div style="position:absolute;bottom:-40px;left:-20px;width:120px;height:120px;
          border-radius:50%;background:rgba(255,255,255,0.04);"></div>

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
          <div style="width:36px;height:36px;background:rgba(255,255,255,0.15);
            border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;">📚</div>
          <div>
            <div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;
              opacity:0.7;line-height:1.2">Library Management System</div>
            <div style="font-size:9px;opacity:0.5">Student / Staff Identification Card</div>
          </div>
        </div>

        <!-- Avatar + Info -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
          <div style="width:64px;height:64px;border-radius:50%;flex-shrink:0;
            background:${roleColor};display:flex;align-items:center;justify-content:center;
            font-size:22px;font-weight:700;border:3px solid rgba(255,255,255,0.3);">
            ${initials}
          </div>
          <div style="min-width:0;">
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:3px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.name}</div>
            <div style="font-size:0.78rem;opacity:0.75;margin-bottom:6px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${user.email}</div>
            <span style="display:inline-block;background:${roleColor};
              border-radius:999px;padding:2px 10px;font-size:0.72rem;font-weight:600;">
              ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
          </div>
        </div>

        <!-- Details grid -->
        <div style="background:rgba(255,255,255,0.08);border-radius:10px;
          padding:12px 14px;display:grid;gap:8px;margin-bottom:16px;">
          ${user.studentId ? `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
            <span style="opacity:0.6">Student ID</span>
            <span style="font-weight:600">${user.studentId}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
            <span style="opacity:0.6">Status</span>
            <span style="font-weight:600;color:${user.isActive !== false ? '#34d399' : '#f87171'}">
              ${user.isActive !== false ? '● Active' : '● Inactive'}
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
            <span style="opacity:0.6">Issued</span>
            <span style="font-weight:600">${new Date().toLocaleDateString()}</span>
          </div>
        </div>

        <!-- QR code label -->
        <div style="background:rgba(255,255,255,0.06);border-radius:8px;
          padding:8px 12px;font-size:0.7rem;text-align:center;">
          <div style="opacity:0.5;margin-bottom:2px;letter-spacing:0.06em;text-transform:uppercase;font-size:9px">QR Code</div>
          <div style="font-family:monospace;opacity:0.8;word-break:break-all;font-size:0.68rem;">${user.qrCode ?? 'N/A'}</div>
        </div>
      </div>
    `;

    Swal.fire({
      title: '🪪 Student ID Card',
      html,
      showCancelButton: true,
      confirmButtonText: '🖨️ Print Card',
      cancelButtonText: 'Close',
      confirmButtonColor: '#4f46e5',
      width: 420,
    }).then((result) => {
      if (result.isConfirmed) {
        const win = window.open('', '_blank', 'width=420,height=600');
        if (win) {
          win.document.write(`<html><head><title>LMS ID Card</title>
            <style>body{margin:16px;background:#1e1b4b;} @media print{body{margin:0;}}</style>
            </head><body>${html}
            <script>window.onload=()=>window.print();<\/script></body></html>`);
          win.document.close();
        }
      }
    });
  }
}
