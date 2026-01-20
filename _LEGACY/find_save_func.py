
with open(r"c:\Users\r_the\Documents\fitness\Nieuwe map\Friday-night-hawk-s\index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "function saveToLocal" in line or "const saveToLocal" in line or "let saveToLocal" in line:
            print(f"Found at line {i+1}: {line.strip()}")
            # Print surrounding lines
            for j in range(max(0, i), min(len(lines), i+20)):
                print(f"{j+1}: {lines[j].strip()}")
            break
