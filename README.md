# Library Management System (LMS)

A comprehensive Library Management System built with Angular 21 and Firebase, designed to streamline library operations including book management, circulation, user tracking, and analytics.

## Features

### 🔐 Authentication & Authorization
- Firebase Authentication integration
- Role-based access control with three user roles:
  - **Admin**: Full system access
  - **Librarian**: Book and circulation management
  - **Student**: Book browsing and borrowing

### 📚 Book Management
- Complete CRUD operations for books
- Book catalog with search and filtering
- Track book availability and quantities
- Book categories and ISBN management
- QR code generation for books

### 📥 Circulation Management
- Borrow and return books
- QR code scanning for quick transactions
- Track borrowing history
- Automatic fine calculation for overdue books
- Status tracking (borrowed, returned, overdue)

### 🧾 Entry Logs
- Track library visits with QR code scanning
- Record entry and exit times
- Visit purpose tracking (Study, Borrow/Return, Research, Others)
- Real-time visitor monitoring
- Force checkout capability for staff

### 📊 Dashboard & Analytics
- Today's visit statistics
- Currently inside library count
- Hourly traffic analysis
- Purpose distribution charts
- Recent activity logs
- Real-time data visualization

### 👥 User Management
- User profile management
- Student ID assignment
- QR code generation for users
- Account settings and preferences
- User activity tracking

### 📈 Reports
- Generate comprehensive library reports
- Borrowing statistics
- User activity reports
- Book utilization metrics

### 🔍 QR Code Integration
- QR code scanning for books and users
- Quick checkout/check-in process
- Entry/exit logging via QR codes

## Tech Stack

- **Frontend Framework**: Angular 21.1.0
- **Backend**: Firebase (Firestore, Authentication)
- **QR Code Library**: @zxing/library
- **Server-Side Rendering**: Angular SSR with Express
- **Testing**: Vitest
- **Language**: TypeScript

## Prerequisites

- Node.js (v18 or higher)
- npm (v11.6.2 or compatible)
- Firebase project with Firestore and Authentication enabled

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd LMS
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database and Authentication
   - Copy your Firebase configuration
   - Update `src/environments/environment.ts` with your Firebase credentials:
   ```typescript
   firebase: {
     apiKey: 'YOUR_FIREBASE_API_KEY',
     authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
     projectId: 'YOUR_FIREBASE_PROJECT_ID',
     // ... other config
   }
   ```

4. Set up Firestore Security Rules:
   - Deploy the security rules from `firestore.rules` to your Firebase project
   - Ensure proper role-based access control is configured

## Development

### Start Development Server

```bash
ng serve
# or
npm start
```

Navigate to `http://localhost:4200/`. The app will automatically reload if you change any source files.

### Build for Production

```bash
ng build
```

The build artifacts will be stored in the `dist/` directory. The production build optimizes the application for performance and speed.

### Server-Side Rendering (SSR)

To run the SSR version:

```bash
npm run build
npm run serve:ssr:LMS
```

## Testing

### Unit Tests

Run unit tests with Vitest:

```bash
ng test
```

### End-to-End Tests

For end-to-end testing, run:

```bash
ng e2e
```

## Project Structure

```
LMS/
├── src/
│   ├── app/
│   │   ├── core/              # Core services, models, guards
│   │   │   ├── guards/        # Auth and role guards
│   │   │   ├── models/        # Data models (User, Book, Borrow, EntryLog)
│   │   │   └── services/      # Core services (Auth)
│   │   ├── features/          # Feature modules
│   │   │   ├── auth/          # Authentication (Login, Account Settings)
│   │   │   ├── books/         # Book management
│   │   │   ├── catalog/       # Book catalog browsing
│   │   │   ├── circulation/   # Borrow/return operations
│   │   │   ├── dashboard/     # Analytics dashboard
│   │   │   ├── entry-logs/    # Entry/exit logging
│   │   │   ├── reports/       # Report generation
│   │   │   └── users/         # User management
│   │   ├── layout/            # Main layout component
│   │   ├── shared/            # Shared components and utilities
│   │   │   ├── qr-code/       # QR code generation
│   │   │   ├── qr-scanner/    # QR code scanning
│   │   │   └── fines.util.ts  # Fine calculation utilities
│   │   └── app.routes.ts      # Application routing
│   └── environments/         # Environment configurations
├── firestore.rules            # Firestore security rules
└── package.json
```

## User Roles & Permissions

### Admin
- Full system access
- User management
- Book management
- Circulation operations
- View dashboard and reports
- Manage entry logs

### Librarian
- Book management
- Circulation operations
- View dashboard and reports
- Manage entry logs
- Cannot manage users

### Student
- Browse book catalog
- Borrow and return books
- View own borrowing history
- View own entry logs
- Manage account settings

## Security

The application uses Firebase Security Rules to enforce access control:
- Users can only read their own data (unless they're staff)
- Only admins and librarians can modify books and borrowing records
- Students can create borrows only for themselves
- Entry logs can be created by authenticated users for themselves

## Additional Resources

- [Angular Documentation](https://angular.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Angular CLI Overview](https://angular.dev/tools/cli)
- [ZXing Library Documentation](https://github.com/zxing-js/library)

## License

[Your License Here]
