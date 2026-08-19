with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\mock\mon-materiel-marceline.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Remove duplicate
old = "\x27\xc3\xa0_r\xc3\xa9parer\x27 | \x27neuf\x27 | \x27us\xc3\xa9\x27 | \x27\xc3\xa0_r\xc3\xa9parer\x27 |"
new = "\x27\xc3\xa0_r\xc3\xa9parer\x27 | \x27neuf\x27 | \x27us\xc3\xa9\x27 |"
content = content.replace(old, new)

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\mock\mon-materiel-marceline.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
