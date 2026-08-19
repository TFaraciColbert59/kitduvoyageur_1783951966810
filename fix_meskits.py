with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\MesKitsWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the condition check
content = content.replace("ownedItem!.condition !== \x27a_remplacer\x27", "ownedItem!.condition !== \x27\xc3\xa0_remplacer\x27")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\MesKitsWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
