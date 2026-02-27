import { Component, inject, signal } from '@angular/core';
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
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  showPassword = false;
  readonly loginMode = signal<'email' | 'qr'>('email');

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
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
    this.router.navigate(['/forgot-password']);
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
