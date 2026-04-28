import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import Swal from 'sweetalert2';

export interface SubjectCategory {
  id: string;
  name: string;
  icon: string;
}

const DEFAULT_SUBJECTS: SubjectCategory[] = [
  { id: '1', name: 'Science', icon: '🧬' },
  { id: '2', name: 'Arts', icon: '🎨' },
  { id: '3', name: 'Commerce', icon: '💼' },
  { id: '4', name: 'Design', icon: '📐' },
  { id: '5', name: 'Cooking', icon: '🍳' },
];

@Injectable({
  providedIn: 'root'
})
export class SubjectsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'lms_subjects';
  
  private subjectsSubject = new BehaviorSubject<SubjectCategory[]>([]);
  
  constructor() {
    this.subjectsSubject.next(this.loadSubjects());
  }
  
  getSubjects$(): Observable<SubjectCategory[]> {
    return this.subjectsSubject.asObservable();
  }
  
  private loadSubjects(): SubjectCategory[] {
    if (!isPlatformBrowser(this.platformId)) return DEFAULT_SUBJECTS;
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (stored) {
         const parsed = JSON.parse(stored);
         if (parsed && Array.isArray(parsed) && parsed.length) {
            return parsed;
         }
      }
    } catch {}
    
    // Save defaults if nothing exists
    this.saveSubjects(DEFAULT_SUBJECTS);
    return DEFAULT_SUBJECTS;
  }
  
  private saveSubjects(subjects: SubjectCategory[]) {
    if (!isPlatformBrowser(this.platformId)) return;
    window.localStorage.setItem(this.storageKey, JSON.stringify(subjects));
  }
  
  async addSubject(name: string, icon: string) {
    const current = this.subjectsSubject.value;
    
    // Check for duplicates
    if (current.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: `Category "${name}" already exists!`
        });
        return false;
    }
    
    const newSubject: SubjectCategory = {
      id: Date.now().toString(),
      name,
      icon: icon || '📚'
    };
    
    const nextList = [...current, newSubject];
    this.saveSubjects(nextList);
    this.subjectsSubject.next(nextList);
    
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      icon: 'success',
      title: `Category "${name}" added successfully!`
    });
    
    return true;
  }
}
