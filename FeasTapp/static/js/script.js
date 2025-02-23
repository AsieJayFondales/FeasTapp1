document.addEventListener('DOMContentLoaded', function () {
    const video = document.getElementById('video');
    const cameraButton = document.getElementById('camera-btn');
    const closeCameraButton = document.getElementById('close-camera-btn');
    const videoContainer = document.querySelector('.video-container');
    const canvas = document.getElementById('canvas');
    const shutterButton = document.getElementById('shutter-button');
    const modal = document.getElementById('ingredient-modal');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadInput = document.getElementById('uploadInput');
    const scanStatus = document.getElementById('scan-status');

    const ingredientPopup = document.getElementById('ingredient-popup');
    const editIngredientsBtn = document.getElementById('edit-ingredients-btn');

    const chooseCuisineBtn = document.getElementById('choose-cuisine-btn');
    const cuisinePopup = document.getElementById('cuisine-dish-popup'); // Updated popup for cuisine and dishes
    const cuisineList = document.getElementById('cuisine-list');
    const dishHeader = document.getElementById('dish-header');
    const dishList = document.getElementById('dish-list');
    const closeCuisinePopupBtn = document.getElementById('close-cuisine-dish-popup-btn');
    const ingredientCheckModal = document.getElementById('ingredient-check-modal');
    const closeIngredientCheckBtn = document.getElementById('close-ingredient-check');

    const editIngredientBox = document.getElementById('edit-ingredient-box');
    const saveIngredientsBtn = document.getElementById('save-ingredients-btn');
    const editMainIngredients = document.getElementById('edit-main-ingredients');
    const editCondiments = document.getElementById('edit-condiments');
    const mainIngredientsList = document.getElementById('main-ingredients');
    const condimentsList = document.getElementById('condiments');
    const closeIngredientPopupBtn = document.getElementById('close-ingredient-popup-btn');

    const detectedImage = document.createElement('img');
    detectedImage.style.maxWidth = '100%';
    detectedImage.style.border = '1px solid #ccc';

    let detectedIngredients = [];
    let mainIngredientCount = 0;
    let condimentCount = 0;

    // Insert the detected image into the popup dynamically
    const ingredientListDiv = document.getElementById('ingredient-list');
    ingredientListDiv.insertBefore(detectedImage, ingredientListDiv.firstChild);

    // Close the ingredient popup and reset the image canvas
    closeIngredientPopupBtn.addEventListener('click', function () {
        ingredientPopup.style.display = 'none';

        // Clear the canvas content after closing the modal
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Optionally, hide the canvas to make it disappear from view
        canvas.style.display = 'none';
    });

    // Camera and Upload functionality
    cameraButton.addEventListener('click', function () {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function (stream) {
                video.srcObject = stream;
                video.play();
                videoContainer.style.display = 'block';
                closeCameraButton.style.display = 'block';
                canvas.style.display = 'none';
                shutterButton.style.display = 'block';
            })
            .catch(function (error) {
                console.error("Error accessing the camera: ", error);
                alert('Unable to access camera: ' + error.message);
            });
    });

    // Close the camera stream
    closeCameraButton.addEventListener('click', function () {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        videoContainer.style.display = 'none';
    });

    // Capture the image from the video feed
    shutterButton.addEventListener('click', function () {
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
            sendImageToBackend(blob);
        }, 'image/jpeg');
    });

    // Upload functionality (uploading photos)
    uploadBtn.addEventListener('click', function () {
        uploadInput.click();
    });

    uploadInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        sendImageToBackend(file);
    });

    // Function to send image to the backend
    async function sendImageToBackend(imageBlob) {
        const formData = new FormData();
        formData.append('image_file', imageBlob, 'captured_image.jpg');
    
        scanStatus.style.display = 'block';
        ingredientPopup.style.display = 'none';
    
        try {
            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });
    
            const result = await response.json();
    
            if (response.ok) {
                if (result.boxes && result.boxes.length > 0) {
                    drawImageAndBoxes(imageBlob, result.boxes);
                    listDetectedIngredients(result.boxes);
                }
            } else {
                // Show the error message in the custom popup
                console.error("Error from server:", result.error);
                ingredientCheckModal.style.display = 'block';
                ingredientCheckModal.querySelector('.modal-content').innerText = result.error;
            }
        } catch (error) {
            console.error("Error fetching ingredients:", error);
            ingredientCheckModal.style.display = 'block';
            ingredientCheckModal.querySelector('.modal-content').innerText = 'An error occurred during detection.';
        }
    }
    

    // Draw the scanned image with bounding boxes
    function drawImageAndBoxes(file, boxes) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;

            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 3;
            ctx.font = "18px serif";

            if (Array.isArray(boxes)) {
                boxes.forEach(([x1, y1, x2, y2, label]) => {
                    const rectX = x1 * scale + x;
                    const rectY = y1 * scale + y;
                    const rectWidth = (x2 - x1) * scale;
                    const rectHeight = (y2 - y1) * scale;
                    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

                    ctx.fillStyle = "#00ff00";
                    const width = ctx.measureText(label).width;
                    ctx.fillRect(rectX, rectY, width + 10, 25);
                    ctx.fillStyle = "#000000";
                    ctx.fillText(label, rectX, rectY + 18);
                });
            }

            const dataUrl = canvas.toDataURL('image/png');
            detectedImage.src = dataUrl;
            canvas.style.display = 'block';
        };
    }

    // Display detected ingredients in the popup and count ingredients
    function listDetectedIngredients(boxes) {
        mainIngredientsList.innerHTML = "";
        condimentsList.innerHTML = "";
        detectedIngredients = [];
        mainIngredientCount = 0;
        condimentCount = 0;

        const mainIngredients = new Set();
        const condiments = new Set();

        if (Array.isArray(boxes)) {
            boxes.forEach(([x1, y1, x2, y2, label, prob, category]) => {
                console.log(`Detected: ${label} - Probability: ${prob} - Category: ${category}`);
                if (category === 'Main Ingredient') {
                    mainIngredients.add(label);
                    mainIngredientCount++;
                    detectedIngredients.push(label);
                } else if (category === 'Condiment') {
                    condiments.add(label);
                    condimentCount++;
                    detectedIngredients.push(label);
                } else {
                    console.warn(`Unknown category for ${label}`);
                }
            });
        }

        mainIngredients.forEach(ingredient => {
            const listItem = document.createElement("li");
            listItem.textContent = ingredient;
            mainIngredientsList.appendChild(listItem);
        });

        condiments.forEach(ingredient => {
            const listItem = document.createElement("li");
            listItem.textContent = ingredient;
            condimentsList.appendChild(listItem);
        });

        scanStatus.style.display = 'none';
        ingredientPopup.style.display = 'flex';

        editMainIngredients.value = Array.from(mainIngredients).join(', ');
        editCondiments.value = Array.from(condiments).join(', ');
    }

    function displayMessage(message) {
        // Format the message content with line breaks, headers, and lists
        const formattedMessage = message
            .replace(/##\s?(.+)/g, '<h3>$1</h3>')                      // Convert Markdown headers
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')           // Bold for **text**
            .replace(/\d+\.\s/g, '<br><br>$&')                          // Add space between list items
            .replace(/\*\s(.+)/g, '<ul><li>$1</li></ul>')               // Convert * bullets to list items
            .replace(/\n/g, '<br>');                                    // Preserve line breaks
    
        const messageElement = document.createElement('div');
        messageElement.classList.add('bot-response');
        messageElement.innerHTML = formattedMessage;
        document.getElementById('chatbot-messages').appendChild(messageElement);
    
        // Auto-scroll to the bottom of the chat
        messageElement.scrollIntoView({ behavior: 'smooth' });
    }            

    // Edit ingredients
    editIngredientsBtn.addEventListener('click', function () {
        editIngredientBox.style.display = 'block';
    });

    saveIngredientsBtn.addEventListener('click', function () {
        const editedMainIngredients = editMainIngredients.value.trim().split(',').map(i => i.trim());
        const editedCondiments = editCondiments.value.trim().split(',').map(i => i.trim());

        mainIngredientsList.innerHTML = "";
        condimentsList.innerHTML = "";

        editedMainIngredients.forEach(ingredient => {
            const listItem = document.createElement("li");
            listItem.textContent = ingredient;
            mainIngredientsList.appendChild(listItem);
        });

        editedCondiments.forEach(ingredient => {
            const listItem = document.createElement("li");
            listItem.textContent = ingredient;
            condimentsList.appendChild(listItem);
        });

        editIngredientBox.style.display = 'none';
    });

    previouslyRecommended = [];

    // Fetch dishes for the selected cuisine
    async function fetchDishes(cuisine, recommendAnother = false) {
        try {
            const response = await fetch('/get-dishes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cuisine: cuisine,
                    ingredients: detectedIngredients,
                    recommend_another: recommendAnother,
                    previously_recommended: previouslyRecommended
                })
            });

            const data = await response.json();
            if (data.dishes && data.dishes.length > 0) {
                dishList.innerHTML = '';

                displayDishOptions(data.dishes);
                dishHeader.style.display = 'block';
                dishList.style.display = 'block';

                previouslyRecommended = data.previously_recommended;

            } else {
                ingredientCheckModal.style.display = 'block';
            }
        } catch (error) {
            console.error("Error fetching dishes:", error);
            ingredientCheckModal.style.display = 'block';
        }
    }

    document.querySelector('#dish-list').addEventListener('click', function(event) {
        if (event.target && event.target.textContent === 'Recommend another set of dishes') {
            const selectedCuisine = document.querySelector('.cuisine-option-selected').textContent;
            fetchDishes(selectedCuisine, true);
        }
    });

    async function fetchDishDetails(dishName) {
        try {
            const response = await fetch(`/get-dish-details?dish=${encodeURIComponent(dishName)}`);
            const dishDetails = await response.json();
            return dishDetails;
        } catch (error) {
            console.error("Error fetching dish details:", error);
            return null;
        }
    }

    function displayDishDetailsModal(dishDetails) {
        const modalContent = document.getElementById('dish-details-modal');
        const formattedContent = `
            <h2>${dishDetails.name}</h2>
            <div class="dish-detail-section">
                ${dishDetails.details
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    .replace(/(?:\r\n|\r|\n)/g, '<br>')}
            </div>
        `;

        modalContent.innerHTML = formattedContent + `
        <div class="button-group">
            <button id="save-recipe-btn">Save Recipe</button>
            <button id="scan-another-btn">Scan Another Image</button>
        </div>
        `;

        const dishDetailsPopup = document.getElementById('dish-details-popup');
        dishDetailsPopup.style.display = 'block';

        document.getElementById('save-recipe-btn').addEventListener('click', function(){
            const dishName = document.querySelector('#dish-details-modal h2').textContent;
            saveRecipeToFirebase(dishName);
        });

        document.getElementById('scan-another-btn').addEventListener('click', function(){
            window.location.href = '/index';
        });
    }

    document.getElementById('close-dish-details-btn').addEventListener('click', function () {
        const dishDetailsPopup = document.getElementById('dish-details-popup');
        dishDetailsPopup.style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        const modal = document.getElementById('dish-details-popup');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    function displayDishOptions(dishes) {
        dishList.innerHTML = '';

        dishes.forEach(dish => {
            const dishButton = document.createElement('button');
            dishButton.textContent = dish;
            dishButton.classList.add('dish-option');
            dishList.appendChild(dishButton);

            dishButton.addEventListener('click', async () => {
                const dishDetails = await fetchDishDetails(dish); 
                if (dishDetails) {
                    displayDishDetailsModal(dishDetails);
                }
            });
        });

        const recommendButton = document.createElement('button');
        recommendButton.textContent = 'Recommend another set of dishes';
        recommendButton.classList.add('recommend-button');

        recommendButton.addEventListener('click', function() {
            const selectedCuisine = document.querySelector('.cuisine-option-selected');
            if (selectedCuisine) {
                const cuisine = selectedCuisine.textContent;
                fetchDishes(cuisine, true);
            } else {
                ingredientCheckModal.style.display = 'block';
            }
        });

        dishList.appendChild(recommendButton);
    }

    chooseCuisineBtn.addEventListener('click', function () {
        if (mainIngredientCount < 1 || condimentCount < 2) {
            ingredientCheckModal.style.display = 'block';
            return;
        }
        const mainIngredients = Array.from(document.querySelectorAll('#main-ingredients li')).map(li => li.textContent);
        const condiments = Array.from(document.querySelectorAll('#condiments li')).map(li => li.textContent);
        const ingredients = [...mainIngredients, ...condiments].join(',');
        window.location.href = `/chatbot?ingredients=${encodeURIComponent(ingredients)}`;
    });

    closeIngredientCheckBtn.addEventListener('click', function () {
        ingredientCheckModal.style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        if (event.target === ingredientCheckModal) {
            ingredientCheckModal.style.display = 'none';
        }
    });

    const validCuisines = ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"];

    function populateCuisineList() {
        cuisineList.innerHTML = '';
        dishHeader.style.display = 'none';
        dishList.style.display = 'none';

        validCuisines.forEach(cuisine => {
            const cuisineItem = document.createElement('button');
            cuisineItem.textContent = cuisine;
            cuisineItem.classList.add('cuisine-option');

            cuisineItem.addEventListener('click', function () {
                document.querySelectorAll('.cuisine-option').forEach(item => {
                    item.classList.remove('cuisine-option-selected');
                });

                cuisineItem.classList.add('cuisine-option-selected');
                previouslyRecommended = [];
                fetchDishes(cuisine);
            });

            cuisineList.appendChild(cuisineItem);
        });
    }

    closeCuisinePopupBtn.addEventListener('click', function () {
        cuisinePopup.style.display = 'none';
    });

    window.addEventListener('click', function (event) {
        if (event.target === cuisinePopup) {
            cuisinePopup.style.display = 'none';
        }
    });

    async function saveRecipeToFirebase(dishName) {
        try {
            const response = await fetch('/save-recipe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dish_name: dishName
                })
            });
            const data = await response.json();
            if (data.success) {
                alert('Recipe saved successfully!');
            } else {
                ingredientCheckModal.style.display = 'block';
            }
        } catch (error) {
            console.error("Error saving recipe:", error);
        }
    }

    async function saveRecipe(fullMessage) {
        const response = await fetch('/save-recipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullMessage)
        });
        const result = await response.json();
        alert(result.success ? result.message : `Failed to save recipe: ${result.message}`);
    }
    
    // Assuming this function is called after receiving a response from the chatbot with full dish details
    function displayChatbotResponse(responseText, dishName, cuisine, ingredients, instructions) {
        const responseContainer = document.getElementById('chatbot-response');
        responseContainer.innerHTML = responseText;
    
        const saveButton = document.createElement('button');
        saveButton.innerText = 'Save Recipe';
        saveButton.onclick = () => saveRecipe({ 
            dish_name: dishName, 
            cuisine: cuisine, 
            ingredients: ingredients, 
            instructions: instructions 
        });
        responseContainer.appendChild(saveButton);
    }

});

