with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\InventaireWidget.tsx", "rb") as f:
    content = f.read()

old = b"item.condition === \x27\xc3\xa0_remplacer\x27"
matches = []
pos = 0
while True:
    pos = content.find(old, pos)
    if pos == -1:
        break
    matches.append(pos)
    pos += 1

print("Total occurrences: " + str(len(matches)))
for i, m in enumerate(matches):
    print("  " + str(i+1) + ": " + str(m))
