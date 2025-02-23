document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const ingredients = params.get('ingredients');
    let storedIngredients = ingredients;
    let isDishSelection = false;
    let selectedCuisine = "";
    let selectedDishName = ""; 
    let recipeDetails = {}

    // Get required elements
    const talkToFeastBotBtn = document.getElementById('talk-to-feastbot-btn');
    const saveRecipeBtn = document.getElementById('save-recipe-btn');
    const scanAgainBtn = document.getElementById('scan-again-btn');
    const chatInputArea = document.getElementById('chat-input-area');
    const sendBtn = document.getElementById('send-btn');
    const userInput = document.getElementById('user-input');
    const getStartedBtn = document.getElementById('get-started-btn');
    const buttonOptions = document.getElementById('button-options');
    const utilityButtons = document.getElementById('utility-buttons');
    const recommendButton = document.getElementById('recommend-another-dish');
    const chatBox = document.getElementById('chat-box');
    const loadingIndicator = document.getElementById('loading');
    const modal = document.getElementById('saveRecipeModal');
    const modalMessage = document.getElementById('modalMessage');
    const closeModal = document.getElementById('closeModal');

    // Ensure modal starts hidden
    modal.style.display = 'none';

    // Initial setup: Hide utility buttons and chat input area
    utilityButtons.style.display = 'none';
    recommendButton.style.display = 'none';
    chatInputArea.style.display = 'none';

    // Check if all elements are loaded
    if (!sendBtn || !userInput || !chatBox) {
        console.error("One or more required elements are missing.");
        return;
    }

    // Show the chat input area and hide the utility buttons when "Talk to FeastBot" is clicked
    changeCuisineBtn.addEventListener('click', function () {
        // Redirect to purecb.html when the button is clicked
        chatBox.innerHTML += `<div class="message bot-response">Which cuisine do you prefer?</div>`;
        displayOptions(["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]);
        getStartedBtn.style.display = 'none';
    });

    // 'Get Started' button functionality
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', function () {
            if (storedIngredients) {
                chatBox.innerHTML += `<div class="message user-message">Ingredients detected: ${storedIngredients}</div>`;
                chatBox.innerHTML += `<div class="message bot-response">Which cuisine do you prefer?</div>`;
                displayOptions(["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]);
                getStartedBtn.style.display = 'none';
            }
        });
    }

    // Display cuisine or dish options
    function displayOptions(options, isDishSelectionMode = false) {
        buttonOptions.innerHTML = '';
        isDishSelection = isDishSelectionMode;
        options.forEach(function (option) {
            const button = document.createElement('button');
            button.textContent = option;
            button.classList.add('button-option');
            buttonOptions.appendChild(button);
        });
        buttonOptions.style.display = 'grid';
        utilityButtons.style.display = isDishSelection ? 'flex' : 'none';
    }

    // Cuisine and dish selection handling
    buttonOptions.addEventListener('click', function (event) {
        if (event.target.tagName === 'BUTTON') {
            const selectedOption = event.target.textContent;
            if (!isDishSelection) {
                selectedCuisine = selectedOption;
                sendCuisineAndIngredientsToServer(storedIngredients, selectedCuisine);
            } else {
                getDishDetails(selectedOption);
            }
        }
    });

    // AJAX to send cuisine and ingredients to server
    function sendCuisineAndIngredientsToServer(ingredients, cuisine) {
        chatBox.innerHTML += `<div class="message user-message">${ingredients} - ${cuisine}</div>`;
        loadingIndicator.style.display = 'block';

        $.ajax({
            url: '/send_message',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ ingredients: ingredients.split(','), cuisine: cuisine }),
            success: function (data) {
                const responseText = data.response.replace(/\*/g, '');
                chatBox.innerHTML += `<div class="message bot-response">${responseText}</div>`;
                const dishNames = extractDishNames(responseText);
                if (dishNames.length > 0) {
                    displayOptions(dishNames, true); // Display dish options
                    recommendButton.style.display = 'inline-block';
                    utilityButtons.style.display = 'none';
                }
                loadingIndicator.style.display = 'none';
            },
            error: function (xhr) {
                chatBox.innerHTML += `<div class="message error-message">Error: ${xhr.responseText}</div>`;
                loadingIndicator.style.display = 'none';
            }
        });
    }

    // Fetch and display dish details
    function getDishDetails(dishName) {
        selectedDishName = dishName; // Assign the selected dish name here
        loadingIndicator.style.display = 'block';

        $.ajax({
            url: '/get_dish_details',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ dish_name: dishName }),
            success: function (data) {
                recipeDetails = {
                    name: dishName,
                    description: data.response
                };
                chatBox.innerHTML += `<div class="message bot-response">${data.response}</div>`;
                chatBox.scrollTop = chatBox.scrollHeight;

                clearOptions();
                recommendButton.style.display = 'none';

                utilityButtons.style.display = 'flex';
                loadingIndicator.style.display = 'none';
            },
            error: function (xhr) {
                chatBox.innerHTML += `<div class="message error-message">Error: ${xhr.responseText}</div>`;
                loadingIndicator.style.display = 'none';
            }
        });
    }

    // Display 'Recommend Another Dish' functionality
    recommendButton.addEventListener('click', function () {
        recommendAnotherDish(storedIngredients, selectedCuisine);
    });

    function recommendAnotherDish(ingredients, cuisine) {
        loadingIndicator.style.display = 'block';

        $.ajax({
            url: '/recommend_dishes',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ ingredients: ingredients.split(','), cuisine: cuisine }),
            success: function (data) {
                const responseText = data.response.replace(/\*/g, '');
                chatBox.innerHTML += `<div class="message bot-response">${responseText}</div>`;
                chatBox.scrollTop = chatBox.scrollHeight;

                clearOptions();
                const dishNames = extractDishNames(responseText);
                if (dishNames.length > 0) {
                    displayOptions(dishNames, true);
                    recommendButton.style.display = 'inline-block';
                    utilityButtons.style.display = 'none';
                }
                loadingIndicator.style.display = 'none';
            },
            error: function (xhr) {
                chatBox.innerHTML += `<div class="message error-message">Error: ${xhr.responseText}</div>`;
                loadingIndicator.style.display = 'none';
            }
        });
    }

    // Extract dish names from response text
    function extractDishNames(responseText) {
        const dishNames = [];
        const lines = responseText.split('\n');
        lines.forEach(function (line) {
            const match = line.match(/^\d+\.\s*([^\:]+)/);
            if (match) {
                dishNames.push(match[1].trim());
            }
        });
        return dishNames;
    }

    // Clear option buttons
    function clearOptions() {
        buttonOptions.innerHTML = '';
        buttonOptions.style.display = 'none';
        recommendButton.style.display = 'none';
    }

    if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', function () {
            window.location.href = '/index';
        });
    }

    // Add bot message to chat
    function addBotMessage(message) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", "bot-response");
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight; // Scroll to the bottom
    }

    // Add user message to chat
    function addUserMessage(message) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", "user-message");
        messageElement.textContent = message;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    // Function to send user message to server
    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message) return;

        // Display user message
        addUserMessage(message);
        userInput.value = "";  // Clear input field
        loadingIndicator.style.display = "block";  // Show loading

        try {
            const response = await fetch("/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            loadingIndicator.style.display = "none";

            if (data.response) {
                addBotMessage(data.response);
            } else {
                addBotMessage("I'm sorry, I didn't understand that.");
            }
        } catch (error) {
            loadingIndicator.style.display = "none";
            addBotMessage("There was an error connecting to FeastBot.");
            console.error("Error:", error);
        }
    }

    // Send button
    sendBtn.addEventListener('click', function () {
        sendMessage();
    });

    // Enter key in input
    userInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    // Event listener for the Save Recipe button
    if (saveRecipeBtn) {
        saveRecipeBtn.addEventListener('click', async function () {
            if (!selectedDishName) {
                modalMessage.textContent = "No dish selected to save!";
                modal.style.display = 'flex';
                return;
            }
            try {
                console.log(recipeDetails);
                const response = await fetch('/save-recipe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(recipeDetails)
                });
                const result = await response.json();

                modalMessage.textContent = result.success ? "Recipe successfully saved!" : result.message ;
                modal.style.display = 'flex';
            } catch (error) {
                console.error("Error saving recipe:", error);
                modalMessage.textContent = "An error occurred while saving the recipe.";
                modal.style.display = 'flex';
            }
        });
    }

    // Close modal when clicking the close button
    if (closeModal) {
        closeModal.addEventListener('click', function () {
            modal.style.display = 'none';
        });
    }

    // Hide modal when clicking outside of it
    window.addEventListener('click', function (event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // fetch('/chat', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ message: "Test message" })
    // }).then(response => response.json()).then(data => console.log(data)).catch(error => console.error(error));
});
