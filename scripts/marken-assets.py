#!/usr/bin/env python3
"""Erzeugt saemtliche Marken-Grafiken von Salati TV aus einer Quelle.

Anlass: Google Play hat vc12 abgelehnt — „Your icon does not fill the entire
icon space" und die Banner-Pruefung TV-BN. Bis dahin waren die Grafiken von
Hand zusammenkopiert; im Feature-Graphic und im Banner lag deshalb ein sichtbar
andersfarbiger Kasten hinter dem Stern (icon.png mit #0b0b0d auf #0a0a0a
montiert), und der Stern belegte nur 71 % der Icon-Flaeche.

Hier wird der Achtzackstern stattdessen GERECHNET (Vereinigung zweier
abgerundeter Quadrate, eines um 45 Grad gedreht) und 4-fach ueberabgetastet.
Die Proportionen stammen aus dem alten icon.png: Quadratseite 536 px bei
Stern-Ausdehnung 730 px, Eckenradius 0,0672 der Seite.

    python scripts/marken-assets.py

Schreibt nach assets/:
    icon.png                     1024  vollflaechig (Legacy-Launcher + Store)
    icon-512.png                  512  dasselbe, Play-Console-Icon
    icon-adaptive.png            1024  nur Stern, transparent, Sicherheitszone
    banner.png                320x180  Leanback-Banner (xhdpi), mit App-Name
    banner-{dichte}.png                dasselbe je Bildschirmdichte, siehe
                                       plugins/with-tv-banner.js
    store-banner-1280x720.png        dasselbe Motiv fuer die Store-Seite
    feature-graphic-1024x500.png     dito mit Unterzeile

Und nach assets/appletv/ die Markengrafiken von Apple TV. Sie haben eigene,
von Android abweichende Formate: die Ikone ist dort quer (5:3) statt quadratisch,
und ueber der Ikone steht im Startbildschirm ein breites „Top Shelf"-Bild.
    icon-400x240.png / icon-800x480.png   Ikone (Ebene der Bildstapel, 1x/2x)
    icon-1280x768.png                     dieselbe Ikone fuer den App Store
    top-shelf-1920x720.png / -3840x1440   Top Shelf
    top-shelf-wide-2320x720.png / -4640x1440
"""

from __future__ import annotations

import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HIER = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HIER, "..", "assets")

SS = 4  # Ueberabtastung

GOLD_HELL = (227, 197, 94)
GOLD_DUNKEL = (190, 148, 36)
GOLD = (212, 175, 55)
NACHT_HELL = (23, 22, 26)
NACHT = (11, 11, 13)
NACHT_TIEF = (8, 8, 10)
WEISS = (242, 237, 227)

# Stern: Ausdehnung E = Seite * 1,3585 bei Eckenradius 0,0672 * Seite.
SEITE_JE_AUSDEHNUNG = 1.0 / 1.3585
RADIUS_JE_SEITE = 0.0672

# 320x180 gilt bei xhdpi (320 dpi); die anderen Ordner brauchen dieselbe
# Kachel in ihrer eigenen Aufloesung. Muss zu plugins/with-tv-banner.js passen.
DICHTEN = {
    "mdpi": (160, 90),
    "hdpi": (240, 135),
    "xhdpi": (320, 180),
    "xxhdpi": (480, 270),
    "xxxhdpi": (640, 360),
}

SCHRIFTEN = [
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def schrift(groesse: int) -> ImageFont.FreeTypeFont:
    for pfad in SCHRIFTEN:
        if os.path.exists(pfad):
            return ImageFont.truetype(pfad, groesse)
    raise SystemExit("keine fette Grotesk gefunden: " + ", ".join(SCHRIFTEN))


def stern_maske(kante: int, ausdehnung: float) -> Image.Image:
    """Achtzackstern als Graustufen-Maske. `ausdehnung` = Anteil der Kante."""
    n = kante * SS
    e = ausdehnung * n
    seite = e * SEITE_JE_AUSDEHNUNG
    radius = seite * RADIUS_JE_SEITE
    links, oben = (n - seite) / 2.0, (n - seite) / 2.0
    kasten = (links, oben, links + seite, oben + seite)

    gerade = Image.new("L", (n, n), 0)
    ImageDraw.Draw(gerade).rounded_rectangle(kasten, radius=radius, fill=255)
    gedreht = gerade.rotate(45, resample=Image.BICUBIC, expand=False)
    return ImageChops.lighter(gerade, gedreht).resize((kante, kante), Image.LANCZOS)


def gold_flaeche(groesse: tuple[int, int]) -> Image.Image:
    """Diagonaler Goldverlauf — hell oben links, satt unten rechts."""
    b, h = groesse
    bild = Image.new("RGB", (b, h))
    px = bild.load()
    for y in range(h):
        for x in range(b):
            t = (x / max(b - 1, 1) + y / max(h - 1, 1)) / 2.0
            px[x, y] = tuple(
                round(GOLD_HELL[i] + (GOLD_DUNKEL[i] - GOLD_HELL[i]) * t) for i in range(3)
            )
    return bild


def nachtgrund(groesse: tuple[int, int], mitte: tuple[float, float] = (0.5, 0.45)) -> Image.Image:
    """Radialer Grund: warmes Dunkel in der Mitte, tiefes Schwarz am Rand."""
    b, h = groesse
    klein = (max(b // 8, 16), max(h // 8, 16))
    kb, kh = klein
    bild = Image.new("RGB", klein)
    px = bild.load()
    mx, my = mitte[0] * kb, mitte[1] * kh
    weit = max((mx * mx + my * my) ** 0.5, ((kb - mx) ** 2 + (kh - my) ** 2) ** 0.5)
    for y in range(kh):
        for x in range(kb):
            d = min((((x - mx) ** 2 + (y - my) ** 2) ** 0.5) / weit, 1.0)
            t = d * d
            px[x, y] = tuple(
                round(NACHT_HELL[i] + (NACHT_TIEF[i] - NACHT_HELL[i]) * t) for i in range(3)
            )
    return bild.resize((b, h), Image.BICUBIC)


def stern_auf(bild: Image.Image, kante: int, ausdehnung: float, mitte: tuple[int, int]) -> None:
    maske = stern_maske(kante, ausdehnung)
    gold = gold_flaeche((kante, kante))
    bild.paste(gold, (mitte[0] - kante // 2, mitte[1] - kante // 2), maske)


def icon(kante: int) -> Image.Image:
    """Vollflaechig: der Stern beruehrt die Kanten (Play-Beanstandung vc12)."""
    bild = nachtgrund((kante, kante), mitte=(0.5, 0.5))
    stern_auf(bild, kante, 0.96, (kante // 2, kante // 2))
    return bild


def icon_adaptiv(kante: int) -> Image.Image:
    """Vordergrund der adaptiven Ikone: nur Stern, in der Sicherheitszone.

    Die Maske zeigt vom 108-dp-Vordergrund nur die mittleren 72 dp. 0,60 der
    Kante landet damit bei 90 % der sichtbaren Flaeche — voll, ohne dass die
    Zacken abgeschnitten werden.
    """
    bild = Image.new("RGBA", (kante, kante), (0, 0, 0, 0))
    maske = stern_maske(kante, 0.60)
    gold = gold_flaeche((kante, kante)).convert("RGBA")
    gold.putalpha(maske)
    return Image.alpha_composite(bild, gold)


def wortmarke(zeichner: ImageDraw.ImageDraw, x: int, y: int, f: ImageFont.FreeTypeFont) -> int:
    """„SALATI TV" — Gold plus Weiss. Gibt die Gesamtbreite zurueck."""
    a, b = "SALATI", " TV"
    breite_a = zeichner.textlength(a, font=f)
    zeichner.text((x, y), a, font=f, fill=GOLD, anchor="ls")
    zeichner.text((x + breite_a, y), b, font=f, fill=WEISS, anchor="ls")
    return round(breite_a + zeichner.textlength(b, font=f))


def banner(breite: int, hoehe: int, unterzeile: str | None = None) -> Image.Image:
    bild = nachtgrund((breite, hoehe), mitte=(0.28, 0.5))

    # Goldschimmer hinter dem Zeichen. Kraeftig genug, dass sich die Kachel in
    # der dunklen Leanback-Reihe abhebt — ein fast schwarzes Banner sieht dort
    # aus wie gar keines, und genau das hat Play bei vc12 bemaengelt.
    schimmer = Image.new("L", (breite, hoehe), 0)
    r = int(hoehe * 0.70)
    ImageDraw.Draw(schimmer).ellipse(
        (int(breite * 0.24) - r, hoehe // 2 - r, int(breite * 0.24) + r, hoehe // 2 + r), fill=150
    )
    schimmer = schimmer.filter(ImageFilter.GaussianBlur(hoehe * 0.16))
    bild.paste(Image.new("RGB", (breite, hoehe), (104, 76, 20)), (0, 0), schimmer)

    stern_kante = round(hoehe * 0.56)
    grad = round(hoehe * 0.185)
    f = schrift(grad)
    zeichner = ImageDraw.Draw(bild)
    text_breite = round(zeichner.textlength("SALATI TV", font=f))
    luecke = round(hoehe * 0.12)
    gesamt = stern_kante + luecke + text_breite
    x0 = (breite - gesamt) // 2
    mitte_y = hoehe // 2 if unterzeile is None else round(hoehe * 0.47)

    stern_auf(bild, stern_kante, 0.98, (x0 + stern_kante // 2, mitte_y))
    grundlinie = mitte_y + round(grad * 0.36)
    wortmarke(zeichner, x0 + stern_kante + luecke, grundlinie, f)

    if unterzeile:
        fu = schrift(round(hoehe * 0.072))
        zeichner.text(
            (x0 + stern_kante + luecke, grundlinie + round(hoehe * 0.13)),
            unterzeile,
            font=fu,
            fill=(196, 190, 178),
            anchor="ls",
        )
    return bild


def schrift_auf_breite(text: str, ziel: int) -> ImageFont.FreeTypeFont:
    """Groesste fette Grotesk, mit der `text` hoechstens `ziel` breit wird."""
    messer = ImageDraw.Draw(Image.new("L", (1, 1)))
    grad = 8
    while grad < 400 and messer.textlength(text, font=schrift(grad + 2)) <= ziel:
        grad += 2
    return schrift(grad)


def apple_ikone(breite: int, hoehe: int) -> Image.Image:
    """Apple-TV-Ikone: quer im Verhaeltnis 5:3, Stern oben, Wortmarke darunter.

    Die Querlage der Banner-Kachel (Stern NEBEN dem Text) traegt hier nicht: bei
    400x240 wird die Zeile breiter als die Kachel. Apple maskiert die Ikone
    ausserdem mit abgerundeten Ecken und verschiebt die Ebenen beim Fokus
    gegeneinander — was am Rand steht, wandert dabei heraus. Deshalb bleibt
    alles in den mittleren 78 % der Breite.
    """
    bild = nachtgrund((breite, hoehe), mitte=(0.5, 0.42))

    stern_kante = round(hoehe * 0.50)
    stern_auf(bild, stern_kante, 0.98, (breite // 2, round(hoehe * 0.40)))

    f = schrift_auf_breite("SALATI TV", round(breite * 0.62))
    zeichner = ImageDraw.Draw(bild)
    gesamt = round(zeichner.textlength("SALATI TV", font=f))
    wortmarke(zeichner, (breite - gesamt) // 2, round(hoehe * 0.86), f)
    return bild


def schreibe(bild: Image.Image, name: str) -> None:
    pfad = os.path.normpath(os.path.join(ASSETS, name))
    bild.save(pfad)
    print(f"{name:32s} {bild.size[0]}x{bild.size[1]} {bild.mode}")


def main() -> None:
    schreibe(icon(1024), "icon.png")
    schreibe(icon(1024).resize((512, 512), Image.LANCZOS), "icon-512.png")
    schreibe(icon_adaptiv(1024), "icon-adaptive.png")

    gross = banner(1280, 720)
    schreibe(gross, "store-banner-1280x720.png")
    schreibe(gross.resize((320, 180), Image.LANCZOS), "banner.png")

    # Je Bildschirmdichte eine eigene Aufloesung. Das Config-Plugin von
    # react-native-tvos legt sonst DIESELBE 320x180-Datei in alle sechs
    # drawable-Ordner: in drawable-xxxhdpi liest Android sie als 80x45 dp und
    # rechnet die Kachel vierfach hoch. Auf einem 4K-Fernseher ist das Banner
    # damit sichtbar verwaschen.
    for name, (b, h) in DICHTEN.items():
        schreibe(gross.resize((b, h), Image.LANCZOS), f"banner-{name}.png")

    schreibe(banner(1024, 500, "Gebetszeiten · Koran · Lernen"), "feature-graphic-1024x500.png")

    apple_tv()


def apple_tv() -> None:
    """Markengrafiken fuer Apple TV (assets/appletv/).

    Die Ikone wird EINMAL gross gerechnet und heruntergerechnet — der Stern ist
    Vektorgeometrie mit vierfacher Ueberabtastung, direkt bei 400x240 gezeichnet
    fransen die Zacken sichtbar aus.
    """
    os.makedirs(os.path.normpath(os.path.join(ASSETS, "appletv")), exist_ok=True)

    ikone = apple_ikone(1280, 768)
    schreibe(ikone, "appletv/icon-1280x768.png")
    schreibe(ikone.resize((800, 480), Image.LANCZOS), "appletv/icon-800x480.png")
    schreibe(ikone.resize((400, 240), Image.LANCZOS), "appletv/icon-400x240.png")

    # Top Shelf: das Bild ueber der Ikone im Startbildschirm. Hier traegt die
    # Banner-Kachel, weil sie mit 8:3 breit genug ist.
    ts = banner(3840, 1440)
    schreibe(ts, "appletv/top-shelf-3840x1440.png")
    schreibe(ts.resize((1920, 720), Image.LANCZOS), "appletv/top-shelf-1920x720.png")

    tsw = banner(4640, 1440)
    schreibe(tsw, "appletv/top-shelf-wide-4640x1440.png")
    schreibe(tsw.resize((2320, 720), Image.LANCZOS), "appletv/top-shelf-wide-2320x720.png")


if __name__ == "__main__":
    main()
