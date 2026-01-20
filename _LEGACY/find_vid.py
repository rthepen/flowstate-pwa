
import json
import os

db_path = r"c:\Users\r_the\Documents\fitness\Nieuwe map\Friday-night-hawk-s\workoutdatabase.json"

with open(db_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

found = False
target = "Vj22Nytv20E"

for item in data:
    if target in str(item):
        print(f"FOUND: {item}")
        found = True

if not found:
    print("Not found in JSON.")
