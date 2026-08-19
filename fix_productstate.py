with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\product-state.ts", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the invalid condition values
content = content.replace("cond === \x27en_reparation\x27 || cond === \x27a_reparer\x27", "cond === \x27\xc3\xa0_r\xc3\xa9parer\x27")
content = content.replace("cond === \x27en_entretien\x27 || cond === \x27maintenance_requise\x27", "cond === \x27\xc3\xa0_remplacer\x27")

with open(r"C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\lib\product-state.ts", "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
