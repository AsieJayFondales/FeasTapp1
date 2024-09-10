// static/js/signin.js
import { authApp2 } from './firebase-config-app2.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.querySelector('#login-form');

    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();  // Prevent the default form submission

        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        try {
            // Sign in with Firebase app 2
            const userCredential = await signInWithEmailAndPassword(authApp2, email, password);
            const user = userCredential.user;
            console.log("Signed in with app2:", user);

            // Optionally, retrieve user data from the database if needed
            // const userData = await readUserData(databaseApp2, user.uid);
            // console.log("User data after sign-in:", userData);

            // Redirect to the main page after successful sign-in
            window.location.href = '/';
        } catch (error) {
            console.error("Error signing in:", error);
            alert('Failed to sign in: ' + error.message);
        }
    });
});
