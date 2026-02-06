import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { BooksService } from './books.service';
import { Book, BookStatus } from '../../core/models/book.model';
import { Observable } from 'rxjs';
import { FilterBooksPipe } from '../../shared/filter-books.pipe';
import { QrCodeComponent } from '../../shared/qr-code.component';

@Component({
  selector: 'app-books-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FilterBooksPipe, QrCodeComponent],
  templateUrl: './books-shell.component.html',
  styleUrl: './books-shell.component.css',
})
export class BooksShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly booksService = inject(BooksService);

  readonly books$: Observable<Book[]> = this.booksService.getAllBooks$();

  readonly searchTerm = signal('');
  readonly statusFilter = signal<BookStatus | 'all'>('all');

  readonly editingBook = signal<Book | null>(null);
  readonly isDialogOpen = signal(false);

  readonly qrBook = signal<Book | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required]],
    author: ['', [Validators.required]],
    category: ['', [Validators.required]],
    isbn: ['', [Validators.required]],
    quantityTotal: [1, [Validators.required, Validators.min(0)]],
    quantityAvailable: [1, [Validators.required, Validators.min(0)]],
    status: ['available' as BookStatus, [Validators.required]],
    description: [''],
  });

  readonly filteredBooks = computed(() => {
    // This is only used for type information in the template;
    // the real filtering happens using the async pipe there.
    return [];
  });

  openCreateDialog(): void {
    this.editingBook.set(null);
    this.form.reset({
      title: '',
      author: '',
      category: '',
      isbn: '',
      quantityTotal: 1,
      quantityAvailable: 1,
      status: 'available',
      description: '',
    });
    this.isDialogOpen.set(true);
  }

  openEditDialog(book: Book): void {
    this.editingBook.set(book);
    this.form.reset({
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      quantityTotal: book.quantityTotal,
      quantityAvailable: book.quantityAvailable,
      status: book.status,
      description: book.description ?? '',
    });
    this.isDialogOpen.set(true);
  }

  openQrDialog(book: Book): void {
    this.qrBook.set(book);
  }

  closeQrDialog(): void {
    this.qrBook.set(null);
  }

  closeDialog(): void {
    this.isDialogOpen.set(false);
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: Omit<Book, 'id'> = {
      title: value.title ?? '',
      author: value.author ?? '',
      category: value.category ?? '',
      isbn: value.isbn ?? '',
      quantityTotal: Number(value.quantityTotal ?? 0),
      quantityAvailable: Number(value.quantityAvailable ?? 0),
      status: (value.status ?? 'available') as BookStatus,
      description: value.description ?? '',
    };

    const current = this.editingBook();

    if (current?.id) {
      await this.booksService.updateBook(current.id, payload);
    } else {
      await this.booksService.addBook(payload);
    }

    this.closeDialog();
  }

  async delete(book: Book): Promise<void> {
    if (!book.id) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete “${book.title}”?`
    );

    if (!confirmed) {
      return;
    }

    await this.booksService.deleteBook(book.id);
  }

  onSearch(term: string): void {
    this.searchTerm.set(term.toLowerCase());
  }

  onStatusFilterChange(status: BookStatus | 'all'): void {
    this.statusFilter.set(status);
  }
}

