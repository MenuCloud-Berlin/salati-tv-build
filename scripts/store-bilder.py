#!/usr/bin/env python3
"""Macht aus den rohen Bildschirmfotos die Bilder fuer die Store-Seiten.

Die rohen Aufnahmen (aus dem Apple-TV-Simulator bzw. dem Android-TV-Emulator)
zeigen die App, sagen aber nicht, WAS man sieht — in der Store-Vorschau sind sie
auf Daumennagelgroesse geschrumpft, und dunkles Grau auf Schwarz traegt dort
nichts. Deshalb bekommt jedes Bild eine Zeile darueber: Ueberschrift in Gold,
Erklaerung darunter. Der Grund ist derselbe wie bei den Marken-Grafiken — das
Motiv wird gerechnet, nicht von Hand montiert.

    python scripts/store-bilder.py                 # alle Sprachen, Apple TV
    python scripts/store-bilder.py --quelle screenshots/androidtv --ziel screenshots/store/androidtv

Quelle:  <quelle>/<sprache>/NN-<name>.png   (1920x1080)
Ziel:    <ziel>/<sprache>/NN-<name>.png     (1920x1080)

Die Texte stehen in store/screenshot-texte.json — eine Quelle fuer beide Stores.
Arabisch wird vor dem Zeichnen umgeformt und in Leserichtung gebracht; PIL
kennt weder Ligaturen noch Bidi und wuerde die Buchstaben sonst einzeln und
verkehrt herum setzen.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HIER = os.path.dirname(os.path.abspath(__file__))
TV = os.path.normpath(os.path.join(HIER, ".."))

# Die Marken-Grundlagen (Nachtgrund, Farben, Schriftwahl) kommen aus dem
# Grafik-Skript — es gibt genau EINE Stelle, die das Aussehen festlegt.
_spec = importlib.util.spec_from_file_location("marken_assets", os.path.join(HIER, "marken-assets.py"))
_marken = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_marken)

GOLD = _marken.GOLD
WEISS = _marken.WEISS
GRAU = (176, 170, 160)

BREITE, HOEHE = 1920, 1080
KOPF = 178          # Hoehe des Textblocks
BILD_ANTEIL = 0.80  # Groesse des eingesetzten Fotos
RADIUS = 20

ARABISCHE_SCHRIFT = os.path.join(TV, "assets", "fonts", "noto-sans-arabic.ttf")


def arabisch(text: str) -> str:
    """Verbindet die Buchstaben und dreht die Leserichtung um."""
    import arabic_reshaper
    from bidi.algorithm import get_display

    return get_display(arabic_reshaper.reshape(text))


def schrift(groesse: int, sprache: str) -> ImageFont.FreeTypeFont:
    if sprache == "ar":
        return ImageFont.truetype(ARABISCHE_SCHRIFT, groesse)
    return _marken.schrift(groesse)


def passend(zeichner: ImageDraw.ImageDraw, text: str, sprache: str, start: int, breite: int) -> ImageFont.FreeTypeFont:
    """Groesster Schriftgrad, mit dem die Zeile in `breite` passt."""
    grad = start
    while grad > 18 and zeichner.textlength(text, font=schrift(grad, sprache)) > breite:
        grad -= 2
    return schrift(grad, sprache)


def abgerundet(bild: Image.Image, radius: int) -> Image.Image:
    maske = Image.new("L", bild.size, 0)
    ImageDraw.Draw(maske).rounded_rectangle((0, 0, bild.size[0] - 1, bild.size[1] - 1), radius=radius, fill=255)
    aus = bild.convert("RGBA")
    aus.putalpha(maske)
    return aus


def baue(foto: Image.Image, kopfzeile: str, unterzeile: str, sprache: str) -> Image.Image:
    grund = _marken.nachtgrund((BREITE, HOEHE), mitte=(0.5, 0.30)).convert("RGBA")
    zeichner = ImageDraw.Draw(grund)

    if sprache == "ar":
        kopfzeile, unterzeile = arabisch(kopfzeile), arabisch(unterzeile)

    f_kopf = passend(zeichner, kopfzeile, sprache, 58, int(BREITE * 0.86))
    f_unter = passend(zeichner, unterzeile, sprache, 30, int(BREITE * 0.86))
    zeichner.text((BREITE // 2, 74), kopfzeile, font=f_kopf, fill=GOLD, anchor="mm")
    zeichner.text((BREITE // 2, 128), unterzeile, font=f_unter, fill=GRAU, anchor="mm")

    # Das Foto: verkleinert, mit weichem Schatten und einem Hauch Goldkante,
    # damit es sich vom fast gleich dunklen Grund abhebt.
    b = int(BREITE * BILD_ANTEIL)
    h = round(b * foto.size[1] / foto.size[0])
    klein = abgerundet(foto.convert("RGB").resize((b, h), Image.LANCZOS), RADIUS)
    x = (BREITE - b) // 2
    y = KOPF + (HOEHE - KOPF - h) // 2

    schatten = Image.new("RGBA", (BREITE, HOEHE), (0, 0, 0, 0))
    ImageDraw.Draw(schatten).rounded_rectangle((x, y + 10, x + b, y + h + 10), radius=RADIUS, fill=(0, 0, 0, 190))
    grund = Image.alpha_composite(grund, schatten.filter(ImageFilter.GaussianBlur(18)))

    grund.paste(klein, (x, y), klein)
    ImageDraw.Draw(grund).rounded_rectangle((x, y, x + b - 1, y + h - 1), radius=RADIUS, outline=(92, 76, 34), width=2)
    return grund.convert("RGB")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--quelle", default=os.path.join("screenshots", "appletv"))
    p.add_argument("--ziel", default=os.path.join("screenshots", "store", "appletv"))
    p.add_argument("--sprachen", default="")
    args = p.parse_args()

    quelle = os.path.join(TV, args.quelle)
    ziel = os.path.join(TV, args.ziel)
    with open(os.path.join(TV, "store", "screenshot-texte.json"), encoding="utf-8") as f:
        texte = json.load(f)

    sprachen = args.sprachen.split() if args.sprachen else sorted(
        d for d in os.listdir(quelle) if os.path.isdir(os.path.join(quelle, d))
    )

    for sprache in sprachen:
        if sprache not in texte:
            print(f"{sprache}: keine Texte hinterlegt — uebersprungen")
            continue
        os.makedirs(os.path.join(ziel, sprache), exist_ok=True)
        for datei in sorted(os.listdir(os.path.join(quelle, sprache))):
            if not datei.endswith(".png"):
                continue
            name = datei.rsplit(".", 1)[0].split("-", 1)[1]
            zeilen = texte[sprache].get(name)
            if not zeilen:
                print(f"{sprache}/{datei}: kein Text fuer {name} - uebersprungen")
                continue
            foto = Image.open(os.path.join(quelle, sprache, datei))
            aus = baue(foto, zeilen[0], zeilen[1], sprache)
            pfad = os.path.join(ziel, sprache, datei)
            aus.save(pfad)
            print(f"{sprache}/{datei}  {aus.size[0]}x{aus.size[1]}")


if __name__ == "__main__":
    main()
