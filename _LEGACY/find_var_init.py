
with open(r"c:\Users\r_the\Documents\fitness\Nieuwe map\Friday-night-hawk-s\index.html", "r", encoding="utf-8") as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if "customDetails =" in line or "customDetails=" in line:
            print(f"Found at line {i+1}: {line.strip()}")
            if i < 1000: # Context only if earlier in file
                for j in range(max(0, i-5), min(len(lines), i+5)):
                    print(f"{j+1}: {lines[j].strip()}")
