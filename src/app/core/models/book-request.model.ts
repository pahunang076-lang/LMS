export type BookRequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled';

export interface BookRequest {
    id?: string;
    userId: string;
    userName: string;
    title: string;
    author?: string;
    isbn?: string;
    notes?: string;
    status: BookRequestStatus;
    requestedAt: string; // ISO
    resolvedAt?: string; // ISO – set when admin acts on it
    adminNote?: string;  // Optional note from admin
}
