import { Pipe, PipeTransform } from '@angular/core';
import { Book, BookStatus } from '../core/models/book.model';

@Pipe({
  name: 'filterBooks',
  standalone: true,
})
export class FilterBooksPipe implements PipeTransform {
  transform(
    books: Book[] | null | undefined,
    searchTerm: string,
    status: BookStatus | 'all',
    category: string | 'all' = 'all'
  ): Book[] {
    if (!books || books.length === 0) {
      return [];
    }

    const term = (searchTerm ?? '').toLowerCase().trim();

    return books.filter((book) => {
      if (status !== 'all' && book.status !== status) {
        return false;
      }

      if (category && category !== 'all') {
        const predefined = new Set(['Science', 'Arts', 'Commerce', 'Design', 'Cooking']);
        if (category === 'others') {
          if (predefined.has(book.category)) {
            return false;
          }
        } else if (book.category !== category) {
          return false;
        }
      }

      if (!term) {
        return true;
      }

      const haystack = `${book.title} ${book.author} ${book.category}`.toLowerCase();
      return haystack.includes(term);
    });
  }
}

