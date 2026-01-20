
with open(r"c:\Users\r_the\Documents\fitness\Nieuwe map\Friday-night-hawk-s\index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "function fetchWorkoutData" in line:
            print(f"Found at line {i+1}: {line.strip()}")
