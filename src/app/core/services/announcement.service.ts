import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { Announcement } from '../models/announcement.model';
import { collection, doc, Firestore, getDocs, setDoc, deleteDoc } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

const STORAGE_KEY = 'lms.announcements';

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
    private readonly firestore = inject(Firestore);
    private readonly auth = inject(Auth, { optional: true });
    private readonly platformId = inject(PLATFORM_ID);

    private announcementsSubj = new BehaviorSubject<Announcement[]>([]);
    readonly announcements$ = this.announcementsSubj.asObservable();

    constructor() {
        this.watchAuthAndReload();
    }

    private watchAuthAndReload(): void {
        if (!this.auth || !isPlatformBrowser(this.platformId)) {
            return;
        }
        // Auth state resolves asynchronously — always wait for it before loading Firestore data.
        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                this.loadAnnouncementsFromFirestore();
            } else {
                // Clear announcements when logged out
                this.announcementsSubj.next([]);
            }
        });
    }

    private async loadAnnouncementsFromFirestore(): Promise<void> {
        const colRef = collection(this.firestore, 'announcements');
        try {
            const snap = await getDocs(colRef);
            const announcements = snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
            announcements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            this.announcementsSubj.next(announcements);
        } catch (e) {
            console.error('Failed to load announcements from Firestore', e);
        }
    }

    async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<void> {
        const newAnnouncement: Announcement = {
            ...announcement,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        };

        const docRef = doc(this.firestore, 'announcements', newAnnouncement.id);
        await setDoc(docRef, newAnnouncement);
        await this.loadAnnouncementsFromFirestore(); // Refresh
    }

    async deleteAnnouncement(id: string): Promise<void> {
        const docRef = doc(this.firestore, 'announcements', id);
        await deleteDoc(docRef);
        await this.loadAnnouncementsFromFirestore(); // Refresh
    }
}
