export const environment = {
  production: true,
  /**
   * Use a production Firebase project here if you separate dev/prod.
   * Ensure security rules are strict before going live.
   */
  firebase: {
    apiKey: 'YOUR_PROD_FIREBASE_API_KEY',
    authDomain: 'YOUR_PROD_FIREBASE_AUTH_DOMAIN',
    projectId: 'YOUR_PROD_FIREBASE_PROJECT_ID',
    storageBucket: 'YOUR_PROD_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_PROD_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'YOUR_PROD_FIREBASE_APP_ID',
    measurementId: 'YOUR_PROD_FIREBASE_MEASUREMENT_ID'
  }
};

