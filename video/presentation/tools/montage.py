# Montage de « Pas pour moi » : la piste de fond, plan par plan, aux horaires du film (audio/timeline.json).
#   plan  : image animée en 2.5D plein cadre (assets/shots/<id>.mp4, rendue par tools/anim.py)
#   flou  : image floue et assombrie derrière le téléphone (assets/prep/NN-flou.jpg, lente dérive en CSS)
#   encre : fond d'encre (excuses, SOS, épilogue)
# Chaque fond commence par un fondu de XF secondes par-dessus le précédent ; un plan est rendu XF secondes plus long.
XF = 0.4
BG = [
    # 0. Ouverture à froid
    ('plan', 'a01', 1, 0.0, 5.2),          # montée de nuit, frontale, suivi en direct
    ('plan', 'a02', 2, 5.2, 12.5),         # l'aube au Lac Blanc, le Mont-Blanc rosit
    ('encre', 'e00', 0, 12.5, 17.44),      # « Il y a six mois… pas pour moi. » puis l'accueil
    # I. Je ne suis pas sportif
    ('encre', 'e01', 0, 17.44, 19.84),
    ('plan', 'b03', 3, 19.84, 26.1),       # un dimanche, 4 km, 8, 12
    ('plan', 'b04', 4, 26.1, 31.4),        # la montre
    ('plan', 'b05', 5, 31.4, 32.7),        # premier belvédère
    ('flou', 'f05', 5, 32.7, 38.57),       # Compte : activités, zone de confidentialité
    # II. Je ne saurais pas où aller
    ('encre', 'e02', 0, 38.57, 40.97),
    ('flou', 'f06', 6, 40.97, 68.8),       # globe → Alpes → lieux, danger ; plan, relief, satellite, 3D ; filtres
    ('encre', 'e2m', 0, 68.8, 81.2),      # chaque carte et son rôle
    ('encre', 'e2d', 0, 81.2, 95.833),    # demain : les couches à venir, en plein écran
    ('plan', 'c06', 6, 95.833, 100.033),        # le canapé, le carnet d'un inconnu
    ('plan', 'c07', 7, 100.033, 101.833),        # un lac au lever du jour
    ('plan', 'c08', 8, 101.833, 103.733),        # une échelle au-dessus du vide
    ('plan', 'c07b', 7, 103.733, 105.833),       # un kayak sur l'eau turquoise
    ('flou', 'f07', 7, 105.833, 109.603),       # Préparer ce voyage
    # III. C'est trop compliqué
    ('encre', 'e03', 0, 109.603, 111.993),
    ('plan', 'd09', 9, 111.993, 114.833),       # la table de cuisine
    ('flou', 'f09', 9, 114.833, 147.293),      # Compas : Où, compris, carte, Résa, budget, Verdict
    # IV. Je n'ai personne avec qui partir
    ('encre', 'e04', 0, 147.293, 149.693),
    ('flou', 'f10', 10, 149.693, 157.333),    # Nous, Bouteille, deux réponses
    ('plan', 'g10', 10, 157.333, 160.533),     # le club sur le parking
    ('plan', 'g11', 11, 160.533, 164.033),     # Claire, la guide ; « S'inscrire »
    ('plan', 'g12', 12, 164.033, 168.433),     # la table du refuge, des prénoms
    ('flou', 'f12', 12, 168.433, 173.193),    # messages, qui doit quoi
    # V. Je n'ai pas le matériel
    ('encre', 'e05', 0, 173.193, 175.593),
    ('plan', 'h14', 14, 175.593, 179.133),    # le matériel vu de dessus
    ('flou', 'f14', 14, 179.133, 184.733),     # inventaire : déjà / manque
    ('plan', 'h13', 13, 184.733, 187.133),     # Léa prête le baudrier
    ('flou', 'f13', 13, 187.133, 204.993),    # Trouver, Kit Studio, lignée, 14 % → prêt
    # VI. Et si j'oublie quelque chose ?
    ('encre', 'e06', 0, 204.993, 207.393),
    ('plan', 'i15', 15, 207.393, 209.233),    # la veille du départ
    ('flou', 'f15', 15, 209.233, 219.263),    # checklist, papiers, hors ligne, lien
    # VII. Et si je me perds ?
    ('encre', 'e07', 0, 219.263, 221.663),
    ('plan', 'j16', 16, 221.663, 223.733),    # kayak à l'aube
    ('plan', 'j17', 17, 223.733, 226.133),     # via ferrata
    ('plan', 'j18', 18, 226.133, 229.633),     # le visage contre la paroi
    ('plan', 'j01', 1, 229.633, 235.433),      # cinq heures douze, hors ligne
    ('plan', 'j19', 19, 235.433, 242.333),     # le groupe dans la nuit bleue, guidage
    ('flou', 'f19', 19, 242.333, 248.833),     # alerte météo, écart au tracé
    ('encre', 'e7s', 0, 248.833, 253.433),     # SOS
    ('plan', 'j02', 2, 253.433, 259.533),      # le lac, le Mont-Blanc s'allume
    ('plan', 'j20', 20, 259.533, 266.693),    # la mère, la page live
    # VIII. Raconter
    ('flou', 'f02', 2, 266.693, 273.533),     # carnet : chiffres, fil de bord
    ('plan', 'k21', 21, 273.533, 274.883),    # marmotte
    ('plan', 'k22', 22, 274.883, 277.133),    # fleur
    ('flou', 'f12b', 12, 277.133, 281.813),   # équipage, publier
    # IX. Transmettre
    ('flou', 'f14b', 14, 281.813, 299.633),   # rapport du kit, lignée, part créateur
    ('plan', 'm23', 23, 299.633, 303.133),     # le baudrier rendu à Léa
    ('plan', 'm24', 24, 303.133, 308.643),    # retour à la maison, l'empreinte
    # Épilogue
    ('plan', 'n25', 25, 308.643, 317.033),    # une inconnue, un autre soir
    ('encre', 'e10', 0, 317.033, 331.128),   # le fil, le manifeste, le logo
]
