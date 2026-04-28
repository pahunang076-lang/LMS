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
import { UserHistoryModalComponent } from './user-history-modal.component';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-users-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, QrCodeComponent, TableModule, ProgressSpinnerModule, UserHistoryModalComponent],
  templateUrl: './users-shell.component.html',
  styleUrl: './users-shell.component.css',
})
export class UsersShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly users$: Observable<AppUser[]> = this.authService.getAllUsers();

  readonly isDialogOpen = signal(false);
  readonly qrUser = signal<AppUser | null>(null);
  readonly isHistoryOpen = signal(false);
  readonly historyUser = signal<AppUser | null>(null);
  readonly createError = signal<string | null>(null);
  readonly createSuccess = signal(false);
  readonly editingUser = signal<AppUser | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phoneNumber: ['', [Validators.required, Validators.pattern('^[0-9+() -]*$')]],
    role: ['student' as UserRole, [Validators.required]],
    studentId: [''],
  });

  get isEditing(): boolean {
    return this.editingUser() !== null;
  }

  openCreateDialog(): void {
    this.form.reset({
      name: '',
      email: '',
      password: '',
      phoneNumber: '',
      role: 'student',
      studentId: '',
    });
    this.editingUser.set(null);
    // When creating, email and password are required
    this.form.controls.email.enable();
    this.form.controls.password.enable();
    this.isDialogOpen.set(true);
    this.createError.set(null);
    this.createSuccess.set(false);
  }

  openEditDialog(user: AppUser): void {
    this.editingUser.set(user);
    this.form.reset({
      name: user.name,
      email: user.email,
      password: '', // Password is not editable through this form
      phoneNumber: user.phoneNumber,
      role: user.role,
      studentId: user.studentId || '',
    });
    // Email and Password cannot be changed in this specific edit flow
    this.form.controls.email.disable();
    this.form.controls.password.disable();
    this.isDialogOpen.set(true);
    this.createError.set(null);
    this.createSuccess.set(false);
  }

  closeDialog(): void {
    this.isDialogOpen.set(false);
    this.editingUser.set(null);
    this.form.reset();
    this.form.controls.email.enable();
    this.form.controls.password.enable();
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
      if (this.isEditing) {
        const user = this.editingUser()!;
        await this.authService.adminUpdateUser(user.uid, {
          name: formValue.name ?? '',
          phoneNumber: formValue.phoneNumber ?? '',
          role: formValue.role ?? 'student',
          studentId: formValue.studentId || null,
        });
      } else {
        await this.authService.createUser({
          name: formValue.name ?? '',
          email: formValue.email ?? '',
          password: formValue.password ?? '',
          phoneNumber: formValue.phoneNumber ?? '',
          role: formValue.role ?? 'student',
          studentId: formValue.studentId || null,
        });
      }

      this.closeDialog();
    } catch (error) {
      this.createError.set(
        (error as Error)?.message || (this.isEditing ? 'Failed to update user account.' : 'Failed to create user account.')
      );
    }
  }

  async toggleActive(user: AppUser): Promise<void> {
    const action = user.isActive !== false ? 'deactivate' : 'reactivate';
    const result = await Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User?`,
      text: `Are you sure you want to ${action} ${user.name}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Yes, ${action}`,
      cancelButtonText: 'Cancel',
      confirmButtonColor: user.isActive !== false ? '#d33' : '#10b981',
      cancelButtonColor: '#6c757d',
    });

    if (result.isConfirmed) {
      await this.authService.toggleUserStatus(user.uid, user.isActive === false);
    }
  }

  openQrDialog(user: AppUser): void {
    this.qrUser.set(user);
  }

  closeQrDialog(): void {
    this.qrUser.set(null);
  }

  async downloadQr(user: AppUser): Promise<void> {
    try {
      const zxing = await import('@zxing/library');
      const { QRCodeWriter, EncodeHintType, BarcodeFormat } = zxing;

      const hints = new Map();
      hints.set(EncodeHintType.MARGIN, 0);
      hints.set(EncodeHintType.ERROR_CORRECTION, 'M');

      const writer = new QRCodeWriter();
      const size = 500; // Higher resolution for downloading
      const bitMatrix = writer.encode(
        user.qrCode,
        BarcodeFormat.QR_CODE,
        size,
        size,
        hints
      );

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Draw QR Code
      ctx.fillStyle = '#000000';
      const width = bitMatrix.getWidth();
      const height = bitMatrix.getHeight();
      const cellSize = Math.min(size / width, size / height);

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (bitMatrix.get(x, y)) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }

      // Trigger download
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `QR_${user.studentId || user.uid.substring(0,6)}_${user.name.replace(/\s+/g, '')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download QR code', err);
      Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: 'Failed to generate the high-resolution QR code image. Please try again.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000
      });
    }
  }

  openHistory(user: AppUser): void {
    this.historyUser.set(user);
    this.isHistoryOpen.set(true);
  }

  closeHistory(): void {
    this.historyUser.set(null);
    this.isHistoryOpen.set(false);
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
      <style>
        #lms-id-card-wrapper {
          background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%);
          padding: 24px;
          border-radius: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        #lms-id-card {
          box-sizing: border-box;
          width: 380px; 
          height: 240px;
          border-radius: 12px;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          color: #ffffff;
          font-family: 'Segoe UI', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .id-body {
          display: flex; gap: 20px; flex: 1; align-items: center; margin: 16px 0; z-index: 1;
        }
        .id-avatar {
          width: 84px; height: 84px; border-radius: 12px;
          background: linear-gradient(135deg, ${roleColor}, #374151);
          color: #fff; font-size: 32px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 16px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          position: relative; overflow: hidden;
          flex-shrink: 0;
        }
        .id-qr {
          width: 72px; height: 72px;
          background: rgba(255,255,255,0.9);
          border-radius: 8px; padding: 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          border: 1px solid rgba(255,255,255,0.4);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .id-name {
          font-size: 20px; font-weight: 800; line-height: 1.1; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .id-role-badge {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          color: #fff; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          padding: 4px 12px; border-radius: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          white-space: nowrap;
        }
        .id-info-label {
          font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.6);
        }
        .id-info-value {
          font-size: 11px; font-weight: 600; font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .id-info-email {
          font-size: 10px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;
        }
        
        @media screen and (max-width: 480px) {
          #lms-id-card-wrapper {
            padding: 16px !important;
          }
          #lms-id-card {
            width: 100% !important;
            height: auto !important;
            min-height: 200px;
            padding: 12px 14px !important;
          }
          .id-body {
            gap: 12px !important;
            margin: 12px 0 !important;
          }
          .id-avatar {
            width: 60px !important; height: 60px !important; font-size: 24px !important;
          }
          .id-role-badge {
            font-size: 8px !important; padding: 3px 8px !important;
          }
          .id-qr {
            width: 54px !important; height: 54px !important; padding: 3px !important;
          }
          .id-name {
            font-size: 16px !important;
          }
          .id-info-value {
            font-size: 10px !important;
          }
          .id-info-email {
            font-size: 9px !important;
          }
        }
      </style>
      <div id="lms-id-card-wrapper">
        <div id="lms-id-card">
          <!-- Glass Highlight -->
          <div style="position:absolute; top:0; left:-100%; width:50%; height:200%; background: linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%); transform: rotate(30deg); pointer-events:none;"></div>

          <!-- Header (Top Row) -->
          <div style="display: flex; align-items: center; gap: 8px; z-index: 1;">
            <div style="width: 24px; height: 24px; border-radius: 6px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px;">📚</div>
            <div style="font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">Library Management System</div>
          </div>

          <!-- Body (Two Columns) -->
          <div class="id-body">
            
            <!-- Left Side: Profile Picture and Badge -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
              <div class="id-avatar">
                ${initials}
                <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 50%; background: linear-gradient(to bottom, rgba(255,255,255,0.15), transparent);"></div>
              </div>
              <div class="id-role-badge">
                ${roleLabel}
              </div>
            </div>

            <!-- Right Side: Name, ID Number, Email, QR Code -->
            <div style="flex: 1; display: flex; align-items: center; justify-content: space-between; height: 100%; min-width: 0;">
              
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; padding-right: 8px;">
                <div>
                  <div class="id-name">
                    ${user.name}
                  </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                  <div>
                    <div class="id-info-label">ID Number</div>
                    <div class="id-info-value">${user.studentId || 'N/A'}</div>
                  </div>
                  <div>
                    <div class="id-info-label">Email</div>
                    <div class="id-info-email">${user.email}</div>
                  </div>
                </div>
              </div>

              <div class="id-qr">
                ${
                  user.qrCode
                    ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                        user.qrCode
                      )}" alt="QR code" style="width:100%;height:100%;object-fit:contain; border-radius: 4px;" />`
                    : '<div style="font-size:10px;color:#9ca3af;text-transform:uppercase;font-weight:bold;">No QR</div>'
                }
              </div>

            </div>

          </div>

          <!-- Footer -->
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 7px; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.6); z-index: 1;">
            <div>Property of LMS</div>
            <div>Validity: ${user.isActive !== false ? 'Active' : 'Inactive'}</div>
          </div>

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
      width: 480,
    }).then((result) => {
      if (result.isConfirmed) {
        const win = window.open('', '_blank', 'width=520,height=600');
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
