with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Fix all occurrences
content = content.replace("item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27 || item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)", "item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)")
content = content.replace("item.condition === \x27\xc3\xa0_remplacer\x27 || item.condition === \x27\xc3\xa0_remplacer\x27)", "item.condition === \x27\xc3\xa0_remplacer\x27)")

# The "perdu" condition is not valid, map it to "a_remplacer"
content = content.replace("item.condition === \x27perdu\x27)", "item.condition === \x27\xc3\xa0_remplacer\x27)")

# "a_remplacer" should be "a_remplacer"
content = content.replace("item.condition === \x27a_remplacer\x27)", "item.condition === \x27\xc3\xa0_remplacer\x27)")

# Also fix the groups section
content = content.replace("item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27 || item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)", "item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27)")
content = content.replace("item.condition === \x27\xc3\xa0_remplacer\x27 || item.condition === \x27\xc3\xa0_remplacer\x27)", "item.condition === \x27\xc3\xa0_remplacer\x27)")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
