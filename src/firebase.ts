import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBTtsOeQTpPwTEn_T9EDqt5i_0eyQuzGOA",
  authDomain: "stock-manager-703e6.firebaseapp.com",
  databaseURL: "https://stock-manager-703e6-default-rtdb.firebaseio.com",
  projectId: "stock-manager-703e6",
  storageBucket: "stock-manager-703e6.firebasestorage.app",
  messagingSenderId: "778548519096",
  appId: "1:778548519096:web:716f903fee993f4d85544d",
  measurementId: "G-G735N8XCQ2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const CLOUD_ROOT = "stockManager/v1";
