# Fonds de carte satellite des Alpes du Nord pour les écrans de l'app (Explorer, Compas, hors ligne, live).
# Source : Sentinel-2 cloudless 2021 par EOX IT Services GmbH (s2maps.eu), CC BY 4.0, contient des données Copernicus Sentinel modifiées.
# Sortie : assets/img/alpes-z12.jpg (Annecy → Chamonix), alpes-z10.jpg, alpes-z8.jpg (arc alpin), plan/relief/nuit, alpes.json (projection).
import os, math, json, time, io, urllib.request
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'img'); os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(ROOT, 'assets', 'tiles'); os.makedirs(CACHE, exist_ok=True)
URL = 'https://tiles.maps.eox.at/wmts/1.0.0/{layer}/default/g/{z}/{y}/{x}.jpg'

def px(lon, lat, z):
    n = 256 * 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def tile(z, x, y, layer='s2cloudless-2021_3857'):
    p = os.path.join(CACHE, f'{z}-{x}-{y}.jpg' if layer.startswith('s2') else f'{layer}-{z}-{x}-{y}.img')
    if not os.path.exists(p):
        for k in range(4):
            try:
                req = urllib.request.Request(URL.format(layer=layer, z=z, x=x, y=y), headers={'User-Agent': 'lkdv-video-build/1.0'})
                data = urllib.request.urlopen(req, timeout=30).read(); open(p, 'wb').write(data); break
            except Exception as e:
                print('retry', z, x, y, e); time.sleep(2 + 3 * k)
        time.sleep(0.15)
    return Image.open(p).convert('RGB')

def mosaic(name, z, lon0, lat1, lon1, lat0, layer='s2cloudless-2021_3857'):
    x0, y0 = px(lon0, lat1, z); x1, y1 = px(lon1, lat0, z)
    tx0, ty0, tx1, ty1 = int(x0 // 256), int(y0 // 256), int(x1 // 256), int(y1 // 256)
    im = Image.new('RGB', ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            im.paste(tile(z, tx, ty, layer), ((tx - tx0) * 256, (ty - ty0) * 256))
    im.save(os.path.join(OUT, f'{name}.jpg'), quality=88)
    print(name, im.size, (tx1 - tx0 + 1) * (ty1 - ty0 + 1), 'tuiles')
    return dict(z=z, ox=tx0 * 256, oy=ty0 * 256, w=im.width, h=im.height)

meta = {'z12': mosaic('alpes-z12', 12, 6.02, 46.13, 7.02, 45.76),
        'z8': mosaic('alpes-z8', 8, 3.6, 48.6, 13.2, 43.2),
        'z10': mosaic('alpes-z10', 10, 5.7, 46.7, 7.4, 45.2)}
# Fonds « plan », « relief » et « nuit » (mêmes emprises, pour basculer de style) : EOX Maps — plan et relief
# © contributeurs OpenStreetMap, rendu EOX ; nuit : Black Marble (NASA), rendu EOX.
mosaic('plan-z12', 12, 6.02, 46.13, 7.02, 45.76, 'osm_3857')
mosaic('relief-z12', 12, 6.02, 46.13, 7.02, 45.76, 'terrain-light_3857')
mosaic('nuit-z8', 8, 3.6, 48.6, 13.2, 43.2, 'blackmarble_3857')
mosaic('plan-z8', 8, 3.6, 48.6, 13.2, 43.2, 'terrain-light_3857')
json.dump(meta, open(os.path.join(OUT, 'alpes.json'), 'w'), indent=1)
