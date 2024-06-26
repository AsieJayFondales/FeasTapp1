# -*- coding: utf-8 -*-
"""Thesis Masked R-CNN.ipynb

Automatically generated by Colab.

Original file is located at
    https://colab.research.google.com/drive/1GuASSEhpXUG8qQvjRFL4GbA9kgb5WCtv
"""

from google.colab import drive
drive.mount('/content/drive')

!pip install tensorflow=="2.15.0"
!pip install git+https://github.com/akTwelve/Mask_RCNN.git
!pip install dill

# Importing the libraries
import os
import sys
import json
import datetime
import numpy as np
import matplotlib.pyplot as plt
plt.style.use('fivethirtyeight')
import skimage.draw
import dill as pickle
import multiprocessing as mp

# Import Mask R-CNN from the updated repository
import keras.models as KM
import keras.layers as KL
import keras.backend as K
from keras.layers import Layer  # Assuming Layer is used from KE
from keras.models import Model  # Assuming Model is used from KE
sys.path.append('/content/https://colab.research.google.com/drive/1GuASSEhpXUG8qQvjRFL4GbA9kgb5WCtv?usp=sharingsk_RCNN')  # ensure this path points to the cloned repo
from mrcnn.config import Config
import keras.models as modellib
from mrcnn import utils
from mrcnn import model as modellib

# Configuration for the Mask R-CNN model
class IngredientConfig(Config):
    NAME = "ingredient_detection"
    GPU_COUNT = 1
    IMAGES_PER_GPU = 1
    NUM_CLASSES = 1 + 5  # Background + main ingredient, condiment, meat, vegetable, fruit
    STEPS_PER_EPOCH = 100
    DETECTION_MIN_CONFIDENCE = 0.9

config = IngredientConfig()

class IngredientDataset(utils.Dataset):

    def load_ingredients(self, dataset_dir, subset):
        """Load a subset of the ingredient dataset."""
        self.add_class("ingredient", 1, "main ingredient")
        self.add_class("ingredient", 2, "condiment")
        self.add_class("ingredient", 3, "meat")
        self.add_class("ingredient", 4, "vegetable")
        self.add_class("ingredient", 5, "fruit")

        # Path to the annotations file
        annotations_path = os.path.join(dataset_dir, subset, "_annotations.coco.json")

        # Load annotations
        with open(annotations_path, 'r') as f:
            annotations = json.load(f)

        # Create a dictionary of images to easily match annotations to images
        images_info = {image['id']: image for image in annotations['images']}

        # Loop through each annotation, add the image and details to the dataset
        for annotation in annotations['annotations']:
            image_info = images_info[annotation['image_id']]
            image_path = os.path.join(dataset_dir, subset, image_info['file_name'])

            self.add_image(
                "ingredient",
                image_id=image_info['id'],
                path=image_path,
                width=image_info['width'],
                height=image_info['height'],
                annotations=annotation
            )

    def load_mask(self, image_id):
        """Generate instance masks for an image."""
        info = self.image_info[image_id]
        mask = np.zeros([info['height'], info['width'], len(info['annotations'])], dtype=np.uint8)
        class_ids = []
        for i, annotation in enumerate(info['annotations']):
            rr, cc = skimage.draw.polygon(annotation['segmentation'][0])  # Ensure the segmentation is correctly formatted
            mask[:, :, i] = np.array([rr, cc]).T
            class_ids.append(annotation['category_id'])
        return mask, np.array(class_ids, dtype=np.int32)

def inspect_dataset_json(dataset_dir, subset):
    json_path = os.path.join(dataset_dir, subset, "_annotations.coco.json")

    try:
        with open(json_path, 'r') as file:
            data = json.load(file)

        print(f"--- {subset.upper()} DATASET STRUCTURE ---")
        # Print keys at the top level
        print("Top-level keys:", data.keys())

        # Print a part of the annotations to see the actual structure
        if 'annotations' in data and len(data['annotations']) > 0:
            print("First annotation entry:", data['annotations'][0])  # Print the first annotation to check its structure

        if 'images' in data and len(data['images']) > 0:
            print("First image entry:", data['images'][0])  # Print the first image to check its structure
    except FileNotFoundError:
        print(f"File not found: {json_path}")
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {json_path}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    import multiprocessing as mp
    mp.set_start_method('spawn', force=True)
    pickle.settings['recurse'] = True

    dataset_dir = "/content/drive/MyDrive/THESIS/Thesis Writing 1/Dataset/Ingredients/feastapp.v1i.coco"

    # Inspect the training dataset JSON structure
    inspect_dataset_json(dataset_dir, 'train')

    # Inspect the validation dataset JSON structure
    inspect_dataset_json(dataset_dir, 'valid')

!wget https://github.com/matterport/Mask_RCNN/releases/download/v2.0/mask_rcnn_coco.h5 -O /content/mask_rcnn_coco.h5

def inspect_json_structure(json_path):
    """ Utility function to print the structure of the JSON file """
    with open(json_path, 'r') as file:
        data = json.load(file)
    print("Top-level keys:", list(data.keys()))
    # Check if 'images' and 'annotations' are part of the JSON
    if 'images' in data and data['images']:
        print("Sample image entry:", data['images'][0])
    if 'annotations' in data and data['annotations']:
        print("Sample annotation entry:", data['annotations'][0])

json_path = "/content/drive/MyDrive/THESIS/Thesis Writing 1/Dataset/Ingredients/feastapp.v1i.coco/train/_annotations.coco.json"
inspect_json_structure(json_path)

#import multiprocessing as mp
#if __name__ == '__main__':
    #mp.set_start_method('spawn')

# Create the model in training mode
model = modellib.MaskRCNN(mode="training", config=config, model_dir='/content/logs')

# Load weights (typically, you start with pre-trained COCO weights)
model.load_weights('/content/mask_rcnn_coco.h5', by_name=True, exclude=[
    "mrcnn_class_logits", "mrcnn_bbox_fc", "mrcnn_bbox", "mrcnn_mask"])

# Prepare the training and validation datasets
dataset_train = IngredientDataset()
dataset_train.load_ingredients(dataset_dir, 'train')
dataset_train.prepare()

dataset_valid = IngredientDataset()
dataset_valid.load_ingredients(dataset_dir, 'valid')
dataset_valid.prepare()

config = IngredientConfig()

optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)

try:
    model.train(dataset_train, dataset_valid,
                learning_rate=config.LEARNING_RATE,
                epochs=30,
                layers='heads')
except Exception as e:
    print("An error occurred during training:", e)

# Train the model
import tensorflow as tf
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
model.train(dataset_train, dataset_valid,
            learning_rate=config.LEARNING_RATE,  # Use dot notation here
            epochs=30,
            layers='heads')



