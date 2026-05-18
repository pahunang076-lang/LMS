import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { QrCodeComponent } from '../../shared/qr-code.component';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, QrCodeComponent],
  template: `
    <section class="account-settings">
      <header class="account-settings__header">
        <h2>Account settings</h2>
        <p>Update your personal details for your account.</p>
      </header>
    
      @if (user$ | async; as user) {
        <div class="account-settings__card">
          <!-- Profile Picture Section -->
          <div class="account-settings__avatar-section">
            <div class="avatar-preview">
              @if (previewPicture || user.profilePicture) {
                <img [src]="previewPicture || user.profilePicture" alt="Profile Picture" class="avatar-img" />
              } @else {
                <div class="avatar-placeholder">{{ user.name.charAt(0).toUpperCase() }}</div>
              }
            </div>
            <div class="avatar-actions">
              <label class="btn btn-secondary btn-sm" for="avatar-upload">
                Change Picture
              </label>
              <input type="file" id="avatar-upload" accept="image/*" class="hidden-input" (change)="onFileSelected($event)" />
            </div>
          </div>

          <form
            [formGroup]="form"
            (ngSubmit)="onSubmit()"
            class="account-settings__form"
            >
            <div class="account-settings__row">
              <label class="account-settings__label" for="name">Name</label>
              <input
                id="name"
                type="text"
                class="account-settings__input"
                formControlName="name"
                autocomplete="name"
                placeholder="Last Name, First Name, M.I."
                />
              @if (form.controls['name'].touched && form.controls['name'].hasError('required')) {
                <span class="account-settings__message account-settings__message--error" style="display:block; margin-top:0.25rem;">Name is required.</span>
              } @else if (form.controls['name'].touched && form.controls['name'].hasError('pattern')) {
                <span class="account-settings__message account-settings__message--error" style="display:block; margin-top:0.25rem;">Format must be: Last Name, First Name, Middle Initial (e.g. Ejercito, Angel Maye E.)</span>
              }
              </div>
              <div class="account-settings__row">
                <label class="account-settings__label" for="email">Email</label>
                <input
                  id="email"
                  type="email"
                  class="account-settings__input"
                  formControlName="email"
                  autocomplete="email"
                  />
                </div>
                <div class="account-settings__row">
                  <span class="account-settings__label">Role</span>
                  <span class="account-settings__value">
                    {{ user.role | titlecase }}
                  </span>
                </div>
                <div class="account-settings__qr-section">
                  <div class="account-settings__qr-header">
                    <span class="account-settings__label">Your QR Code</span>
                    <span class="account-settings__qr-hint">
                      Use this QR code to login quickly
                    </span>
                  </div>
                  <div class="account-settings__qr-display">
                    <app-qr-code [value]="user.qrCode" type="user" [size]="180"></app-qr-code>
                    <div class="account-settings__qr-code-text">
                      {{ user.qrCode }}
                    </div>
                  </div>
                </div>
                <div class="account-settings__actions">
                  <button
                    type="submit"
                    class="btn btn-primary"
                    [disabled]="form.invalid || isSaving"
                    >
                    {{ isSaving ? 'Saving…' : 'Save changes' }}
                  </button>
                </div>
                @if (saveError) {
                  <p
                    class="account-settings__message account-settings__message--error"
                    >
                    {{ saveError }}
                  </p>
                }
                @if (saveSuccess) {
                  <p
                    class="account-settings__message account-settings__message--success"
                    >
                    Your account information has been updated.
                  </p>
                }
              </form>
            </div>
          }
        </section>
    `,
  styles: [
    `
      .account-settings {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
      }

      .account-settings__avatar-section {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1.5rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
      }

      .avatar-preview {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #e2e8f0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        flex-shrink: 0;
      }

      .avatar-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #4f46e5, #6d28d9);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: 700;
      }

      .hidden-input {
        display: none;
      }

      .account-settings__header h2 {
        margin: 0 0 0.25rem;
        font-size: 1.25rem;
      }

      .account-settings__header p {
        margin: 0;
        color: #64748b;
        font-size: 0.9rem;
      }

      .account-settings__card {
        background-color: #ffffff;
        border-radius: 0.75rem;
        padding: 1.25rem 1.5rem;
        border: 1px solid rgba(148, 163, 184, 0.35);
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .account-settings__form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .account-settings__row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        font-size: 0.95rem;
      }

      .account-settings__label {
        color: #64748b;
      }

      .account-settings__value {
        font-weight: 500;
        color: #0f172a;
      }

      .account-settings__input {
        flex: 1;
        padding: 0.4rem 0.6rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(148, 163, 184, 0.7);
        font-size: 0.95rem;
      }

      .account-settings__input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5);
      }

      .account-settings__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }

      .account-settings__message {
        margin: 0.25rem 0 0;
        font-size: 0.85rem;
      }

      .account-settings__message--error {
        color: #b91c1c;
      }

      .account-settings__message--success {
        color: #15803d;
      }

      .account-settings__qr-section {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(148, 163, 184, 0.2);
      }

      .account-settings__qr-header {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin-bottom: 1rem;
      }

      .account-settings__qr-hint {
        font-size: 0.8rem;
        color: #94a3b8;
      }

      .account-settings__qr-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
      }

      .account-settings__qr-code-text {
        font-size: 0.75rem;
        color: #64748b;
        font-family: monospace;
        word-break: break-all;
        text-align: center;
        padding: 0.5rem;
        background: rgba(148, 163, 184, 0.1);
        border-radius: 0.375rem;
        max-width: 100%;
      }
    `,
  ],
})
export class AccountSettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user$ = this.authService.currentUser$;

  form: FormGroup = this.fb.group({
    name: ['', [
      Validators.required, 
      Validators.pattern(/^[A-Za-zñÑ\s\-]+,\s*[A-Za-zñÑ\s\-\.]+$/)
    ]],
    email: ['', [Validators.required, Validators.email]],
  });

  isSaving = false;
  saveError: string | null = null;
  saveSuccess = false;
  previewPicture: string | null = null;
  selectedPictureBase64: string | null = null;

  constructor() {
    this.authService.currentUser$.pipe(take(1)).subscribe((user) => {
      if (user) {
        this.form.patchValue({
          name: user.name,
          email: user.email,
        });
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const maxDim = 200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height *= maxDim / width;
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width *= maxDim / height;
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(img, 0, 0, width, height);
             this.selectedPictureBase64 = canvas.toDataURL('image/jpeg', 0.8);
             this.previewPicture = this.selectedPictureBase64;
             
             // Automatically save the picture to Firestore so it behaves like Facebook
             try {
               await this.authService.updateCurrentUser({
                 profilePicture: this.selectedPictureBase64
               });
             } catch (err) {
               console.error('Failed to automatically save profile picture', err);
             }
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.saveError = null;
    this.saveSuccess = false;

    const { name, email } = this.form.value;

    try {
      await this.authService.updateCurrentUser({
        name: name ?? '',
        email: email ?? '',
        ...(this.selectedPictureBase64 && { profilePicture: this.selectedPictureBase64 })
      });
      this.saveSuccess = true;
    } catch (error) {
      this.saveError =
        (error as Error)?.message ||
        'Something went wrong while updating your account.';
    } finally {
      this.isSaving = false;
    }
  }
}

