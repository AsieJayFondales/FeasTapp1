import os
import json 
from flask import Flask, render_template, request, jsonify, Response
import google.generativeai as genai

# Initialize Flask app
app = Flask(__name__)

# Configure Generative AI
API_KEY = 'AIzaSyAb4CKQ23uIo9PH-FwkGmoB3yHoJHaYuOI'
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-pro')
chat = model.start_chat(history=[])

# Store session states in a dictionary (for simplicity, in production consider using a more robust solution)
sessions = {}

@app.route('/')
def index():
    return render_template('chatbot/chatbot.html')

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
            sessions[session_id]['state'] = 'ask_ingredients'
        elif state == 'ask_ingredients':
            sessions[session_id]['cuisine'] = user_message
            response_text = f"You chose {user_message} cuisine. Please list the ingredients you have."
            sessions[session_id]['state'] = 'recommend_dishes'
        elif state == 'recommend_dishes':
            sessions[session_id]['ingredients'] = user_message
            cuisine = sessions[session_id]['cuisine']
            ingredients = user_message
            response = chat.send_message(f"Recommend top 5 {cuisine} dishes using {ingredients}.")
            dish_recommendations = response.text.split('\n')[:5]
            response_text = "Here are the top 5 dishes I recommend:<br><br>"
            response_text += "<ul>"
            for dish in dish_recommendations:
                response_text += f"<li>{dish.strip()}</li>"
            response_text += "</ul>"
            buttons = [dish.strip() for dish in dish_recommendations]
            buttons.append("Recommend another set of dishes")
            sessions[session_id]['state'] = 'show_dish_details'
        elif state == 'show_dish_details':
            if user_message == "Recommend another set of dishes":
                cuisine = sessions[session_id]['cuisine']
                ingredients = sessions[session_id]['ingredients']
                response = chat.send_message(f"Recommend another 5 {cuisine} dishes using {ingredients}.")
                dish_recommendations = response.text.split('\n')[:5]
                response_text = "Here are another 5 dishes I recommend:<br><br>"
                response_text += "<ul>"
                for dish in dish_recommendations:
                    response_text += f"<li>{dish.strip()}</li>"
                response_text += "</ul>"
                buttons = [dish.strip() for dish in dish_recommendations]
                buttons.append("Recommend another set of dishes")
            else:
                dish_name = user_message
                response = chat.send_message(f"Give details for the {sessions[session_id]['cuisine']} dish named {dish_name}. Include nutritional information, common allergens, and possible substitutions.")
                response_text = format_dish_details(response.text)
                buttons = ["Save Recipe", "Ask for Recommendation"]
                sessions[session_id]['state'] = 'ask_cuisine'
                show_buttons = True

        return jsonify({'response': response_text, 'show_buttons': True if buttons else False, 'buttons': buttons, 'recipe_name': dish_name})
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'response': "Sorry, I encountered an error. Please try again.", 'show_buttons': False})

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

@app.route('/receive_ingredients', methods=['POST'])
def receive_ingredients():
    data = request.json
    ingredients = data.get('ingredients', {})
    if ingredients:
        print("Received ingredients:", ingredients)
        simplified_ingredients = simplify_ingredients(ingredients)
        send_event("ingredient_detected", simplified_ingredients)
        return jsonify({"status": "Received", "count": len(ingredients)}), 200
    else:
        print("No ingredients received.")
        return jsonify({"status": "No ingredients received"}), 400

def simplify_ingredients(ingredients):
    main_ingredients = ingredients.get('Main Ingredients', [])
    condiments = ingredients.get('Condiments', [])

    simplified_list = []
    if main_ingredients:
        simplified_list.append("Main Ingredient/s: " + ', '.join(main_ingredients))
    if condiments:
        simplified_list.append("Condiment/s: " + ', '.join(condiments))

    return ' | '.join(simplified_list)

clients = []

@app.route('/events')
def events():
    def event_stream():
        while True:
            if clients:
                message = clients.pop(0)
                yield f"data: {message}\n\n"

    return Response(event_stream(), mimetype="text/event-stream")

def send_event(event_type, data):
    message = json.dumps({"event": event_type, "data": data})
    clients.append(message)

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)
