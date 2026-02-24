// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDnXZN5IKJmMBrvlfg4vzcgRm9SVYYdykU",
  authDomain: "dontrading-af832.firebaseapp.com",
  projectId: "dontrading-af832",
  storageBucket: "dontrading-af832.firebasestorage.app",
  messagingSenderId: "748072699837",
  appId: "1:748072699837:web:de4a3e955c5c50c002f4d4",
  measurementId: "G-WZWRVLQQGL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);