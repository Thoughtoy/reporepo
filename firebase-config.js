// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRxugvf_bwjz5acJszGL2zZRO5mGwH_eo",
  authDomain: "leaflet-6e4ce.firebaseapp.com",
  projectId: "leaflet-6e4ce",
  storageBucket: "leaflet-6e4ce.firebasestorage.app",
  messagingSenderId: "489272492516",
  appId: "1:489272492516:web:0e53e043902260893687f1"
};

const app = initializeApp(firebaseConfig);
export default app;