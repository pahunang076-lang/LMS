export interface Announcement {
    id: string;
    title: string;
    body: string;
    createdAt: string; // ISO timestamp
    createdBy: string; // Admin's User ID or Name
}
