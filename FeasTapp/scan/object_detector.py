import os
import json
import requests
from flask import Flask, render_template, request, Response, send_from_directory, url_for
from waitress import serve
from PIL import Image
import firebase_admin
from firebase_admin import credentials, initialize_app
from ultralytics import YOLO

# Construct the credential path
credential_path = os.path.join(os.path.dirname(__file__), 'feastapp-c4d79-firebase-adminsdk-wygrr-5dee5a902c.json')

# Check if the credential file exists
if not os.path.exists(credential_path):
    raise FileNotFoundError(f"Credential file not found: {credential_path}")

# Initialize Firebase admin with the credential
cred = credentials.Certificate(credential_path)
firebase_admin.initialize_app(cred)

# Construct the absolute path for the YOLO model file
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')

# Check if the model file exists
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model file not found: {model_path}")

# Initialize YOLO model with the absolute path
model = YOLO(model_path)

# Initialize Flask app
app = Flask(__name__, static_folder='static')

# Sample dish recommendation function
def classify_ingredient(ingredient):
    main_ingredients = [
    'chicken', 'fish', 'egg', 'pork', 'tomato', 'garlic', 'ginger', 'onion', 
    'lemon', 'calamansi', 'coconut milk', 'flour', 'chili', 'milk'
    ]

    condiments = [
        'bagoong', 'bay leaves', 'black pepper', 'fish sauce', 'salt', 'soy sauce', 
        'sugar', 'vinegar'
    ]   

    if ingredient in main_ingredients:
        return 'Main Ingredient'
    elif ingredient in condiments:
        return 'Condiment'
    else:
        return 'Unknown'

# Route to render the main scan page
@app.route("/")
def root():
    return render_template("scan.html")

# Route to render the chatbot page
@app.route("/chatbot")
def chatbot():
    return render_template("chatbot/chatbot.html")

# Route to render the main page
@app.route("/main")
def main():
    return render_template("main/main.html")

# Static file serving
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# Object detection route
@app.route("/detect", methods=["POST"])
def detect():
    try:
        buf = request.files["image_file"]
        image = Image.open(buf.stream)
        boxes = detect_objects_on_image(image)
        return Response(json.dumps(boxes), mimetype='application/json')
    except Exception as e:
        return Response(json.dumps({'error': str(e)}), mimetype='application/json', status=500)

# Object detection logic
def detect_objects_on_image(image):
    results = model.predict(image)
    result = results[0]
    output = []
    ingredients = {'Main Ingredients': [], 'Condiments': []}
    for box in result.boxes:
        x1, y1, x2, y2 = [round(x) for x in box.xyxy[0].tolist()]
        class_id = box.cls[0].item()
        prob = round(box.conf[0].item(), 2)
        ingredient = result.names[class_id]
        category = classify_ingredient(ingredient)
        output.append([x1, y1, x2, y2, ingredient, prob, category])
        if category == 'Main Ingredient':
            ingredients['Main Ingredients'].append(ingredient)
        elif category == 'Condiment':
            ingredients['Condiments'].append(ingredient)
    send_ingredients_to_chatbot(ingredients)  # Send ingredients to chatbot
    return output

def send_ingredients_to_chatbot(ingredients):
    url = 'http://127.0.0.1:5000/receive_ingredients'
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, json={'ingredients': ingredients}, headers=headers)
        if response.status_code == 200:
            print("Ingredients sent successfully:", response.json())
        else:
            print("Failed to send ingredients, status code:", response.status_code)
    except requests.exceptions.RequestException as e:
        print("Failed to connect to chatbot server:", e)

# Run the Flask app
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True, use_reloader=False)
