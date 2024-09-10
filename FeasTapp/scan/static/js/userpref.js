import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Your web app's Firebase configuration
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

const app2 = initializeApp(firebaseConfigApp2);
const auth = getAuth(app2);
const db = getFirestore(app2);

const preferenceButtons = document.querySelectorAll('.preferences-wrapper .options button');

function clearActiveState(buttons) {
  buttons.forEach(btn => btn.classList.remove('active'));
}

preferenceButtons.forEach(button => {
  button.addEventListener('click', function() {
    clearActiveState(this.parentNode.querySelectorAll('button'));
    this.classList.add('active');
  });
});

document.querySelector('.continue').addEventListener('click', function() {
    const user = auth.currentUser;

    if (user) {
        const selectedAllergies = Array.from(document.querySelectorAll('.allergies .active')).map(btn => btn.textContent);
        const selectedDietary = Array.from(document.querySelectorAll('.dietary .active')).map(btn => btn.textContent);

        const userPreferences = {
            allergies: selectedAllergies,
            dietaryPreferences: selectedDietary,
            updatedAt: new Date()
        };

        setDoc(doc(db, "userPreferences", user.uid), userPreferences)
        .then(() => {
            console.log('Preferences saved!');
            window.location.href = '/main';
        })
        .catch((error) => {
            console.error('Error saving preferences:', error);
            alert('Failed to save preferences. Please try again.');
        });

    } else {
        console.log('No user signed in!');
        window.location.href = '/signin';
    }
});
