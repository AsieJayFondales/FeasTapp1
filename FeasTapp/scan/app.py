from flask import Flask, jsonify, render_template, request, send_from_directory, redirect, url_for, session
import os
from PIL import Image
from ultralytics import YOLO
import google.generativeai as genai
import nltk
import firebase_admin
from firebase_admin import credentials, initialize_app, auth
import re
import binascii

# Initialize Flask app
app = Flask(__name__)

# Generate a secret key
app.secret_key = binascii.hexlify(os.urandom(24)).decode()

# Configure Generative AI
API_KEY = 'AIzaSyC5KJqK7SJf9qNSRmDdXCeKxI2bnHECyZ0'
genai.configure(api_key=API_KEY)    
model = genai.GenerativeModel('gemini-pro')
chat = model.start_chat(history=[])

nltk.download('punkt')
nltk.download('stopwords')

# Store session states in a dictionary (for simplicity, in production consider using a more robust solution)
sessions = {}
# Construct the credential path
credential_path = os.path.join(os.path.dirname(__file__), 'feastapp-c4d79-firebase-adminsdk-wygrr-fdf39349a4.json')

if not os.path.exists(credential_path):
    raise FileNotFoundError(f"Credential file not found: {credential_path}")

# Initialize Firebase admin with the credential
cred = credentials.Certificate(credential_path)
firebase_admin.initialize_app(cred)

# Construct the absolute path for the YOLO model file
model_path = os.path.join(os.path.dirname(__file__), 'best.pt')
if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model file not found: {model_path}")

# Initialize YOLO model with the absolute path
model = YOLO(model_path)

# Define valid cuisines
valid_cuisines = ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]

@app.route('/')
def home():
    if 'user' in session:
        return render_template('userpref.html', user=session['user'])
    return redirect(url_for('signin'))

@app.route('/main')
def main():
    if 'user' in session:
        return render_template('main.html', user=session['user'])
    return redirect(url_for('signin'))

@app.route('/index')
def chatbot():
    if 'user' in session:
        return render_template('index.html', user=session['user'])
    return redirect(url_for('signin'))

@app.route('/notes')
def notes():
    return render_template('notes.html') #still under construction

@app.route('/signin')
def signin():
    return render_template('signin.html')

@app.route('/signup')
def signup():
    return render_template('signup.html')

@app.route('/userpref')
def userpref():
    if 'user' in session:
        return render_template('userpref.html', user=session['user'])
    return redirect(url_for('signin'))

@app.route('/signout')
def signout():
    session.pop('user', None)
    return redirect(url_for('signin'))

@app.route('/auth/signup', methods=['POST'])
def auth_signup():
    first_name = request.form.get('firstName')
    last_name = request.form.get('lastName')
    email = request.form.get('email')     
    password = request.form.get('password')

    try:
        user = auth.create_user(email=email, password=password)
        session['user'] = {
            'uid': user.uid,
            'email': user.email
        }
        # Redirect to sign-in page after successful signup
        return redirect(url_for('signin'))
    except firebase_admin.auth.AuthError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 401


# new auth to Sign-in
@app.route('/auth/signin', methods=['POST'])
def auth_signin():
    data = request.get_json()
    token = data.get('token')

    if not token:
        return jsonify({'status': 'error', 'message': 'No token provided'}), 400

    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token['uid']
        user = auth.get_user(uid)

        # Establish session
        session['user'] = {
            'uid': user.uid,
            'email': user.email
        }

        return jsonify({'status': 'success'}), 200
    except firebase_admin.auth.InvalidIdTokenError:
        return jsonify({'status': 'error', 'message': 'Invalid token'}), 401
    except firebase_admin.auth.ExpiredIdTokenError:
        return jsonify({'status': 'error', 'message': 'Expired token'}), 401
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/send_message', methods=['POST'])
def send_message():
    session_id = request.json.get('session_id', 'default')
    user_message = request.json['message']

    if session_id not in sessions:
        sessions[session_id] = {'state': 'ask_cuisine'}

    state = sessions[session_id]['state']
    response_text = ""
    show_buttons = False
    buttons = []
    dish_name = ""

    try:
        if state == 'ask_cuisine':
            response_text = "Which cuisine do you prefer?"
            buttons = valid_cuisines
            show_buttons = True
            sessions[session_id]['state'] = 'ask_ingredients'

        elif state == 'ask_ingredients':
            if user_message not in valid_cuisines:
                response_text = "Please choose a valid cuisine from the options provided."
                show_buttons = True
                buttons = valid_cuisines
            else:
                sessions[session_id]['cuisine'] = user_message
                response_text = f"You chose {user_message} cuisine. Please list the ingredients you have."
                sessions[session_id]['state'] = 'verify_ingredients'

        elif state == 'verify_ingredients':
            cuisine = sessions[session_id]['cuisine']
            ingredients = user_message.split(',')

            valid_ingredients = verify_ingredients_with_gemini(cuisine, ingredients)
            if not valid_ingredients:
                response_text = "The ingredients provided are not suitable for the selected cuisine. Please provide valid ingredients."
            else:
                sessions[session_id]['ingredients'] = valid_ingredients
                response_text, buttons = recommend_dishes(cuisine, valid_ingredients)
                if buttons:
                    sessions[session_id]['state'] = 'show_dish_details'
                else:
                    response_text = "No valid dishes found. Please try with different ingredients."
                    sessions[session_id]['state'] = 'ask_cuisine'
                    show_buttons = True

        elif state == 'show_dish_details':
            if user_message == "Recommend another set of dishes":
                cuisine = sessions[session_id]['cuisine']
                valid_ingredients = sessions[session_id].get('ingredients', [])
                response_text, buttons = recommend_dishes(cuisine, valid_ingredients)
                # Stay in the current state to allow multiple recommendations
                if not buttons:
                    response_text = "No valid dishes found. Please try with different ingredients."
                    show_buttons = True
                    buttons = valid_cuisines
                    sessions[session_id]['state'] = 'ask_cuisine'
            else:
                dish_name = user_message
                response = chat.send_message(f"Give details for the {sessions[session_id]['cuisine']} dish named {dish_name}. Include nutritional information, common allergens, and possible substitutions.")
                response_text = format_dish_details(response.text)
                buttons = ["Restart Conversation"]
                sessions[session_id]['state'] = 'ask_cuisine'
                show_buttons = True

        elif user_message == "Restart Conversation":
            response_text = "Restarting conversation..."
            sessions[session_id]['state'] = 'ask_cuisine'
            show_buttons = True
            buttons = valid_cuisines

        else:
            dish_name = user_message
            response = chat.send_message(f"Give details for the {sessions[session_id]['cuisine']} dish named {dish_name}. Include nutritional information, common allergens, and possible substitutions.")
            response_text = format_dish_details(response.text)
            buttons = ["Restart Conversation"]
            sessions[session_id]['state'] = 'ask_cuisine'
            show_buttons = True

        return jsonify({'response': response_text, 'show_buttons': True if buttons else False, 'buttons': buttons, 'recipe_name': dish_name})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'response': "Sorry, I encountered an error. Please try again.", 'show_buttons': False})

def recommend_dishes(cuisine, ingredients):
    response = chat.send_message(f"Recommend top 5 {cuisine} dishes using {', '.join(ingredients)}.")
    dish_recommendations = filter_dish_lines(response.text)

    if dish_recommendations:
        response_text = "Here are another set of dishes I recommend:<br><br>"
        response_text += "<ul>"
        for dish in dish_recommendations:
            response_text += f"<li>{dish}</li>"
        response_text += "</ul>"
        buttons = dish_recommendations + ["Recommend another set of dishes"]
        return response_text, buttons
    else:
        return "No valid dishes found. Please try with different ingredients.", []

def verify_ingredients_with_gemini(cuisine, ingredients):
    try:
        response = chat.send_message(f"Verify if these ingredients are suitable for {cuisine} cuisine: {', '.join(ingredients)}.")
        valid_ingredients = [word.strip() for word in ingredients if word.strip().lower() in response.text.lower()]
        return valid_ingredients
    except Exception as e:
        print(f"Error verifying ingredients: {e}")
        return []

def filter_dish_lines(text):
    lines = text.split('\n')
    filtered_lines = [line.strip() for line in lines if line.strip() and line.strip()[0].isdigit()]
    return filtered_lines

def format_dish_details(text):
    sections = text.split("\n\n")
    formatted_text = ""
    for section in sections:
        if section.startswith("Ingredients"):
            formatted_text += f"<strong>{section.split(':')[0]}:</strong><br>{section.split(':')[1].strip().replace('\n', '<br>')}"
        elif section.startswith("Instructions"):
            formatted_text += f"<strong>{section.split(':')[0]}:</strong><br>{section.split(':')[1].strip().replace('\n', '<br>')}"
        elif section.startswith("Nutritional Information"):
            formatted_text += f"<strong>{section.split(':')[0]}:</strong><br>{section.split(':')[1].strip().replace('\n', '<br>')}"
        elif section.startswith("Common Allergens"):
            formatted_text += f"<strong>{section.split(':')[0]}:</strong><br>{section.split(':')[1].strip().replace('\n', '<br>')}"
        elif section.startswith("Possible Substitutions"):
            formatted_text += f"<strong>{section.split(':')[0]}:</strong><br>{section.split(':')[1].strip().replace('\n', '<br>')}"
        else:
            formatted_text += section.strip().replace('\n', '<br>')
        formatted_text += "<br><br>"
    return formatted_text

@app.route("/detect", methods=["POST"])
def detect():
    try:
        buf = request.files["image_file"]
        image = Image.open(buf.stream)
        boxes = detect_objects_on_image(image)
        return jsonify(boxes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
    return output

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

# Static file serving
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

# Run the Flask app
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True, use_reloader=False)
