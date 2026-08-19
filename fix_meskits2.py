with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\MesKitsWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix all invalid condition values
content = content.replace("ownedItem!.condition === \x27a_remplacer\x27", "ownedItem!.condition === \x27\xc3\xa0_remplacer\x27")
content = content.replace("ownedItem!.condition === \x27en_reparation\x27", "ownedItem!.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\MesKitsWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
