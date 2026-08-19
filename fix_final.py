with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "rb") as f:
    content = f.read()

old = bytes([0x5c, 0x0d, 0x0a, 0x6e, 0x65, 0x75, 0x66, 0x5c, 0x20])
new = b"\x22neuf\x22\x20"
print("Old present:", old in content)
print("Replacing...")
content = content.replace(old, new)
print("Old present after:", old in content)
print("New present:", new in content)

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "wb") as f:
    f.write(content)

print("Done")
