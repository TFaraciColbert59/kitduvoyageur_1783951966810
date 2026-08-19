with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\InventaireWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the broken lines - remove the orphaned "ral-400";
content = content.replace("ral-400\x27;\n                }", "")

# Also fix the double closing brace
content = content.replace("                }\nral-400\x27;\n                }", "                }")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\InventaireWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
