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
    const roleLabel =
      user.role === 'student'
        ? 'Student'
        : user.role === 'admin'
        ? 'Admin'
        : 'Staff';
    const initials = this.getInitials(user.name);

    const html = `
      <div id="lms-id-card" style="
        font-family:'Segoe UI',system-ui,sans-serif;
        background:#f9fafb;
        border-radius:18px;
        padding:20px 22px 18px;
        color:#111827;
        max-width:360px;
        margin:0 auto;
        position:relative;
        overflow:hidden;
        box-shadow:0 18px 40px rgba(15,23,42,0.20);
        border:1px solid #e5e7eb;">

        <div style="position:absolute;inset:0;
          background:radial-gradient(circle at 0 0,rgba(79,70,229,0.08),transparent 50%),
                     radial-gradient(circle at 100% 100%,rgba(16,185,129,0.06),transparent 55%);
          pointer-events:none;"></div>

        <!-- Top header strip -->
        <div style="position:relative;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:34px;height:34px;border-radius:10px;
              background:linear-gradient(135deg,#4f46e5,#6366f1);
              display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">📚</div>
            <div>
              <div style="font-size:10px;letter-spacing:0.16em;text-transform:uppercase;
                color:#6b7280;font-weight:600;">Library Management System</div>
              <div style="font-size:9px;color:#9ca3af;">${roleLabel} ID Card</div>
            </div>
          </div>
          <div style="font-size:10px;color:#6b7280;text-align:right;">
            <div style="text-transform:uppercase;letter-spacing:0.12em;">ID No.</div>
            <div style="font-weight:700;color:#111827;white-space:nowrap;">
              ${user.studentId || 'N/A'}
            </div>
          </div>
        </div>

        <!-- Main content row -->
        <div style="position:relative;display:grid;grid-template-columns:92px 1fr;gap:14px;margin-bottom:14px;align-items:center;">
          <div style="width:92px;height:92px;border-radius:16px;overflow:hidden;
            background:linear-gradient(135deg,${roleColor},#4b5563);
            display:flex;align-items:center;justify-content:center;
            color:#fff;font-size:28px;font-weight:700;
            box-shadow:0 10px 25px rgba(15,23,42,0.35);">
            ${initials}
          </div>
          <div style="min-width:0;">
            <div style="font-size:1.1rem;font-weight:700;margin-bottom:4px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111827;">
              ${user.name}
            </div>
            <div style="font-size:0.8rem;color:#4b5563;margin-bottom:6px;
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${user.email}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
              <span style="display:inline-block;background:${roleColor};
                color:#ffffff;border-radius:999px;padding:2px 10px;
                font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">
                ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
              <span style="font-size:0.74rem;font-weight:600;
                color:${user.isActive !== false ? '#16a34a' : '#dc2626'};">
                ${user.isActive !== false ? '● Active' : '● Inactive'}
              </span>
            </div>
          </div>
        </div>

        <!-- Details + QR row -->
        <div style="position:relative;display:grid;grid-template-columns:1.4fr 1fr;gap:10px;">
          <div style="background:#f3f4f6;border-radius:10px;padding:10px 12px;display:grid;gap:6px;">
            ${user.studentId ? `
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
              <span style="color:#6b7280;">Student ID</span>
              <span style="font-weight:600;color:#111827;">${user.studentId}</span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
              <span style="color:#6b7280;">Phone</span>
              <span style="font-weight:500;color:#111827;">
                ${user.phoneNumber || '—'}
              </span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;">
              <span style="color:#6b7280;">Issued</span>
              <span style="font-weight:500;color:#111827;">
                ${new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
          <div style="background:#eef2ff;border-radius:10px;padding:8px 8px 6px;
            display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
            <div style="font-size:8px;text-transform:uppercase;letter-spacing:0.16em;
              color:#4f46e5;font-weight:600;">QR Code</div>
            <div style="width:96px;height:96px;border-radius:8px;background:#ffffff;
              display:flex;align-items:center;justify-content:center;margin-bottom:2px;overflow:hidden;">
              ${
                user.qrCode
                  ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                      user.qrCode
                    )}" alt="QR code" style="width:90%;height:90%;object-fit:contain;" />`
                  : '<span style="font-size:10px;color:#9ca3af;">No QR</span>'
              }
            </div>
            <div style="font-family:monospace;font-size:0.62rem;color:#1f2937;
              text-align:center;word-break:break-all;max-width:130px;">
              ${user.qrCode ?? 'N/A'}
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="position:relative;margin-top:10px;padding-top:8px;
          border-top:1px dashed #e5e7eb;font-size:0.7rem;
          display:flex;justify-content:space-between;align-items:center;color:#6b7280;">
          <span>Property of LMS Library</span>
          <span>ID valid while enrollment is active</span>
        </div>
      </div>
    `;

    Swal.fire({
      title: `🪪 ${roleLabel} ID Card`,
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
