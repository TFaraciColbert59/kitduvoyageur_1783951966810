with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the condition values to match UserEquipmentItem type:
# Valid: "neuf", "excellent", "bon", "moyen", "usé", "à_réparer", "à_remplacer"

# Replace "à_réparer" || "à_réparer" with just "à_réparer"
content = content.replace("item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27 || item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27", "item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27")

# Replace "à_remplacer" || "à_remplacer" with just "à_remplacer"
content = content.replace("item.condition === \x27\xc3\xa0_remplacer\x27 || item.condition === \x27\xc3\xa0_remplacer\x27", "item.condition === \x27\xc3\xa0_remplacer\x27")

# Check for "perdu" and handle it
idx = content.find("perdu")
if idx >= 0:
    print("Found perdu at:", idx)
    print(repr(content[idx-50:idx+100]))

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
