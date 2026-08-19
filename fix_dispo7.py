with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# The issue is the duplicate || conditions - TypeScript is getting confused
# Fix line 44: remove the duplicate
content = content.replace("item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27 || item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)", "item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)")

# Fix line 46: remove the duplicate
content = content.replace("item.condition === \x27\xc3\xa0_remplacer\x27 || item.condition === \x27\xc3\xa0_remplacer\x27)", "item.condition === \x27\xc3\xa0_remplacer\x27)")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
