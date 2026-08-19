with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("{ condition: \\neuf\\ }", "{ condition: \"neuf\" }")
content = content.replace("condition: \\neuf\\", "condition: \"neuf\"")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
