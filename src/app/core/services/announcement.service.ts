import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { Announcement } from '../models/announcement.model';
import { collection, doc, Firestore, getDocs, setDoc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';
import { environment as envProd } from '../../../environments/environment.prod';

const JSON_SERVER_URL = 'http://localhost:3000';
const STORAGE_KEY = 'lms.announcements';

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    // Conditionally inject Firestore (since Firebase is deferred, this might throw if not provided, so we wrap it)
    private firestore: Firestore | null = null;

    private announcementsSubj = new BehaviorSubject<Announcement[]>([]);
    readonly announcements$ = this.announcementsSubj.asObservable();

    private useLocalStore = false;

    constructor() {
        try {
            this.firestore = inject(Firestore, { optional: true });
        } catch {
            this.firestore = null;
        }

        // Fallback to local storage/JSON Server if no Firebase config
        this.useLocalStore = !environment.firebase || Object.keys(environment.firebase).length === 0 || !this.firestore;

        this.loadAnnouncements();
    }

    private async loadAnnouncements(): Promise<void> {
        if (this.useLocalStore) {
            if (isPlatformBrowser(this.platformId)) {
                const localData = window.localStorage.getItem(STORAGE_KEY);
                if (localData) {
                    try {
                        this.announcementsSubj.next(JSON.parse(localData));
                    } catch { }
                }

                // Try JSON server sync
                this.http.get<Announcement[]>(`${JSON_SERVER_URL}/announcements`).subscribe({
                    next: (data) => {
                        this.announcementsSubj.next(data);
                        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                    },
                    error: () => { } // Silent fallback
                });
            }
            return;
        }

        if (this.firestore) {
            const colRef = collection(this.firestore, 'announcements');
            try {
                const snap = await getDocs(colRef);
                const announcements = snap.docs.map(doc => doc.data() as Announcement);
                announcements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.announcementsSubj.next(announcements);
            } catch (e) {
                console.error('Failed to load announcements from Firestore', e);
            }
        }
    }

    async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<void> {
        const newAnnouncement: Announcement = {
            ...announcement,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString()
        };

        if (this.useLocalStore) {
            const current = [newAnnouncement, ...this.announcementsSubj.value];
            this.announcementsSubj.next(current);
            if (isPlatformBrowser(this.platformId)) {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
                this.http.post(`${JSON_SERVER_URL}/announcements`, newAnnouncement).subscribe({ error: () => { } });
            }
            return;
        }

        if (this.firestore) {
            const docRef = doc(this.firestore, 'announcements', newAnnouncement.id);
            await setDoc(docRef, newAnnouncement);
            this.loadAnnouncements(); // Refresh
        }
    }

    async deleteAnnouncement(id: string): Promise<void> {
        if (this.useLocalStore) {
            const filtered = this.announcementsSubj.value.filter(a => a.id !== id);
            this.announcementsSubj.next(filtered);
            if (isPlatformBrowser(this.platformId)) {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
                this.http.delete(`${JSON_SERVER_URL}/announcements/${id}`).subscribe({ error: () => { } });
            }
            return;
        }

        if (this.firestore) {
            const docRef = doc(this.firestore, 'announcements', id);
            await deleteDoc(docRef);
            this.loadAnnouncements(); // Refresh
        }
    }
}
