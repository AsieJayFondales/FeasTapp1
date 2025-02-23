
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfigApp2 = {
    apiKey: "AIzaSyCSthBn4IZuc14h3JJQWnrDlL1RbBWButA",
    authDomain: "feastapp-c4d79.firebaseapp.com",
    databaseURL: "https://feastapp-c4d79-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "feastapp-c4d79",
    storageBucket: "feastapp-c4d79.appspot.com",
    messagingSenderId: "210900129902",
    appId: "1:210900129902:web:ac73d94bb43204e20b2e7f",
    measurementId: "G-GVB2CDPJSY"
};


const app = initializeApp(firebaseConfigApp2);
const auth = getAuth(app);
const db = getFirestore(app);

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
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Save additional user info in Firestore
            await setDoc(doc(db, "users", user.uid), {
                firstName: firstName,
                lastName: lastName,
                email: email,
                userID: user.uid
            });

            console.log('User created:', user);
            window.location.href = '/account-settings'; // Redirect after signup
        } catch (error) {
            console.error('Signup Error:', error.message);
            alert('Signup failed: ' + error.message);
        }
    });
});
