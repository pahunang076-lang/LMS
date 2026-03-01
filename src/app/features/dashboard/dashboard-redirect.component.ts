import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * A simple component that redirects the user to the appropriate dashboard
 * based on their role upon visiting the root url ('/').
 */
@Component({
    selector: 'app-dashboard-redirect',
    standalone: true,
    template: ''
})
export class DashboardRedirectComponent implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);

    ngOnInit() {
        this.auth.currentUser$.subscribe(user => {
            if (user?.role === 'admin' || user?.role === 'librarian') {
                this.router.navigate(['/dashboard'], { replaceUrl: true });
            } else {
                this.router.navigate(['/student-home'], { replaceUrl: true });
            }
        });
    }
}
