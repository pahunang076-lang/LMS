import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { BookRequest, BookRequestStatus } from '../../core/models/book-request.model';

const JSON_SERVER_URL = 'http://localhost:3000';
const STORAGE_KEY = 'lms_book_requests';

@Injectable({ providedIn: 'root' })
export class BookRequestService {
    private readonly http = inject(HttpClient);
    private readonly platformId = inject(PLATFORM_ID);

    private readonly subject = new BehaviorSubject<BookRequest[]>(this.loadLocal());

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.http.get<BookRequest[]>(`${JSON_SERVER_URL}/bookRequests`).subscribe({
                next: (data) => { if (data?.length) { this.saveLocal(data); this.subject.next(data); } },
                error: () => { },
            });
        }
    }

    getAll$(): Observable<BookRequest[]> {
        return this.subject.asObservable();
    }

    getForUser$(userId: string): Observable<BookRequest[]> {
        return new Observable((obs) =>
            this.subject.subscribe((items) => obs.next(items.filter((r) => r.userId === userId)))
        );
    }

    async create(req: Omit<BookRequest, 'id'>): Promise<void> {
        const id = `req-${Date.now()}`;
        const full: BookRequest = { ...req, id };
        const updated = [...this.subject.value, full];
        this.saveLocal(updated);
        this.subject.next(updated);
        if (isPlatformBrowser(this.platformId)) {
            this.http.post(`${JSON_SERVER_URL}/bookRequests`, full).subscribe({ error: () => { } });
        }
    }

    async updateStatus(req: BookRequest, status: BookRequestStatus, adminNote?: string): Promise<void> {
        const resolvedAt = new Date().toISOString();
        const updated = this.subject.value.map((r) =>
            r.id === req.id ? { ...r, status, resolvedAt, adminNote: adminNote ?? r.adminNote } : r
        );
        this.saveLocal(updated);
        this.subject.next(updated);
        if (isPlatformBrowser(this.platformId) && req.id) {
            this.http.patch(`${JSON_SERVER_URL}/bookRequests/${req.id}`, { status, resolvedAt, adminNote })
                .subscribe({ error: () => { } });
        }
    }

    private loadLocal(): BookRequest[] {
        if (typeof window === 'undefined') return [];
        try { return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]'); }
        catch { return []; }
    }

    private saveLocal(items: BookRequest[]): void {
        if (typeof window !== 'undefined')
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
}
