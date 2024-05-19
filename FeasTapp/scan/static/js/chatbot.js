import { db } from './firebase-config.js';
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('get-started-btn').addEventListener('click', function() {
        var chatBox = document.getElementById('chat-box');
        chatBox.innerHTML += '<div class="message bot-response">Which cuisine do you prefer?</div>';
        displayButtons(["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]);
        chatBox.scrollTop = chatBox.scrollHeight;
        this.style.display = 'none';  // Hide the Get Started button
    });

    document.getElementById('send-btn').addEventListener('click', function() {
        sendMessage();
    });

    document.getElementById('find-recipe-btn').addEventListener('click', function() {
        findRecipe();
    });

    document.getElementById('button-options').addEventListener('click', function(event) {
        if (event.target.tagName === 'BUTTON') {
            const message = event.target.textContent;
            if (message === 'Save Recipe') {
                saveRecipe();
            } else {
                sendButtonMessage(message);
            }
        }
    });
});

function displayButtons(buttons) {
    var buttonOptions = document.getElementById('button-options');
    buttonOptions.innerHTML = '';
    buttons.forEach(function(buttonText) {
        var button = document.createElement('button');
        button.textContent = buttonText;
        buttonOptions.appendChild(button);
    });
    buttonOptions.style.display = 'block';
}

function sendMessage() {
    var input = document.getElementById('user-input');
    var message = input.value.trim();
    sendMessageToServer(message);
}

function findRecipe() {
    var input = document.getElementById('user-input');
    var ingredients = input.value.trim();
    sendMessageToServer(`Find a recipe with these ingredients: ${ingredients}`);
}

function sendButtonMessage(message) {
    sendMessageToServer(message);
}

function sendMessageToServer(message) {
    var chatBox = document.getElementById('chat-box');
    var buttonOptions = document.getElementById('button-options');

    if (message) {
        $.ajax({
            url: '/send_message',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ message: message }),
            success: function(data) {
                console.log("Server Response: ", data);  // Log server response for debugging
                chatBox.innerHTML += '<div class="message user-message">' + message + '</div>';
                chatBox.innerHTML += '<div class="message bot-response">' + data.response + '</div>';
                chatBox.scrollTop = chatBox.scrollHeight;
                document.getElementById('user-input').value = '';

                if (data.show_buttons) {
                    displayButtons(data.buttons);
                } else {
                    buttonOptions.style.display = 'none';
                }

                // Store the recipe name in a data attribute
                const recipeName = extractRecipeName(data.response);
                chatBox.setAttribute('data-recipe-name', recipeName || '');
                console.log("Recipe Name: ", recipeName);  // Log the recipe name for debugging
            },
            error: function(xhr, status, error) {
                console.error("Error when sending/receiving message: ", error);
                chatBox.innerHTML += '<div class="message error-message">Error: Unable to send message. Please try again later.</div>';
            }
        });
    }
}

function extractRecipeName(text) {
    const match = text.match(/\*\*(.*?)\*\*/);
    return match ? match[1] : "Unknown Recipe";
}

async function saveRecipe() {
    const chatBox = document.getElementById('chat-box');
    const recipeName = chatBox.getAttribute('data-recipe-name');
    console.log("Saving Recipe: ", recipeName);  // Log the recipe name being saved

    if (recipeName === "Unknown Recipe" || !recipeName) {
        chatBox.innerHTML += '<div class="message bot-response">Failed to save recipe. No recipe name found.</div>';
        return;
    }

    const recipe = { name: recipeName, savedAt: new Date() };

    try {
        await setDoc(doc(db, "recipes", "recipe_" + Date.now()), recipe);
        chatBox.innerHTML += '<div class="message bot-response">Recipe saved successfully!</div>';
    } catch (error) {
        console.error("Error saving recipe:", error);
        chatBox.innerHTML += '<div class="message bot-response">Failed to save recipe. Please try again.</div>';
    }
}

if (!!window.EventSource) {
    var source = new EventSource('/events');
    source.onmessage = function(event) {
        var data = JSON.parse(event.data);
        if (data.event === "ingredient_detected") {
            var input = document.getElementById('user-input');
            input.value = data.data; // Simplified and categorized ingredients
        }
    };
}
