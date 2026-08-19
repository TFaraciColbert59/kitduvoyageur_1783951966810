with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\product-state.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix created_at -> use acquired_at or purchase_date
content = content.replace("equipmentItem?.created_at?.split(\x27T\x27)[0]", "equipmentItem?.acquired_at?.split(\x27T\x27)[0] || equipmentItem?.purchase_date?.split(\x27T\x27)[0]")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\product-state.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
