with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "rb") as f:
    content = f.read()

content = content.replace(b"{ condition: \\\\\r\nneuf\\\\ }", b"{ condition: \"neuf\" }")
content = content.replace(b"condition: \\\\\r\nneuf\\\\", b"condition: \"neuf\"")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "wb") as f:
    f.write(content)

print("Done")
