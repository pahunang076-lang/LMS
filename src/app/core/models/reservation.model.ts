export type ReservationStatus = 'pending' | 'ready' | 'cancelled' | 'fulfilled';

export interface Reservation {
    id?: string;
    userId: string;
    userName: string;
    bookId: string;
    bookTitle: string;
    reservedAt: unknown;
    status: ReservationStatus;
    _queuePosition?: number;
}
