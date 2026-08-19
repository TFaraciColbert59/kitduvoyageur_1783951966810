with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\InventaireWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Find the condition block
idx = content.find("statusLabel = \x27En réparation\x27")
if idx >= 0:
    print(repr(content[idx:idx+500]))
