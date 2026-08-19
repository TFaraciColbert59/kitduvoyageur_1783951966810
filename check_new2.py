with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\app\mon-materiel\page.tsx", "rb") as f:
    content = f.read()

new = b"\x22neuf\x22\x20"
print("New bytes:", new.hex())
print("New bytes present:", new in content)
