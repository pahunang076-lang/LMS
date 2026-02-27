import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly sidebarCollapsedStorageKey = 'lms.sidebarCollapsed';

  readonly currentUser$ = this.authService.currentUser$;

  readonly isAdminOrLibrarian$ = this.authService.hasRole([
    'admin',
    'librarian',
  ]);

  readonly isAdmin$ = this.authService.hasRole(['admin']);

  readonly isStudent$ = this.authService.hasRole(['student']);

  readonly isLoading = computed(() => this.authService.isLoading());

  @ViewChild('userMenuRef') userMenuRef?: ElementRef<HTMLElement>;

  sidebarOpen = false;
  sidebarCollapsed = false;
  userMenuOpen = false;
  isDarkMode = false;
  private readonly destroy$ = new Subject<void>();
  private currentUserId: string | null = null;

  constructor() {
    this.sidebarCollapsed =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(this.sidebarCollapsedStorageKey) === '1';
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.currentUser$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
        if (user) {
          this.currentUserId = user.uid || (user as any).id;
          const key = `lms.darkMode.${this.currentUserId}`;
          const isDark = window.localStorage.getItem(key) === '1';
          this.isDarkMode = isDark;

          if (isDark) {
            document.documentElement.classList.add('dark-mode');
          } else {
            document.documentElement.classList.remove('dark-mode');
          }
        } else {
          this.currentUserId = null;
          this.isDarkMode = false;
          document.documentElement.classList.remove('dark-mode');
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDarkMode(): void {
    if (typeof window !== 'undefined' && this.currentUserId) {
      const html = document.documentElement;
      html.classList.toggle('dark-mode');
      this.isDarkMode = html.classList.contains('dark-mode');

      const key = `lms.darkMode.${this.currentUserId}`;
      window.localStorage.setItem(key, this.isDarkMode ? '1' : '0');
    }
  }

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark-mode');
      this.isDarkMode = false;
    }
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

