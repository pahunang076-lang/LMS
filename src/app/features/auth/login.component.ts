import { Component, inject, signal } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { QrScannerComponent } from '../../shared/qr-scanner.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrScannerComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  animations: [
    trigger('modeTransition', [
      transition('login => reset', [
        style({ opacity: 0, transform: 'translateX(16px)' }),
        animate(
          '220ms ease-out',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
      transition('reset => login', [
        style({ opacity: 0, transform: 'translateX(-16px)' }),
        animate(
          '220ms ease-out',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ]),
    ]),
  ],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  showPassword = false;
  readonly loginMode = signal<'email' | 'qr'>('email');
  isResetPasswordMode = false;

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly isLoading = this.authService.isLoading;
  readonly error = this.authService.error;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    if (!email || !password) {
      return;
    }

    try {
      await this.authService.login(email, password);
      const user = await firstValueFrom(this.authService.currentUser$);
      await this.authService.redirectAfterLogin(user ?? null);
    } catch {
      // Error is already stored in the auth service signal.
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  goToForgotPassword(): void {
    this.isResetPasswordMode = true;
    this.resetForm.reset();
  }

  cancelResetPassword(): void {
    this.isResetPasswordMode = false;
    this.resetForm.reset();
  }

  async submitResetPassword(): Promise<void> {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { email } = this.resetForm.getRawValue();
    if (!email) {
      return;
    }

    try {
      await this.authService.resetPassword(email);
      this.isResetPasswordMode = false;
      this.resetForm.reset();
    } catch {
      // Error handling is managed in the auth service
    }
  }

  setLoginMode(mode: 'email' | 'qr'): void {
    // Clear any persisted error (e.g., QR scan errors) when switching modes
    this.authService.clearError();
    this.loginMode.set(mode);
    this.form.reset();
  }

  async onQrScanned(qrCode: string): Promise<void> {
    try {
      await this.authService.loginWithQrCode(qrCode);
      const user = await firstValueFrom(this.authService.currentUser$);
      await this.authService.redirectAfterLogin(user ?? null);
    } catch {
      // Error is already stored in the auth service signal.
    }
  }

  onQrScanError(error: string): void {
    // Errors are handled by the auth service
    console.error('QR scan error:', error);
  }
}
