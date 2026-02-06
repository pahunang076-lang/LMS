export type BookStatus = 'available' | 'unavailable';

export interface Book {
  id?: string;
  title: string;
  author: string;
  category: string;
  isbn: string;
  quantityTotal: number;
  quantityAvailable: number;
  status: BookStatus;
  description?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

