import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BooksService } from '../books/books.service';
import { AuthService } from '../../core/services/auth.service';
import { ReservationService } from '../reservations/reservation.service';
import { Book, BookStatus } from '../../core/models/book.model';
import { Observable, combineLatest, map, firstValueFrom } from 'rxjs';
import { FilterBooksPipe } from '../../shared/filter-books.pipe';
import { CirculationService } from '../../features/circulation/circulation.service';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FilterBooksPipe, TableModule, DialogModule],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css',
})
export class CatalogComponent {
  private readonly booksService = inject(BooksService);
  private readonly authService = inject(AuthService);
  private readonly reservationService = inject(ReservationService);
  private readonly circulationService = inject(CirculationService);

  readonly books$: Observable<Book[]> = combineLatest([
    this.booksService.getAllBooks$(),
    this.circulationService.getAllBorrows$()
  ]).pipe(
    map(([books, borrows]) => {
      return books.map((book) => {
        const bookBorrows = borrows.filter(b => (b.bookId === book.id || b.bookId === book.isbn) && b.rating);
        if (bookBorrows.length === 0) return book;

        const sum = bookBorrows.reduce((acc, curr) => acc + (curr.rating || 0), 0);
        const avgRating = sum / bookBorrows.length;

        // Attach rating properties dynamically for the UI
        return {
          ...book,
          _avgRating: avgRating,
          _reviewCount: bookBorrows.length
        } as unknown as Book;
      });
    })
  );

  readonly subjects$: Observable<{ name: string; count: number; icon: string }[]> = this.books$.pipe(
    map((books) => {
      const counts: Record<string, number> = {};
      books.forEach((b) => {
        if (!counts[b.category]) counts[b.category] = 0;
        counts[b.category] += 1;
      });

      const predefined = [
        { name: 'Science', icon: '🧬' },
        { name: 'Arts', icon: '🎨' },
        { name: 'Commerce', icon: '💼' },
        { name: 'Design', icon: '📐' },
        { name: 'Cooking', icon: '🍳' },
      ];

      const result = predefined.map((p) => ({
        name: p.name,
        count: counts[p.name] || 0,
        icon: p.icon,
      }));

      // Group anything else into "Others"
      const predefinedNames = new Set(predefined.map((p) => p.name));
      const othersCount = Object.keys(counts)
        .filter((k) => !predefinedNames.has(k))
        .reduce((sum, k) => sum + counts[k], 0);

      result.push({ name: 'Others', count: othersCount, icon: '📚' });
      return result;
    })
  );

  readonly Math = Math;

  readonly user$ = this.authService.currentUser$;
  readonly isStudent$ = this.user$.pipe(map((u) => u?.role === 'student'));

  readonly searchTerm = signal('');
  readonly categoryFilter = signal<string | 'all'>('all');
  readonly statusFilter = signal<BookStatus | 'all'>('all');
  showAll = false;

  selectedBook: Book | null = null;
  bookDialogVisible = false;

  onSearch(term: string): void {
    this.searchTerm.set(term.toLowerCase());
  }

  onStatusFilterChange(status: BookStatus | 'all'): void {
    this.statusFilter.set(status);
  }

  onCategoryFilterChange(category: string | 'all'): void {
    this.categoryFilter.set(category);
  }

  onShowAll(): void {
    this.onSearch('');
    this.onStatusFilterChange('all');
    this.onCategoryFilterChange('all');
    this.showAll = true;
  }

  openBookDetails(book: Book): void {
    this.selectedBook = book;
    this.bookDialogVisible = true;
  }

  closeBookDetails(): void {
    this.bookDialogVisible = false;
  }

  async reserve(book: Book): Promise<void> {
    const user = await firstValueFrom(this.user$);
    if (!user) return;

    const result = await Swal.fire({
      title: 'Reserve this book?',
      html: `<b>${book.title}</b><br><small>by ${book.author}</small><br><br>You will be added to the waitlist and notified when it becomes available.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '📚 Yes, Reserve it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6c63ff',
      cancelButtonColor: '#aaa',
    });

    if (result.isConfirmed) {
      await this.reservationService.reserveBook(user, book);
    }
  }
}


