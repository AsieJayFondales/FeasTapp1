import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, getIdToken } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfigApp2 = {
    apiKey: "AIzaSyCSthBn4IZuc14h3JJQWnrDlL1RbBWButA",
    authDomain: "feastapp-c4d79.firebaseapp.com",
    databaseURL: "https://feastapp-c4d79-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "feastapp-c4d79",
    appId: "1:210900129902:web:530a922c38f5448b0b2e7f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfigApp2);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const signInForm = document.querySelector('#login-form');
    const errorMessage = document.createElement('p');
    errorMessage.style.color = 'red';
    errorMessage.style.display = 'none';

    signInForm.insertBefore(errorMessage, signInForm.querySelector('button'));

    signInForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Get the user's Firebase ID token
            const idToken = await getIdToken(user);
            
            // Send the token to your Flask backend
            const response = await fetch('/auth/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ idToken })
            });

            const result = await response.json();
            console.log(result);
            
            if (result.success) {
                // Redirect after successful authentication
                window.location.href = '/main';
            } else {
                errorMessage.textContent = 'Authentication failed.';
                errorMessage.style.display = 'block';
            }

        } catch (error) {
            console.error("Error signing in:", error.message);
            errorMessage.textContent = 'Error signing in: ' + error.message;
            errorMessage.style.display = 'block';
        }
    });
});
