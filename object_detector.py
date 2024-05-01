from ultralytics import YOLO
from flask import request, Response, Flask
from waitress import serve
from PIL import Image
import json
import firebase_admin
from firebase_admin import credentials

cred = credentials.Certificate("feastapp-c4d79-firebase-adminsdk-wygrr-5dee5a902c.json")
firebase_admin.initialize_app(cred)


app = Flask(__name__)

# Sample dish recommendation function
def recommend_dish(ingredient):
    # This is a placeholder, you can replace it with your actual recommendation logic
    dishes = {
        "tomato": "Caprese Salad",
        "apple": "Apple Pie",
        "banana": "Banana Bread",
        "carrot": "Carrot Soup",
        "eggplant": "Eggplant Parmesan",
        "lettuce": "Caesar Salad",
        "onion": "Adobo",
        "chicken": "Chicken Adobo"
    }
    return dishes.get(ingredient, "Unknown Dish")

@app.route("/")
def root():
    with open("index.html") as file:
        return file.read()

@app.route("/detect", methods=["POST"])
def detect():
    buf = request.files["image_file"]
    boxes = detect_objects_on_image(Image.open(buf.stream))
    return Response(
        json.dumps(boxes),
        mimetype='application/json'
    )

def detect_objects_on_image(buf):
    model = YOLO("best.pt")
    results = model.predict(buf)
    result = results[0]
    output = []
    for box in result.boxes:
        x1, y1, x2, y2 = [
            round(x) for x in box.xyxy[0].tolist()
        ]
        class_id = box.cls[0].item()
        prob = round(box.conf[0].item(), 2)
        ingredient = result.names[class_id]
        dish = recommend_dish(ingredient)
        output.append([
            x1, y1, x2, y2, ingredient, prob, dish
        ])
    return output

serve(app, host='0.0.0.0', port=8080)
