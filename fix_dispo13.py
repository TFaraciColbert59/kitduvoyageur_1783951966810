with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the invalid condition checks
content = content.replace("condition === \x27perdu\x27", "condition === \x27\xc3\xa0_remplacer\x27")
content = content.replace("condition === \x27en_entretien\x27", "condition === \x27\xc3\xa0_remplacer\x27")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
