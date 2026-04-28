import { Component, computed, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { BooksService } from './books.service';
import { Book, BookStatus } from '../../core/models/book.model';
import { Observable, firstValueFrom } from 'rxjs';
import { FilterBooksPipe } from '../../shared/filter-books.pipe';
import { QrCodeComponent } from '../../shared/qr-code.component';
import { TableModule } from 'primeng/table';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SubjectsService, SubjectCategory } from '../../core/services/subjects.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-books-shell',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FilterBooksPipe, QrCodeComponent, TableModule, ProgressSpinnerModule],
  templateUrl: './books-shell.component.html',
  styleUrl: './books-shell.component.css',
})
export class BooksShellComponent {
  private readonly fb = inject(FormBuilder);
  private readonly booksService = inject(BooksService);
  private readonly subjectsService = inject(SubjectsService);

  @ViewChild('csvFileInput') csvFileInput!: ElementRef<HTMLInputElement>;

  readonly books$: Observable<Book[]> = this.booksService.getAllBooks$();
  readonly subjects$: Observable<SubjectCategory[]> = this.subjectsService.getSubjects$();

  readonly searchTerm = signal('');
  readonly statusFilter = signal<BookStatus | 'all'>('all');

  readonly editingBook = signal<Book | null>(null);
  readonly isDialogOpen = signal(false);

  readonly qrBook = signal<Book | null>(null);

  readonly form = this.fb.group({
    title: ['', [Validators.required]],
    author: ['', [Validators.required]],
    category: ['', [Validators.required]],
    isbn: ['', [Validators.required, Validators.maxLength(13), Validators.pattern('^[0-9]+$')]],
    quantityTotal: [1, [Validators.required, Validators.min(0)]],
    quantityAvailable: [1, [Validators.required, Validators.min(0)]],
    status: ['available' as BookStatus, [Validators.required]],
    description: [''],
    shelfLocation: [''],
    coverImage: [''],
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
      shelfLocation: '',
      coverImage: '',
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
      shelfLocation: book.shelfLocation ?? '',
      coverImage: book.coverImage ?? '',
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
    const qtyAvailable = Number(value.quantityAvailable ?? 0);

    // Auto-sync status based on quantity
    const autoStatus: BookStatus = qtyAvailable <= 0 ? 'unavailable' : 'available';

    const payload: Omit<Book, 'id'> = {
      title: value.title ?? '',
      author: value.author ?? '',
      category: value.category ?? '',
      isbn: value.isbn ?? '',
      quantityTotal: Number(value.quantityTotal ?? 0),
      quantityAvailable: qtyAvailable,
      status: autoStatus,
      description: value.description ?? '',
      shelfLocation: value.shelfLocation ?? '',
      coverImage: value.coverImage ?? '',
    };

    const current = this.editingBook();

    if (current?.id) {
      await this.booksService.updateBook(current.id, payload);
    } else {
      await this.booksService.addBook(payload);
    }

    this.closeDialog();
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    // Basic guard so images stay within Firestore / network limits
    // You can raise this further, but avoid going near Firestore's 1 MB per-document limit.
    const maxBytes = 900 * 1024; // ~900 KB
    if (file.size > maxBytes) {
      Swal.fire({
        icon: 'warning',
        title: 'Image too large',
        text: 'Please choose a smaller image (around 900 KB or less).',
        confirmButtonColor: '#4f46e5',
      });
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      this.form.patchValue({ coverImage: result });
    };
    reader.readAsDataURL(file);
  }

  removeCover(input?: HTMLInputElement): void {
    this.form.patchValue({ coverImage: '' });
    if (input) {
      input.value = '';
    }
  }

  async delete(book: Book): Promise<void> {
    if (!book.id) return;
    const result = await Swal.fire({
      title: 'Delete this book?',
      html: `<b>${book.title}</b> will be permanently removed from the library.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#aaa',
    });
    if (result.isConfirmed) {
      await this.booksService.deleteBook(book.id);
    }
  }

  onSearch(term: string): void {
    this.searchTerm.set(term.toLowerCase());
  }

  onStatusFilterChange(status: BookStatus | 'all'): void {
    this.statusFilter.set(status);
  }

  /** Feature 6 — Trigger the hidden file input */
  triggerCsvImport(): void {
    this.csvFileInput?.nativeElement.click();
  }

  /** Feature 6 — Parse CSV and bulk-import books */
  async importCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      Swal.fire({ icon: 'error', title: 'Invalid CSV', text: 'File must have a header row and at least one data row.', confirmButtonColor: '#4f46e5' });
      return;
    }

    // Expected headers: title,author,category,isbn,quantity,description
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const get = (row: string[], col: string) => (row[headers.indexOf(col)] ?? '').trim();

    const currentBooks = await firstValueFrom(this.books$);
    const existingIsbns = new Set(currentBooks.map((b: Book) => b.isbn));

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const title = get(cols, 'title');
      const author = get(cols, 'author');
      const category = get(cols, 'category');
      const isbn = get(cols, 'isbn');
      const qty = parseInt(get(cols, 'quantity') || get(cols, 'quantitytotal'), 10);
      const description = get(cols, 'description');

      if (!title || !author || !isbn) {
        skipped++;
        errors.push(`Row ${i + 1}: missing title, author, or isbn`);
        continue;
      }

      if (existingIsbns.has(isbn)) {
        skipped++;
        errors.push(`Row ${i + 1}: Book with ISBN ${isbn} already exists`);
        continue;
      }

      existingIsbns.add(isbn);

      const quantity = isNaN(qty) ? 1 : Math.max(0, qty);
      await this.booksService.addBook({
        title,
        author,
        category: category || 'Uncategorized',
        isbn,
        quantityTotal: quantity,
        quantityAvailable: quantity,
        status: 'available',
        description,
      });
      imported++;
    }

    // Reset so same file can be re-imported
    input.value = '';

    Swal.fire({
      icon: imported > 0 ? 'success' : 'warning',
      title: '📥 Import Complete',
      html: `
        <p>✅ <strong>${imported}</strong> book(s) imported successfully.</p>
        ${skipped > 0 ? `<p>⚠️ <strong>${skipped}</strong> row(s) skipped.</p>
        <details style="text-align:left;margin-top:8px;font-size:0.8rem;color:#6b7280">
          <summary>Details</summary>${errors.join('<br>')}
        </details>` : ''}
      `,
      confirmButtonColor: '#4f46e5',
    });
  }
}
