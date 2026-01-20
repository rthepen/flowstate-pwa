
with open(r"c:\Users\r_the\Documents\fitness\Nieuwe map\Friday-night-hawk-s\index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "localStorage.getItem" in line or "window.onload" in line or "DOMContentLoaded" in line or "fnh_settings_v8" in line:
            print(f"Found at line {i+1}: {line.strip()}")
            if "fnh_settings_v8" in line and "getItem" in line:
                 # Print context for load logic
                for j in range(max(0, i), min(len(lines), i+40)):
                    print(f"{j+1}: {lines[j].strip()}")
