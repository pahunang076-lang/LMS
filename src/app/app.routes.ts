import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login.component';
import { MainLayoutComponent } from './layout/main-layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CatalogComponent } from './features/catalog/catalog.component';
import { AccountSettingsComponent } from './features/auth/account-settings.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard-redirect.component').then(m => m.DashboardRedirectComponent)
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
      },
      {
        path: 'student-home',
        canActivate: [roleGuard],
        data: { roles: ['student'] },
        loadComponent: () =>
          import('./features/dashboard/student-dashboard.component').then(
            (m) => m.StudentDashboardComponent
          ),
      },
      {
        path: 'catalog',
        component: CatalogComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
      },
      {
        path: 'account',
        component: AccountSettingsComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
        loadComponent: () =>
          import('./features/users/users-shell.component').then(
            (m) => m.UsersShellComponent
          ),
      },
      // The following feature routes will be implemented in later steps.
      {
        path: 'fines',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
        loadComponent: () =>
          import('./features/fines/fines-shell.component').then(
            (m) => m.FinesShellComponent
          ),
      },
      {
        path: 'books',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
        loadComponent: () =>
          import('./features/books/books-shell.component').then(
            (m) => m.BooksShellComponent
          ),
      },
      {
        path: 'circulation',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
        loadComponent: () =>
          import('./features/circulation/circulation-shell.component').then(
            (m) => m.CirculationShellComponent
          ),
      },
      {
        path: 'entry-logs',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
        loadComponent: () =>
          import('./features/entry-logs/entry-logs-shell.component').then(
            (m) => m.EntryLogsShellComponent
          ),
      },
      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
        loadComponent: () =>
          import('./features/reports/reports-shell.component').then(
            (m) => m.ReportsShellComponent
          ),
      },
      {
        path: 'reservations',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
        loadComponent: () =>
          import('./features/reservations/reservations-shell.component').then(
            (m) => m.ReservationsShellComponent
          ),
      },
      {
        path: 'book-requests',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
        loadComponent: () =>
          import('./features/book-requests/book-requests-shell.component').then(
            (m) => m.BookRequestsShellComponent
          ),
      },
      {
        path: 'profile/:uid',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
        loadComponent: () =>
          import('./features/users/student-profile.component').then(
            (m) => m.StudentProfileComponent
          ),
      },
      {
        path: 'announcements',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
        loadComponent: () =>
          import('./features/announcements/announcements-shell.component').then(
            (m) => m.AnnouncementsShellComponent
          ),
      },
      {
        path: 'my-profile',
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian', 'student'] },
        loadComponent: () =>
          import('./features/profile/my-profile.component').then(
            (m) => m.MyProfileComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

