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
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { roles: ['admin', 'librarian'] },
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
      // The following feature routes will be implemented in later steps.
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
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

