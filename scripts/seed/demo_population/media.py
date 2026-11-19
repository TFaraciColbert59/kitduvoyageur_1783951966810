"""Small synthetic illustrations served as data URLs in the isolated dataset."""

from base64 import b64encode
from hashlib import sha256
from struct import pack
from zlib import compress, crc32

PALETTES = (
    ((237, 225, 198), (206, 151, 85), (97, 117, 101), (49, 79, 77)),
    ((214, 232, 230), (235, 188, 125), (91, 142, 141), (52, 86, 104)),
    ((234, 217, 222), (214, 152, 132), (141, 117, 142), (74, 77, 115)),
    ((220, 232, 202), (203, 167, 113), (117, 147, 99), (54, 103, 78)),
    ((228, 229, 212), (231, 201, 136), (122, 129, 143), (65, 86, 100)),
    ((231, 227, 221), (210, 161, 122), (132, 133, 113), (77, 97, 90)),
)


def _png_chunk(kind, payload):
    body = kind + payload
    return pack(">I", len(payload)) + body + pack(">I", crc32(body))


def landscape(reference, width, height):
    """Draw an illustrated terrain with a palette and contour unique to the reference."""
    seed = sha256(reference.encode()).digest()
    sky, sun, far, near = PALETTES[seed[0] % len(PALETTES)]
    sun_x = width * (.15 + seed[1] / 255 * .69)
    sun_y = height * (.14 + seed[2] / 255 * .26)
    radius = max(3, min(width, height) * (.09 + seed[3] / 255 * .06))
    ridges = []
    for x in range(width):
        position = x / max(1, width - 1) * 5
        index = min(4, int(position))
        blend = position - index
        ridge = seed[4 + index] * (1 - blend) + seed[5 + index] * blend
        ridges.append((height * (.43 + .32 * ridge / 255), height * (.7 + .2 * seed[10 + index] / 255)))
    lines = []
    for y in range(height):
        line = bytearray()
        for x, (high, low) in enumerate(ridges):
            color = near if y >= low else far if y >= high else (
                sun if (sun_x - x) ** 2 + (sun_y - y) ** 2 <= radius ** 2 else sky
            )
            line.extend(color)
        lines.append(b"\0" + line)
    header = pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", header)
    png += _png_chunk(b"IDAT", compress(b"".join(lines))) + _png_chunk(b"IEND", b"")
    return "data:image/png;base64," + b64encode(png).decode("ascii")
