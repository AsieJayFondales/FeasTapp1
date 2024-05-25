import os
import json
from flask import Flask, render_template, request, jsonify, session
import google.generativeai as genai
import nltk
from nltk.tokenize import word_tokenize  # Tokenization
from nltk.tag import pos_tag  # POS tagging
import re  # Regular Expressions

# Initialize Flask app
app = Flask(__name__)
app.secret_key = os.urandom(24)  # Generate a random secret key

# Configure Generative AI
API_KEY = 'AIzaSyAb4CKQ23uIo9PH-FwkGmoB3yHoJHaYuOI'
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-pro')
chat = model.start_chat(history=[])

nltk.download('punkt')  # Download tokenizer data
nltk.download('averaged_perceptron_tagger')  # Download POS tagger data

# Store session states in a dictionary (for simplicity, in production consider using a more robust solution)
sessions = {}

@app.route('/')
def root():
    ingredients = session.get('ingredients', {})
    return render_template('chatbot/chatbot.html', ingredients=ingredients)

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
            buttons = ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]
            show_buttons = True
            sessions[session_id]['state'] = 'ask_ingredients'
        elif state == 'ask_ingredients':
            if user_message not in ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]:
                response_text = "Please choose a valid cuisine from the options provided."
                show_buttons = True
                buttons = ["Filipino", "Chinese", "Korean", "Japanese", "Thai", "Indian", "French", "Brazilian", "Mexican"]
            else:
                sessions[session_id]['cuisine'] = user_message
                response_text = f"You chose {user_message} cuisine. Please list the ingredients you have."
                sessions[session_id]['state'] = 'verify_ingredients'
        elif state == 'verify_ingredients':
            cuisine = sessions[session_id]['cuisine']
            ingredients = user_message.split(',')

            # POS Tagging and Ingredient Validation
            valid_ingredients = verify_ingredients_with_pos_tagging(cuisine, ingredients)
            if not valid_ingredients:
                response_text = "The ingredients provided are not suitable for the selected cuisine. Please provide valid ingredients."
            else:
                sessions[session_id]['ingredients'] = valid_ingredients
                response = chat.send_message(f"Recommend top 5 {cuisine} dishes using {', '.join(valid_ingredients)}.")
                dish_recommendations = filter_dish_lines_with_regex(response.text)
                if dish_recommendations:
                    response_text = "Here are the top 5 dishes I recommend:<br><br>"
                    response_text += "<ul>"
                    for dish in dish_recommendations:
                        response_text += f"<li>{dish}</li>"
                    response_text += "</ul>"
                    buttons = dish_recommendations
                    buttons.append("Recommend another set of dishes")
                    sessions[session_id]['state'] = 'show_dish_details'
                else:
                    response_text = "No valid dishes found. Please try with different ingredients."
                    sessions[session_id]['state'] = 'ask_ingredients'
        elif state == 'show_dish_details':
            if user_message == "Recommend another set of dishes":
                cuisine = sessions[session_id]['cuisine']
                ingredients = sessions[session_id]['ingredients']
                response = chat.send_message(f"Recommend another 5 {cuisine} dishes using {', '.join(ingredients)}.")
                dish_recommendations = filter_dish_lines_with_regex(response.text)
                if dish_recommendations:
                    response_text = "Here are another 5 dishes I recommend:<br><br>"
                    response_text += "<ul>"
                    for dish in dish_recommendations:
                        response_text += f"<li>{dish}</li>"
                    response_text += "</ul>"
                    buttons = dish_recommendations
                    buttons.append("Recommend another set of dishes")
                else:
                    response_text = "No more dishes found. Please try with different ingredients."
                    sessions[session_id]['state'] = 'ask_cuisine'
                    show_buttons = True
            else:
                dish_name = user_message
                response = chat.send_message(f"Give details for the {sessions[session_id]['cuisine']} dish named {dish_name}. Include nutritional information, common allergens, and possible substitutions.")
                response_text = format_dish_details(response.text)
                buttons = ["Ask for Recommendation"]
                sessions[session_id]['state'] = 'ask_cuisine'
                show_buttons = True

        # Remove asterisks from the response text
        response_text = response_text.replace('*', '')

        return jsonify({'response': response_text, 'show_buttons': True if buttons else False, 'buttons': buttons, 'recipe_name': dish_name})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'response': "Sorry, I encountered an error. Please try again.", 'show_buttons': False})

@app.route('/receive_ingredients', methods=['POST'])
def receive_ingredients():
    try:
        data = request.json
        print("Received ingredients:", data)
        # Store the ingredients in the session
        session['ingredients'] = data
        return jsonify({'status': 'success'})
    except Exception as e:
        print(f"Error receiving ingredients: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

def verify_ingredients_with_pos_tagging(cuisine, ingredients):
    """
    Ingredient Validation using POS Tagging
    - Tokenization: Splitting the ingredient input into individual words.
    - POS Tagging: Identifying parts of speech to ensure ingredients are nouns.
    """
    ingredients = [ingredient.strip() for ingredient in ingredients]
    valid_ingredients = []
    for ingredient in ingredients:
        words = word_tokenize(ingredient)  # Tokenization: Convert text into individual words.
        pos_tags = pos_tag(words)  # POS Tagging: Label each word with its part of speech.
        if any(tag.startswith('NN') for word, tag in pos_tags):  # Ensure the word is a noun (NN).
            valid_ingredients.append(ingredient)
    return valid_ingredients

def filter_dish_lines_with_regex(text):
    """
    Filtering with Regular Expressions (Regex)
    - Using regex to filter dish recommendations that start with a digit followed by a period.
    """
    lines = text.split('\n')
    filtered_lines = [line.strip() for line in lines if re.match(r'^\d+\.\s', line.strip())]
    return filtered_lines

def format_dish_details(text):
    """
    Text Preprocessing
    - Formatting dish details for better display.
    """
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

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)
