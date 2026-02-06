import { inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/user.model';

/**
 * Guard that enforces role-based access.
 * Expected to be used with route data: { roles: ['admin', 'librarian'] }.
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
):
  | boolean
  | UrlTree
  | Observable<boolean | UrlTree>
  | Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles =
    (route.data?.['roles'] as UserRole[] | undefined) ?? [];

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (!user) {
        return router.createUrlTree(['/login']);
      }

      if (!allowedRoles.length || allowedRoles.includes(user.role)) {
        return true;
      }

      // If user is logged in but not allowed, send them to a safe default.
      return router.createUrlTree(['/catalog']);
    })
  );
};

