import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnnouncementService } from '../../core/services/announcement.service';
import { AuthService } from '../../core/services/auth.service';
import { map, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-announcements-shell',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './announcements-shell.component.html',
    styleUrl: './announcements-shell.component.css'
})
export class AnnouncementsShellComponent {
    private readonly announcementService = inject(AnnouncementService);
    private readonly authService = inject(AuthService);

    readonly announcements$ = this.announcementService.announcements$;
    readonly user$ = this.authService.currentUser$;
    readonly isAdminOrLibrarian$ = this.user$.pipe(map(u => u?.role === 'admin' || u?.role === 'librarian'));

    newTitle = '';
    newBody = '';

    async postAnnouncement(): Promise<void> {
        if (!this.newTitle.trim() || !this.newBody.trim()) return;

        const user = await firstValueFrom(this.user$);

        await this.announcementService.createAnnouncement({
            title: this.newTitle.trim(),
            body: this.newBody.trim(),
            createdBy: user?.name || 'Admin'
        });

        this.newTitle = '';
        this.newBody = '';

        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
        }).fire({ icon: 'success', title: 'Announcement posted!' });
    }

    async deleteAnnouncement(id: string): Promise<void> {
        const res = await Swal.fire({
            title: 'Delete this announcement?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, delete it!'
        });

        if (res.isConfirmed) {
            await this.announcementService.deleteAnnouncement(id);
            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            }).fire({ icon: 'success', title: 'Deleted successfully.' });
        }
    }
}
