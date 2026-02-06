import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BooksService } from '../books/books.service';
import { Book, BookStatus } from '../../core/models/book.model';
import { Observable } from 'rxjs';
import { FilterBooksPipe } from '../../shared/filter-books.pipe';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FilterBooksPipe],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css',
})
export class CatalogComponent {
  private readonly booksService = inject(BooksService);

  readonly books$: Observable<Book[]> = this.booksService.getAllBooks$();

  readonly searchTerm = signal('');
  readonly categoryFilter = signal<string | 'all'>('all');
  readonly statusFilter = signal<BookStatus | 'all'>('all');

  onSearch(term: string): void {
    this.searchTerm.set(term.toLowerCase());
  }

  onStatusFilterChange(status: BookStatus | 'all'): void {
    this.statusFilter.set(status);
  }

  onCategoryFilterChange(category: string | 'all'): void {
    this.categoryFilter.set(category);
  }
}


