import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfigApp2 = {
    apiKey: "AIzaSyCSthBn4IZuc14h3JJQWnrDlL1RbBWButA",
    authDomain: "feastapp-c4d79.firebaseapp.com",
    databaseURL: "https://feastapp-c4d79-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "feastapp-c4d79",
    storageBucket: "feastapp-c4d79.appspot.com",
    messagingSenderId: "210900129902",
    appId: "1:210900129902:web:ac73d94bb43204e20b2e7f",
    measurementId: "G-GVB2CDPJSY"
};
 
const app = initializeApp(firebaseConfigApp2);
const auth = getAuth(app2);

document.addEventListener('DOMContentLoaded', () => {
    const signUpForm = document.querySelector('#sign-up-form');

    signUpForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const fname = document.getElementById('first-name').value;
        const lname = document.getElementById('last-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log('User created:', user);
                window.location.href = '/userpref';
            })
            .catch((error) => {
                const errorMessage = error.message;
                alert(errorMessage);
            });
    });
});


// static/js/signin.js
import { auth } from './feastapp-config-app2.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Sign-in function
function signInUser(email, password) {
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed in 
      const user = userCredential.user;
      console.log("Signed in:", user);
    })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.error("Error signing in:", errorCode, errorMessage);
    });
}
 
// static/js/database.js
import { database } from './feastapp-config-app2.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// Function to write data to the database
function writeUserData(userId, name, email, imageUrl) {
  set(ref(database, 'users/' + userId), {
    username: name, 
    email: email,
    profile_picture: imageUrl
  });
}

// Example usage
const userId = "user-id";
const name = "User Name";
const email = "user@example.com";
const imageUrl = "profile-pic-url";
writeUserData(userId, name, email, imageUrl);

// Import Firebase Authentication for both apps
import { app2, authApp2 } from './firebase-config-app2.js';

document.addEventListener('DOMContentLoaded', () => {
    const signUpForm = document.querySelector('#signup-form');

    signUpForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const firstName = document.getElementById('first-name').value;
        const lastName = document.getElementById('last-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;

        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }

        try {
            const response = await fetch('/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                // Redirect to sign-in page
                window.location.href = '/signin';
            } else {
                alert('Signup failed: ' + result.message);
            }
        } catch (error) {
            console.error('Error during signup:', error);
            alert('An error occurred. Please try again.');
        }
    });
});


function storeUserData(userId, firstName, lastName, email, authApp) {
    // Implement database storing logic here if needed, similar to how it's done in signin.js
    console.log("Storing user data for:", userId, firstName, lastName, email);
}

