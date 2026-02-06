import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly sidebarCollapsedStorageKey = 'lms.sidebarCollapsed';

  readonly currentUser$ = this.authService.currentUser$;

  readonly isAdminOrLibrarian$ = this.authService.hasRole([
    'admin',
    'librarian',
  ]);

  readonly isStudent$ = this.authService.hasRole(['student']);

  readonly isLoading = computed(() => this.authService.isLoading());

  @ViewChild('userMenuRef') userMenuRef?: ElementRef<HTMLElement>;

  sidebarOpen = false;
  sidebarCollapsed = false;
  userMenuOpen = false;

  constructor() {
    this.sidebarCollapsed =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(this.sidebarCollapsedStorageKey) === '1';
  }

  async logout(): Promise<void> {
    await this.authService.logout();
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  closeUserMenu(): void {
    this.userMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen || !this.userMenuRef) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.userMenuRef.nativeElement.contains(target)) {
      this.userMenuOpen = false;
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  toggleSidebarCollapsed(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        this.sidebarCollapsedStorageKey,
        this.sidebarCollapsed ? '1' : '0',
      );
    }
  }
}

