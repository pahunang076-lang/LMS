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

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="account-settings">
      <header class="account-settings__header">
        <h2>Account settings</h2>
        <p>Update your personal details for your account.</p>
      </header>

      <div class="account-settings__card" *ngIf="user$ | async as user">
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
            />
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

          <div class="account-settings__actions">
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="form.invalid || isSaving"
            >
              {{ isSaving ? 'Saving…' : 'Save changes' }}
            </button>
          </div>

          <p
            *ngIf="saveError"
            class="account-settings__message account-settings__message--error"
          >
            {{ saveError }}
          </p>

          <p
            *ngIf="saveSuccess"
            class="account-settings__message account-settings__message--success"
          >
            Your account information has been updated.
          </p>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .account-settings {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
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
    `,
  ],
})
export class AccountSettingsComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user$ = this.authService.currentUser$;

  form: FormGroup = this.fb.group({
    name: [''],
    email: ['', [Validators.required, Validators.email]],
  });

  isSaving = false;
  saveError: string | null = null;
  saveSuccess = false;

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

