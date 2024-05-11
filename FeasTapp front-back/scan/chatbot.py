from flask import Flask, render_template, request, jsonify, url_for
import google.generativeai as genai

app = Flask(__name__)

API_KEY = 'AIzaSyAb4CKQ23uIo9PH-FwkGmoB3yHoJHaYuOI'
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-pro')
chat = model.start_chat(history=[])

@app.route('/')
def index():
    return render_template('chatbot/chatbot.html')

@app.route("/scan")
def chatbot():
    # Serves the scan.html from the scan folder inside templates directory.
    return render_template("scan.html")

@app.route("/main")
def main():
    # Serves the main.html from the main folder inside templates directory.
    return render_template("main.html")

@app.route('/send_message', methods=['POST'])
def send_message():
    user_message = request.json['message']
    response = chat.send_message(user_message)
    return jsonify({'response': response.text})

@app.route('/receive_ingredients', methods=['POST'])
def receive_ingredients():
    data = request.json
    ingredients = data.get('ingredients', [])  # Safely get ingredients or default to empty list
    if ingredients:
        print("Received ingredients:", ingredients)
        # Process the ingredients as needed, or log them
        return jsonify({"status": "Received", "count": len(ingredients)}), 200
    else:
        print("No ingredients received.")
        return jsonify({"status": "No ingredients received"}), 400



if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True, use_reloader=False)


