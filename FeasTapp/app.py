from flask import Flask, jsonify, render_template, request, send_from_directory, redirect, url_for, session, flash
import os
from PIL import Image
from ultralytics import YOLO
import torch
from torchvision import models
import google.generativeai as genai
import nltk
import firebase_admin
from firebase_admin import credentials, auth
from firebase_admin import firestore
import re
import binascii
from datetime import timedelta
from datetime import datetime
from torchvision.transforms import functional as F
from torchvision.ops import nms
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Generate a secret key
app.secret_key = binascii.hexlify(os.urandom(24)).decode()

# Ensure session cookies are properly set and handled
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=60)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production over HTTPS

# Configure Generative AI (Store API key securely using environment variables)
genai.configure(api_key="AIzaSyC5KJqK7SJf9qNSRmDdXCeKxI2bnHECyZ0")  # Ensure API key is properly retrieved
model = genai.GenerativeModel("gemini-1.5-flash")

nltk.download('punkt')
nltk.download('stopwords')

# Firebase admin initialization
cred = credentials.Certificate(os.path.join(os.path.dirname(__file__), 'feastapp-c4d79-firebase-adminsdk-wygrr-fdf39349a4.json'))
firebase_admin.initialize_app(cred)

# Initialize Firestore
db = firestore.client()

# Initialize YOLO model
yolo_model = YOLO(os.path.join(os.path.dirname(__file__), 'best.pt'))

# Load the Mask R-CNN model
mrcnn_weights_path = os.path.join(os.path.dirname(__file__), 'mrcnn_best.pt')
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

mrcnn = models.detection.maskrcnn_resnet50_fpn(pretrained=False)
checkpoint = torch.load(mrcnn_weights_path, map_location=device)
model_state = checkpoint['model'] if 'model' in checkpoint else checkpoint

# Remove the box and mask predictor layers to avoid size mismatch errors
for key in list(model_state.keys()):
    if "box_predictor" in key or "mask_predictor" in key:
        del model_state[key]

# Load compatible layers from the state dict
mrcnn.load_state_dict(model_state, strict=False)

# Reinitialize classifier layers for 40 classes (39 + background)
NUM_CLASSES = 40
in_features = mrcnn.roi_heads.box_predictor.cls_score.in_features
mrcnn.roi_heads.box_predictor = FastRCNNPredictor(in_features, NUM_CLASSES)
in_features_mask = mrcnn.roi_heads.mask_predictor.conv5_mask.in_channels
hidden_layer = 256
mrcnn.roi_heads.mask_predictor = MaskRCNNPredictor(in_features_mask, hidden_layer, NUM_CLASSES)

mrcnn.to(device)
mrcnn.eval()

# Ingredient class names
ingredient_names = [
    "ampalaya", "banana", "bay-leaves", "bell-pepper", "brown-sugar", "butter",
    "cabbage", "calamansi", "carrots", "cauliflower", "cheese", "chicken",
    "cucumber", "curry powder", "egg", "eggplant", "flour", "garlic",
    "ginisa-mix", "kangkong", "malunggay", "mayonnaise", "milk", "monggo",
    "muscovado", "oil", "onion", "papaya", "pepper", "pork meat", "potato",
    "pumpkin", "radish", "rice", "saluyot", "soy sauce", "tomato", "vinegar",
    "white sugar"
]

valid_cuisines = ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]

# Home route
@app.route('/')
def home():
    if 'user' in session:
        return render_template('userpref.html', user=session['user'])
    return redirect(url_for('signin'))

# Main route
@app.route('/main')
def main():
    if 'user' not in session:
        return redirect(url_for('signin'))
    return render_template('main.html', user=session['user'])

# Signin route
@app.route('/signin', methods=['GET'])
def signin():
    return render_template('signin.html')

# Signin authentication
# Signin authentication
@app.route('/auth/signin', methods=['POST'])
def auth_signin():
    data = request.get_json()
    id_token = data.get('idToken')

    try:
        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        user_email = decoded_token['email']

        # Start session with user information
        session['user'] = {
            'uid': user_id,
            'email': user_email
        }
        session.permanent = True

        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


# Signup route
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html')
    elif request.method == 'POST':
        try:
            data = request.get_json()
            first_name = data.get('firstName')
            last_name = data.get('lastName')
            email = data.get('email')
            password = data.get('password')

            # Create the user in Firebase Authentication
            user = auth.create_user(email=email, password=password)

            # Store user session
            session['user'] = {
                'uid': user.uid,
                'email': user.email,
                'firstName': first_name,
                'lastName': last_name,
                'is_new': True
            }
            session.permanent = True

            # Save user data in Firestore
            db.collection('users').document(user.uid).set({
                'firstName': first_name,
                'lastName': last_name,
                'email': email,
                'isNewUser': True,
                'createdAt': datetime.now()
            })

            return jsonify({'status': 'success'}), 200

        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500

# User preferences route
@app.route('/userpref')
def userpref():
    # Check if the user is new and in session
    if 'user' in session and session['user'].get('is_new'):
        # Clear the new user flag after they visit userpref for the first time
        session['user']['is_new'] = False
        return render_template('userpref.html', user=session['user'])
    
    # If not a new user or not in session, redirect to the main page
    return redirect(url_for('main'))

# Signout route
@app.route('/signout')
def signout():
    session.pop('user', None)
    return redirect(url_for('signin'))

# Detect route for object detection
@app.route("/detect", methods=["POST"])
def detect():
    try:
        # Get the uploaded image
        buf = request.files["image_file"]
        image = Image.open(buf.stream).convert("RGB")
        
        # Run detection
        boxes = detect_objects_on_image(image)

        # Initialize counters
        main_ingredient_count = 0
        condiment_count = 0

        # Check if any boxes were detected
        if not boxes:
            print("No ingredients detected.")
            return jsonify({"error": "No ingredients detected."}), 400

        # Count main ingredients and condiments
        for box in boxes:
            category = box[-1]  # Last item in box array should be the category
            if category == 'Main Ingredient':
                main_ingredient_count += 1
            elif category == 'Condiment':
                condiment_count += 1

        # Debugging logs
        print("Main Ingredient Count:", main_ingredient_count)
        print("Condiment Count:", condiment_count)

        # Check if the condition is met
        if main_ingredient_count >= 1 and condiment_count >= 2:
            print("Conditions met. Returning detected boxes.")
            return jsonify({"boxes": boxes}), 200
        else:
            print("Conditions not met. Not enough ingredients.")
            return jsonify({"error": "Detection condition not met: at least 1 main ingredient and 2 condiments required."}), 400

    except Exception as e:
        # If there's an error, log it and return an error response
        print(f"Exception in /detect endpoint: {str(e)}")
        return jsonify({'error': f"Detection error: {str(e)}"}), 500

def is_food_related(message):
    """
    Determines if the message is related to cuisine, dishes, or ingredients by checking for any relevant
    words related to food concepts, ingredients, dishes, or cuisines.
    """
    food_related_terms = [
        "recipe", "cuisine", "dish", "ingredient", "food", "meal", "course", "kitchen", "cooking", "flavor",
        "taste", "appetizer", "dessert", "snack", "spice", "seasoning", "herb", "condiment", "garnish",
        "breakfast", "lunch", "dinner", "brunch", "supper", "side dish", "main course", "entree",
        "grill", "bake", "roast", "fry", "steam", "boil", "saute", "braise", "smoke", "poach", 
        "marinate", "barbecue", "sous-vide", "stir-fry", "slow cook", "broil", "blanch", "deep fry",
        "italian", "mexican", "chinese", "japanese", "indian", "thai", "french", "spanish", "mediterranean",
        "greek", "korean", "vietnamese", "lebanese", "ethiopian", "brazilian", "caribbean", "moroccan",
        "turkish", "german", "russian", "peruvian", "argentinian", "portuguese", "cuban", "filipino",
        "soup", "salad", "stew", "casserole", "pasta", "noodles", "pizza", "taco", "burger", "sandwich", 
        "sushi", "dumplings", "wrap", "curry", "pastry", "bread", "cake", "pie", "pudding", "ice cream",
        "chicken", "beef", "pork", "fish", "seafood", "egg", "cheese", "butter", "cream", "milk",
        "tofu", "beans", "lentils", "mushroom", "potato", "tomato", "lettuce", "carrot", "broccoli",
        "spinach", "onion", "garlic", "ginger", "pepper", "rice", "pasta", "bread"
    ]
    # Check if any term from the list exists in the message
    return any(term in message.lower() for term in food_related_terms)

@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.get_json()
    ingredients = data.get('ingredients')
    cuisine = data.get('cuisine')
    user_message = data.get('message', '')

    # If the user is selecting a cuisine, skip the filtering logic and process normally
    if ingredients and cuisine:
        # Construct the prompt using both the cuisine and ingredients
        prompt = f"List the top 5 {cuisine} dishes using these ingredients: {', '.join(ingredients)}. Only list the dish names and short descriptions, no other information."
        
        try:
            # Generate the response using Gemini's API
            response = model.generate_content(prompt)
            response_text = response.text
            dish_names = extract_dish_names(response_text)  # Extract dish names from response

            # Save the dish names in session to avoid repetition in next recommendations
            session['previous_dishes'] = dish_names

            return jsonify({'response': response_text})

        except Exception as e:
            print(f"Error when calling Gemini API: {str(e)}")
            return jsonify({'error': str(e)}), 500

    # Otherwise, handle a general message, applying food-related filtering
    if user_message:
        # Define keywords and/or logic here to determine if the message is food-related
        if not is_food_related(user_message):
            return jsonify({'response': "I'm here to help with anything related to cuisine, dishes, and ingredients from around the world. Please ask something about food!"})

        # Fallback response for general food queries (not specific to ingredients or cuisine)
        return jsonify({'response': "What cuisine are you interested in? Or would you like a recipe suggestion?"})
    
@app.route('/saved_recipes', methods=['GET'])
def saved_recipes():
    user_id = session.get('user', {}).get('uid')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401

    recipes_ref = db.collection('users').document(user_id).collection('saved_recipes')
    saved_recipes = recipes_ref.stream()

    recipes = []
    for recipe in saved_recipes:
        recipe_data = recipe.to_dict()
        recipes.append({
            'id': recipe.id,  # Firestore document ID
            'name': recipe_data.get('name'),
            'cuisine': recipe_data.get('cuisine'),
            'ingredients': recipe_data.get('ingredients'),
            'instructions': recipe_data.get('instructions'),
            'saved_at': recipe_data.get('savedAt').strftime('%B %d, %Y at %I:%M %p')
        })
    
    return render_template('saved_recipes.html', recipes=recipes)

# Helper function to extract dish names from the response
def extract_dish_names(response_text):
    dish_names = []
    for line in response_text.splitlines():
        match = re.match(r"^\d+\.\s*([^\:]+)", line)
        if match:
            dish_names.append(match.group(1).strip())
    return dish_names

@app.route('/get_dish_details', methods=['POST'])
def get_dish_details():
    data = request.get_json()
    dish_name = data.get('dish_name')

    if not dish_name:
        return jsonify({'error': 'Dish name is required.'}), 400

    # Create a prompt for detailed dish information
    prompt = f"Provide detailed information for the dish '{dish_name}'. Include details such as Name, Origin, Nutritional Information, Common Allergens, Possible Substitution, Instructions, and Tips."

    try:
        # Generate the response using Gemini's API
        response = model.generate_content(prompt)
        response_text = response.text

        return jsonify({'response': response_text})
    except Exception as e:
        print(f"Error fetching dish details: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Object detection helper function
def detect_objects_on_image(image):
    # Perform YOLO and Mask R-CNN detection
    yolo_results = yolo_model.predict(image)
    yolo_result = yolo_results[0]
    
    image_tensor = F.to_tensor(image).unsqueeze(0).to(device)
    mrcnn_results = mrcnn(image_tensor)[0]

    # Extract detections from YOLO and Mask R-CNN
    yolo_detections = extract_yolo_detections(yolo_result, confidence_threshold=0.4)
    mrcnn_detections = extract_mrcnn_detections(mrcnn_results, confidence_threshold=0.5)
    
    # Combine and filter detections with NMS
    combined_detections = yolo_detections + mrcnn_detections
    unique_detections = non_max_suppression(combined_detections, iou_threshold=0.3)
    
    # Log the final detections
    print("Final Unique Detections:", unique_detections)
    
    return unique_detections  # Ensure this is returned in the expected format

# Non-max suppression helper
def non_max_suppression(detections, iou_threshold=0.3):
    boxes = torch.tensor([det[:4] for det in detections], dtype=torch.float32)
    scores = torch.tensor([det[5] for det in detections], dtype=torch.float32)
    keep = nms(boxes, scores, iou_threshold=iou_threshold)
    return [detections[i] for i in keep]

def extract_yolo_detections(result, confidence_threshold=0.4):
    output = []
    for box in result.boxes:
        prob = round(box.conf[0].item(), 2)
        if prob >= confidence_threshold:
            x1, y1, x2, y2 = [int(round(x)) for x in box.xyxy[0].tolist()]
            class_id = int(box.cls[0].item())  # Ensure class_id is also an integer
            ingredient = ingredient_names[class_id] if class_id < len(ingredient_names) else f"Class_{class_id}"
            category = classify_ingredient(ingredient)
            output.append([x1, y1, x2, y2, ingredient, prob, category])
    return output

def extract_mrcnn_detections(result, confidence_threshold=0.5):
    output = []
    keep = nms(result['boxes'], result['scores'], iou_threshold=0.3)
    for i in keep:
        prob = result['scores'][i].item()
        if prob >= confidence_threshold:
            x1, y1, x2, y2 = [int(round(coord)) for coord in result['boxes'][i].tolist()]
            class_id = int(result['labels'][i].item())  # Ensure class_id is also an integer
            ingredient = ingredient_names[class_id] if class_id < len(ingredient_names) else f"Class_{class_id}"
            category = classify_ingredient(ingredient)
            output.append([x1, y1, x2, y2, ingredient, prob, category])
    return output

# Classify ingredient as Main Ingredient or Condiment
def classify_ingredient(ingredient):
    main_ingredients = [
        "ampalaya", "banana", "bell-pepper", "cabbage", "carrots", "cauliflower", 
        "chicken", "cucumber", "egg", "eggplant", "kangkong", "malunggay", "monggo", 
        "papaya", "pork meat", "potato", "pumpkin", "radish", "rice", "saluyot", "tomato"
        ]
    condiments = [
        "bay-leaves", "brown-sugar", "butter", "calamansi", "cheese", "curry powder", 
        "flour", "garlic", "ginisa-mix", "mayonnaise", "milk", "muscovado", "oil", "onion", 
        "pepper", "soy sauce", "vinegar", "white sugar"]

    if ingredient in main_ingredients:
        return 'Main Ingredient'
    elif ingredient in condiments:
        return 'Condiment'
    else:
        return 'Unknown'

def format_chatbot_response(response_text):
    # Apply formatting with line breaks and indentation
    formatted_response = response_text.replace("•", "\n  •")  # Indent bullet points
    formatted_response = formatted_response.replace(":", ":\n    ")  # Indent after colons
    
    return formatted_response

@app.route('/recommend_dishes', methods=['POST'])
def recommend_dishes():
    data = request.get_json()
    ingredients = data.get('ingredients')
    cuisine = data.get('cuisine')

    # Ensure both ingredients and cuisine are provided
    if not ingredients or not cuisine:
        return jsonify({'error': 'Missing ingredients or cuisine'}), 400

    # Get previous recommendations from session to avoid repetition
    previous_dishes = session.get('previous_dishes', [])
    prev_dishes_str = ', '.join(previous_dishes) if previous_dishes else "none so far"

    # Construct the prompt to recommend dish names only
    # Update prompt to avoid previous recommendations
    prompt = (
        f"Suggest another top 5 {cuisine} dishes using these ingredients: {', '.join(ingredients)}. "
        f"Make sure they are different from the following dishes: {prev_dishes_str}. "
        "List only the dish names and short descriptions."
    )

    try:
        # Generate the response using Gemini's API
        response = model.generate_content(prompt)
        response_text = response.text
        new_dish_names = extract_dish_names(response_text)  # Extract new dish names

        # Update previous dishes in session with the new recommendations
        session['previous_dishes'] = new_dish_names

        # Return the list of recommended dishes
        return jsonify({'response': response_text})

    except Exception as e:
        print(f"Error when calling Gemini API: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    
    # Log incoming request data
    print("Received data:", data)

    user_message = data.get('message')
    if not user_message:
        return jsonify({'error': 'Message is required'}), 400

    # Check if the user message is food-related
    if not is_food_related(user_message):
        # If not food-related, return a prompt asking the user to ask food-related questions
        return jsonify({'response': "I'm here to help with anything related to cuisine, dishes, and ingredients from around the world. Please ask something about food!"})

    # Create a prompt for Gemini
    prompt = f"Respond to the following message: '{user_message}'"
    print("Generated prompt for Gemini:", prompt)  # Debugging line

    try:
        # Generate the response using Gemini's API
        response = model.generate_content(prompt)

        # Check if response has text
        if not hasattr(response, 'text'):
            raise ValueError("Gemini API response is missing 'text' attribute.")

        response_text = response.text
        print("Gemini response:", response_text)  # Log the response from Gemini

        # Return the response back to the frontend
        return jsonify({'response': response_text})

    except Exception as e:
        error_message = f"Error when calling Gemini API: {str(e)}"
        print(error_message)
        return jsonify({'error': error_message}), 500

@app.route('/save-recipe', methods=['POST'])
def save_recipe():
    if 'user' not in session:
        return jsonify({'success': False, 'message': 'User not signed in'})

    try:
        data = request.get_json()
        dish_name = data.get('dish_name')
        if not dish_name:
            return jsonify({'success': False, 'message': 'Dish name is required.'})

        # Define the current timestamp
        timestamp = datetime.now()

        # Get the user ID from the session
        user_id = session['user']['uid']

        # Save the recipe to Firestore under the "recipes" collection
        db.collection('saved_recipes').document(f"recipe_{int(timestamp.timestamp())}").set({
            'name': dish_name,
            'savedAt': timestamp
        })

        return jsonify({'success': True, 'message': f'Saved {dish_name} successfully!'})

    except Exception as e:
        print(f"Error saving recipe: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to save recipe: {str(e)}'})


# Static file serving
@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


# scan route
@app.route('/index')
def index():
    if 'user' in session:
        return render_template('index.html', user=session['user'])
    return redirect(url_for('signin'))

# Notes route
@app.route('/chatbot')
def chatbot():
    ingredients = request.args.get('ingredients', '')  # Get the ingredients from the query parameter
    return render_template('chatbot.html', ingredients=ingredients)

@app.route('/purecb')
def purecb():
    return render_template('purecb.html')

@app.route('/account_settings', methods=['GET'])
def account_settings():
    if 'user' not in session:
        return redirect(url_for('signin'))  # Ensure this matches your signin route name

    user_info = session['user']  # Assuming user data is stored in the session
    return render_template('account_settings.html', user=user_info)

# Route for About Page
@app.route('/about', methods=['GET'])
def about():
    # Check if the user is logged in
    if 'user' not in session:
        return redirect(url_for('signin'))  # Redirect to signin page if not logged in
    return render_template('about.html')

# Route for Feedback Page
@app.route('/feedback', methods=['GET', 'POST'])
def feedback():
    # Check if the user is logged in
    if 'user' not in session:
        return redirect(url_for('signin'))  # Redirect to signin page if not logged in

    if request.method == 'POST':
        # Handle feedback submission
        feedback_content = request.form.get('feedback')
        # Process or save feedback as needed (e.g., save to the database)
        flash('Thank you for your feedback!', 'success')
        return redirect(url_for('feedback'))  # Redirect to feedback page or any other page

    return render_template('feedback.html')

# Route for Food Preferences Page
@app.route('/food_preferences', methods=['GET', 'POST'])
def food_preferences():
    # Check if the user is logged in
    if 'user' not in session:
        return redirect(url_for('signin'))  # Redirect to signin page if not logged in

    if request.method == 'POST':
        # Handle food preferences submission
        preferences = request.form.getlist('preferences')  # Example for checkbox preferences
        # Process or save preferences as needed (e.g., save to the database)
        flash('Food preferences saved!', 'success')
        return redirect(url_for('food_preferences'))

    return render_template('food_preferences.html')

# Run the Flask app
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, debug=True, use_reloader=False) 
    