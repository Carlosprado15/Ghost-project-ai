"""
clean_bg.py — isola o produto (relogio/pulseira) do resto da foto (pulso, manga,
fundo, selos de propaganda) antes de mandar pra Tripo3D. Usa o modelo u2net
(rembg) pra separar objeto/fundo, e depois mantém só o MAIOR pedaço conectado
da imagem (o produto) — isso descarta selos/logos soltos que sobram da
primeira passada (ex: banner "NEW", selo "100% ORIGINAL"), que aparecem como
blobs separados do produto principal.

Limitação conhecida: se o "sujo" está encostado no produto (ex: pulso dentro
da pulseira), o maior-pedaço-conectado não separa os dois — nesse caso a foto
de origem precisa ser trocada, não tem recorte automático que resolva.

Uso: python clean_bg.py <entrada.jpg> <saida.png>
"""
import sys
import numpy as np
from rembg import remove, new_session
from PIL import Image
from scipy import ndimage

_session = None

def get_session():
    global _session
    if _session is None:
        _session = new_session("u2net")
    return _session

def keep_largest_blob(img: Image.Image, alpha_threshold=20) -> Image.Image:
    arr = np.array(img)
    alpha = arr[:, :, 3]
    mask = alpha > alpha_threshold
    labeled, n = ndimage.label(mask)
    if n <= 1:
        return img
    sizes = ndimage.sum(mask, labeled, range(1, n + 1))
    largest_label = np.argmax(sizes) + 1
    keep_mask = labeled == largest_label
    arr[~keep_mask] = 0
    return Image.fromarray(arr)

def clean(in_path, out_path):
    img = Image.open(in_path)
    out = remove(img, session=get_session())
    out = keep_largest_blob(out)
    out.save(out_path)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Uso: python clean_bg.py <entrada> <saida.png>", file=sys.stderr)
        sys.exit(1)
    clean(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
