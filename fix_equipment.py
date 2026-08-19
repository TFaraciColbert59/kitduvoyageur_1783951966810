with open(r'C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\hooks\useEquipment.ts', 'r') as f:
    content = f.read()

# Fix the string escaping issues
content = content.replace(\"'''selection'''\", \"'selection'\")
content = content.replace(\"'''success'''\", \"'success'\")
content = content.replace(\"'''light'''\", \"'light'\")
content = content.replace(\"'''warning'''\", \"'warning'\")

content = content.replace(\"'''En attente de r\xe9ception (commande)'''\", \"'En attente de r\xe9ception (commande)'\")
content = content.replace(\"'''Re\xe7u et valid\xe9'''\", \"'Re\xe7u et valid\xe9'\")
content = content.replace(\"'''gear_items'''\", \"'gear_items'\")
content = content.replace(\"'''catalogue'''\", \"'catalogue'\")
content = content.replace(\"'''neuf'''\", \"'neuf'\")
content = content.replace(\"'''disponible'''\", \"'disponible'\")
content = content.replace(\"'''Erreur insertion gear_item (achat):'''\", \"'Erreur insertion gear_item (achat):'\")
content = content.replace(\"'''Erreur confirmReceipt:'''\", \"'Erreur confirmReceipt:'\")

content = content.replace(\"'''inventaire (ownership = ''en_attente_achat'') + au panier'''\", '\"inventaire (ownership = \'en_attente_achat\') + au panier\"')
content = content.replace(\"'''en_attente_achat'' \u2192 ''possede'''\", '\"en_attente_achat\' \u2192 \'possede\"')
content = content.replace(\"'''\xe9tat unifi\xe9 d''un produit'''\", '\"\xe9tat unifi\xe9 d\'un produit\"')

with open(r'C:\Users\Tony\Downloads\LKDV\kitduvoyageur_1783951966810\src\hooks\useEquipment.ts', 'w') as f:
    f.write(content)

print('Fixed!')
