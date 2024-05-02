// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCSthBn4IZuc14h3JJQWnrDlL1RbBWButA",
    authDomain: "feastapp-c4d79.firebaseapp.com",
    databaseURL: "https://feastapp-c4d79-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "feastapp-c4d79",
    storageBucket: "feastapp-c4d79.appspot.com",
    messagingSenderId: "210900129902",
    appId: "1:210900129902:web:ac73d94bb43204e20b2e7f",
    measurementId: "G-GVB2CDPJSY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const signInForm = document.querySelector('.account-form');

    signInForm.addEventListener('submit', (event) => {
        event.preventDefault();

        // Get user info from the form fields
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                // Redirect to the main page
                window.location.href = '/main/main.html';
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                // Handle errors here
                alert('Failed to sign in: ' + errorMessage);
            });
    });
});
