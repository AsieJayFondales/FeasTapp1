import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

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

// Initialize Firebase Auth and Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();


// Get all the preference buttons
const preferenceButtons = document.querySelectorAll('.preferences-wrapper .options button');

// Function to clear active state from buttons in the same group
function clearActiveState(buttons) {
  buttons.forEach(btn => btn.classList.remove('active'));
}

// Add click event listeners to the preference buttons
preferenceButtons.forEach(button => {
  button.addEventListener('click', function() {
    // Clear active state from siblings (buttons in the same preference group)
    clearActiveState(this.parentNode.querySelectorAll('button'));
    // Set the clicked button to active
    this.classList.add('active');
  });
});

// Handle continue button click
document.querySelector('.continue').addEventListener('click', function() {
    const user = auth.currentUser;

    if (user) {
        const selectedAllergies = Array.from(document.querySelectorAll('.allergies .active')).map(btn => btn.textContent);
        const selectedDietary = Array.from(document.querySelectorAll('.dietary .active')).map(btn => btn.textContent);
        
        // Create an object to store in Firestore
        const userPreferences = {
            allergies: selectedAllergies,
            dietaryPreferences: selectedDietary,
            updatedAt: new Date() // optional: records the time of update
        };

        // Save the preferences to Firestore
        setDoc(doc(db, "userPreferences", user.uid), userPreferences)
        .then(() => {
            console.log('Preferences saved!');
            // Redirect to main page at the root of the project
            window.location.href = '/main/main.html'; // Adjusted the path here
        })
        .catch((error) => {
            console.error('Error saving preferences:', error);
            alert('Failed to save preferences. Please try again.');
});

    } else {
        console.log('No user signed in!');
        // Redirect to login or do something else to handle this case
    }
});
