// ShareBite - Firebase Modular SDK Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc,
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot, 
  serverTimestamp, 
  runTransaction,
  writeBatch,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Official project configuration provided
const firebaseConfig = {
  apiKey: "AIzaSyA67DeOzhcAWa2En6Er8D02FdhXgwlubko",
  authDomain: "sharebite-ai.firebaseapp.com",
  projectId: "sharebite-ai",
  storageBucket: "sharebite-ai.firebasestorage.app",
  messagingSenderId: "124565059593",
  appId: "1:124565059593:web:2040b9981734ef5ae460d8",
  measurementId: "G-X2MKV3BXMK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export instances and modular helpers
export {
  app,
  auth,
  db,
  // Auth methods
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  // Firestore methods
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  writeBatch,
  increment
};

