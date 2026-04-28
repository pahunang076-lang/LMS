import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CanActivateFn,
  Router,
  UrlTree,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Guard that ensures the user is authenticated.
 * Redirects to `/login` if not logged in.
 */
export const authGuard: CanActivateFn = ():
  | boolean
  | UrlTree
  | Observable<boolean | UrlTree>
  | Promise<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true; // Bypass on the server during SSR
  }

  return authService.currentUser$.pipe(
    take(1),
    map((user) => {
      if (user) {
        return true;
      }

      return router.createUrlTree(['/login']);
    })
  );
};

