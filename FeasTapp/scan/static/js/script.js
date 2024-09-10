document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('video');
    const cameraButton = document.getElementById('camera-btn');
    const closeCameraButton = document.getElementById('close-camera-btn');
    const videoContainer = document.querySelector('.video-container');
    const uploadInput = document.getElementById('uploadInput');
    const canvas = document.getElementById('canvas');
    const scanStatus = document.getElementById('scan-status');
    const ingredientList = document.getElementById('ingredientList');
    const mainIngredientsList = document.getElementById('main-ingredients');
    const condimentsList = document.getElementById('condiments');
    const userInput = document.getElementById('user-input');
    const chatBox = document.getElementById('chat-box');
    const sendBtn = document.getElementById('send-btn');
    const buttonOptions = document.getElementById('button-options');
    const loadingIndicator = document.getElementById('loading-indicator');
    const shutterButton = document.getElementById('shutter-button');

    const modal = document.getElementById('verification-modal');
    const previewImage = document.getElementById('preview-image');
    const proceedBtn = document.getElementById('proceed-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const closeModal = document.getElementById('close-modal');

    // Camera and Upload functionality
    cameraButton.addEventListener('click', function() {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                video.srcObject = stream;
                video.play();
                videoContainer.style.display = 'block';
                closeCameraButton.style.display = 'block';
                canvas.style.display = 'none'; // Hide canvas when camera is active
            })
            .catch(function(error) {
                console.error("Error accessing the camera: ", error);
                alert('Unable to access camera: ' + error.message);
            });
    });

    uploadInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        const formData = new FormData();
        formData.append('image_file', file, file.name);

        scanStatus.style.display = 'block';
        ingredientList.style.display = 'none';
        scanStatus.textContent = 'Processing the photo...';

        const response = await fetch('/detect', {
            method: 'POST',
            body: formData
        });
        const boxes = await response.json();

        scanStatus.textContent = 'Scan complete!';

        draw_image_and_boxes(file, boxes);
        list_detected_ingredients(boxes);
    });

    shutterButton.addEventListener("click", () => {
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function(blob) {
            const imgURL = URL.createObjectURL(blob);
            previewImage.src = imgURL;
            modal.style.display = 'flex'; // Show modal
        }, 'image/jpeg');
    });

    proceedBtn.addEventListener("click", async () => {
        const context = canvas.getContext('2d');
        canvas.toBlob(async function(blob) {
            const formData = new FormData();
            formData.append('image_file', blob, 'snapshot.jpg');

            scanStatus.style.display = 'block';
            ingredientList.style.display = 'none';
            scanStatus.textContent = 'Processing the photo...';

            const response = await fetch('/detect', {
                method: 'POST',
                body: formData
            });
            const boxes = await response.json();

            scanStatus.textContent = 'Scan complete!';

            draw_image_and_boxes(blob, boxes);
            list_detected_ingredients(boxes);
            video.srcObject.getTracks().forEach(track => track.stop());
            videoContainer.style.display = 'none';
            modal.style.display = 'none'; // Hide modal
        }, 'image/jpeg');
    });

    retakeBtn.addEventListener("click", () => {
        modal.style.display = 'none'; // Hide modal to retake photo
    });

    closeModal.addEventListener("click", () => {
        modal.style.display = 'none'; // Hide modal if user closes it
    });

    closeCameraButton.addEventListener('click', function() {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        videoContainer.style.display = 'none';
    });

    const uploadButton = document.getElementById("upload-btn");
    uploadButton.addEventListener("click", () => {
        uploadInput.click();
    });

    function draw_image_and_boxes(file, boxes) {
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

            canvas.style.display = 'block';
        };
    }

    function list_detected_ingredients(boxes) {
        mainIngredientsList.innerHTML = "";
        condimentsList.innerHTML = "";

        const mainIngredients = new Set();
        const condiments = new Set();

        boxes.forEach(([x1, y1, x2, y2, label, prob, category]) => {
            if (category === 'Main Ingredient') {
                mainIngredients.add(label);
            } else if (category === 'Condiment') {
                condiments.add(label);
            }
        });

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
        ingredientList.style.display = 'block';

        // Automatically populate the chatbot input with detected ingredients
        const allIngredients = Array.from(mainIngredients).concat(Array.from(condiments));
        userInput.value = allIngredients.join(', ');

        // Optionally send ingredients to the chatbot immediately
        sendIngredientsToChatbot(allIngredients);
    }

    async function sendIngredientsToChatbot(ingredients) {
        try {
            const response = await fetch('/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_id: 'default', message: ingredients.join(', ') })
            });
            const data = await response.json();
            if (data.show_buttons) {
                displayButtonOptions(data.buttons);
            }
            return data.response || "Sorry, I didn't understand that.";
        } catch (error) {
            console.error("Error sending ingredients to chatbot:", error);
            return "An error occurred. Please try again.";
        }
    }

    sendBtn.addEventListener('click', async () => {
        const message = userInput.value.trim();
        if (message) {
            addMessageToChat('You', message);
            userInput.value = '';
            displayLoading(true);
            const response = await sendMessageToChatbot(message);
            displayLoading(false);
            addMessageToChat('Bot', response);
        }
    });

    async function sendMessageToChatbot(message) {
        try {
            const response = await fetch('/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session_id: 'default', message: message })
            });
            const data = await response.json();
            if (data.show_buttons) {
                displayButtonOptions(data.buttons);
            }
            return data.response || "Sorry, I didn't understand that.";
        } catch (error) {
            console.error("Error sending message to chatbot:", error);
            return "An error occurred. Please try again.";
        }
    }

    function addMessageToChat(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender === 'You' ? 'user-message' : 'bot-message');
        messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function displayButtonOptions(options) {
        buttonOptions.innerHTML = '';
        options.forEach(option => {
            const button = document.createElement('button');
            const dishNameMatch = option.match(/\*\*(.*?)\*\*/);
            const buttonText = dishNameMatch ? dishNameMatch[1] : option;

            button.textContent = buttonText;
            button.className = 'option-button';
            button.addEventListener('click', async () => {
                addMessageToChat('You', buttonText);
                if (buttonText === "Ask for another set of dishes") {
                    const ingredients = userInput.value.trim().split(',');
                    const response = await sendIngredientsToChatbot(ingredients);
                    addMessageToChat('Bot', response);
                } else {
                    const response = await sendMessageToChatbot(buttonText);
                    addMessageToChat('Bot', response);
                }
            });
            buttonOptions.appendChild(button);
        });
        buttonOptions.style.display = 'grid';
        buttonOptions.style.gridTemplateColumns = 'repeat(3, 1fr)';
    }

    function displayLoading(show) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
});
