with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\InventaireWidget.tsx", "rb") as f:
    content = f.read()

idx = content.find(b"item.condition === \x27\xc3\xa0_remplacer\x27")
if idx >= 0:
    print(repr(content[idx:idx+400]))
