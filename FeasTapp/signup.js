// signup.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";




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
const auth = getAuth(app); // Get the auth module from the Firebase app

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const signUpForm = document.querySelector('#sign-up-form');

    signUpForm.addEventListener('submit', (event) => {
        event.preventDefault();

        // Get user info from the form fields
        const fname = document.getElementById('first-name').value;
        const lname = document.getElementById('last-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        // Check if passwords match
        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        // Create a new user with email and password
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                // Signed in 
                const user = userCredential.user;
                console.log('User created:', user);
                window.location.href = 'userpref/userpref.html'; // Redirect to the preferences page
            })
            .catch((error) => {
                const errorMessage = error.message;
                alert(errorMessage); // Show errors on the UI
            });
    });
});