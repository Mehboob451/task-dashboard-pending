import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDc8_elmLJXoNsO42ydiRBl9HEfQJth9n4",
  authDomain: "task-dashboard-55378.firebaseapp.com",
  projectId: "task-dashboard-55378",
  storageBucket: "task-dashboard-55378.firebasestorage.app",
  messagingSenderId: "561841558400",
  appId: "1:561841558400:web:643a31ea625ce2a0812765"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
