with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "rb") as f:
    content = f.read()

# The actual pattern is: item.condition === "en_reparation" || item.condition === "a_reparer"
old1 = b"item.condition === \x27en_reparation\x27 || item.condition === \x27a_reparer\x27"
# Valid type: "a_réparer" (with accent)
new1 = b"item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27 || item.condition === \x27\xc3\xa0_r\xc3\xa9parer\x27"
content = content.replace(old1, new1)

old2 = b"item.condition === \x27en_entretien\x27 || item.condition === \x27maintenance_requise\x27"
new2 = b"item.condition === \x27\xc3\xa0_remplacer\x27 || item.condition === \x27\xc3\xa0_remplacer\x27"
content = content.replace(old2, new2)

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\components\cockpit\widgets\DisponibiliteWidget.tsx", "wb") as f:
    f.write(content)

print("Done")
