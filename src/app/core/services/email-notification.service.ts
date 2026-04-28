import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import emailjs from '@emailjs/browser';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class EmailNotificationService {
  private readonly firestore = inject(Firestore);
  private readonly config = environment.emailjs;

  constructor() {
    if (this.config && this.config.publicKey && !this.config.publicKey.startsWith('YOUR_')) {
      emailjs.init({ publicKey: this.config.publicKey });
    }
  }

  async sendReadyForPickup(userId: string, bookTitle: string): Promise<void> {
    const profile = await this.getUserProfile(userId);
    
    if (!profile.email || !this.isConfigured()) return;

    try {
      await emailjs.send(this.config.serviceId, this.config.templateReady, {
        to_email: profile.email,
        to_name: profile.name || 'Student',
        book_title: bookTitle
      });
      console.log(`Ready for pickup email sent to ${profile.email}`);
    } catch (err) {
      console.warn('Failed to send Ready email:', err);
    }
  }

  async sendOverdueAlert(userId: string, bookTitle: string, fineAmount: number): Promise<void> {
    const profile = await this.getUserProfile(userId);
    
    if (!profile.email || !this.isConfigured()) return;

    try {
      await emailjs.send(this.config.serviceId, this.config.templateOverdue, {
        to_email: profile.email,
        to_name: profile.name || 'Student',
        book_title: bookTitle,
        fine_amount: fineAmount
      });
      console.log(`Overdue email sent to ${profile.email}`);
    } catch (err) {
      console.warn('Failed to send Overdue email:', err);
    }
  }

  private isConfigured(): boolean {
    return !!this.config && 
           !this.config.serviceId.startsWith('YOUR_') &&
           !this.config.templateReady.startsWith('YOUR_') &&
           !this.config.templateOverdue.startsWith('YOUR_');
  }

  private async getUserProfile(userId: string): Promise<{email: string | null, name: string | null}> {
    try {
      const snap = await getDoc(doc(this.firestore, 'users', userId));
      if (snap.exists()) {
        const data = snap.data();
        return { email: data['email'] || null, name: data['name'] || null };
      }
    } catch {
      // Ignore cleanly if offline or permission error
    }

    // Fallback to JSON server (local mock backend)
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`http://localhost:3000/users/${userId}`);
        if (res.ok) {
          const data = await res.json();
          return { email: data.email || null, name: data.name || null };
        }
      } catch {
        // Ignore JSON server fetch error
      }
    }

    return { email: null, name: null };
  }
}
