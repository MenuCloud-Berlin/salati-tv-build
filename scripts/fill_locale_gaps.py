#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fuellt die Luecken in den TV-Sprachdateien.

Befund 2026-08-25: `src/lib/i18n.test.ts` prueft, dass jede Sprache exakt
denselben Schluesselumfang hat wie Deutsch - und schlug in ZWOELF von
vierzehn Sprachen fehl, schon vor der Kursmenue-Aenderung. Es fehlten die
Schluessel rund um Uhr-Groesse, Freitags-Kennzeichnung und
Bildschirmschoner-Inhalt. In diesen Sprachen stand an den betroffenen
Stellen der rohe Schluessel.

Einmaliges Skript: einlesen, ergaenzen, schreiben. Vorhandene Werte werden
NIE ueberschrieben.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCALES = HERE.parent / "src" / "locales"

# Pfad -> {Sprachcode: Text}
TEXTE: dict[str, dict[str, str]] = {
    "clock.jumua": {
        "tr": "Cuma Mübarek", "ar": "جمعة مباركة", "es": "Yumu'a Mubarak",
        "fr": "Joumou'a Moubarak", "id": "Jumat Mubarak", "bn": "জুমা মোবারক",
        "fa": "جمعه مبارک", "ms": "Jumaat Mubarak", "ur": "جمعہ مبارک",
        "ru": "Джума мубарак", "sw": "Ijumaa Mubarak", "ps": "جمعه مبارک",
    },
    "settings.jumuaModus": {
        "tr": "Cuma işareti", "ar": "علامة الجمعة", "es": "Marca del viernes",
        "fr": "Repère du vendredi", "id": "Penanda Jumat", "bn": "শুক্রবারের চিহ্ন",
        "fa": "نشانه جمعه", "ms": "Penanda Jumaat", "ur": "جمعہ کا نشان",
        "ru": "Отметка пятницы", "sw": "Alama ya Ijumaa", "ps": "د جمعې نښه",
    },
    "settings.screensaverContent": {
        "tr": "Namaz saatinde göster", "ar": "إظهار على ساعة الصلاة",
        "es": "Mostrar en el reloj de oración", "fr": "Afficher sur l'horloge de prière",
        "id": "Tampilkan di jam salat", "bn": "নামাজ ঘড়িতে দেখান",
        "fa": "نمایش روی ساعت نماز", "ms": "Papar pada jam solat",
        "ur": "نماز گھڑی پر دکھائیں", "ru": "Показывать на молитвенных часах",
        "sw": "Onyesha kwenye saa ya swala", "ps": "د لمانځه په ساعت کې ښودل",
    },
    "settings.clockScale.title": {
        "tr": "Saat boyutu", "ar": "حجم الساعة", "es": "Tamaño del reloj",
        "fr": "Taille de l'horloge", "id": "Ukuran jam", "bn": "ঘড়ির আকার",
        "fa": "اندازه ساعت", "ms": "Saiz jam", "ur": "گھڑی کا سائز",
        "ru": "Размер часов", "sw": "Ukubwa wa saa", "ps": "د ساعت اندازه",
    },
    "settings.clockScale.small": {
        "tr": "Küçük", "ar": "صغير", "es": "Pequeño", "fr": "Petit", "id": "Kecil",
        "bn": "ছোট", "fa": "کوچک", "ms": "Kecil", "ur": "چھوٹا", "ru": "Маленький",
        "sw": "Ndogo", "ps": "کوچنی",
    },
    "settings.clockScale.medium": {
        "tr": "Orta", "ar": "متوسط", "es": "Mediano", "fr": "Moyen", "id": "Sedang",
        "bn": "মাঝারি", "fa": "متوسط", "ms": "Sederhana", "ur": "درمیانہ",
        "ru": "Средний", "sw": "Wastani", "ps": "منځنی",
    },
    "settings.clockScale.large": {
        "tr": "Büyük", "ar": "كبير", "es": "Grande", "fr": "Grand", "id": "Besar",
        "bn": "বড়", "fa": "بزرگ", "ms": "Besar", "ur": "بڑا", "ru": "Большой",
        "sw": "Kubwa", "ps": "لوی",
    },
    "settings.versDesTages": {
        "tr": "Günün ayeti", "ar": "آية اليوم", "es": "Versículo del día",
        "fr": "Verset du jour", "id": "Ayat hari ini", "bn": "দিনের আয়াত",
        "fa": "آیه روز", "ms": "Ayat hari ini", "ur": "آج کی آیت",
        "ru": "Аят дня", "sw": "Aya ya siku", "ps": "د ورځې آیت",
    },
    "settings.wetter": {
        "tr": "Hava durumu", "ar": "الطقس", "es": "Tiempo", "fr": "Météo",
        "id": "Cuaca", "bn": "আবহাওয়া", "fa": "آب و هوا", "ms": "Cuaca",
        "ur": "موسم", "ru": "Погода", "sw": "Hali ya hewa", "ps": "هوا",
    },
    "settings.clockScale.xlarge": {
        "tr": "Çok büyük", "ar": "كبير جدًا", "es": "Muy grande", "fr": "Très grand",
        "id": "Sangat besar", "bn": "অতি বড়", "fa": "خیلی بزرگ", "ms": "Sangat besar",
        "ur": "بہت بڑا", "ru": "Очень большой", "sw": "Kubwa sana", "ps": "ډېر لوی",
    },
}


def setze(daten: dict, pfad: str, wert: str) -> bool:
    teile = pfad.split(".")
    kopf = daten
    for t in teile[:-1]:
        kopf = kopf.setdefault(t, {})
        if not isinstance(kopf, dict):
            return False
    if teile[-1] in kopf:
        return False          # vorhandene Werte bleiben unangetastet
    kopf[teile[-1]] = wert
    return True


def main() -> None:
    for datei in sorted(LOCALES.glob("*.json")):
        code = datei.stem
        daten = json.loads(datei.read_text(encoding="utf-8"))
        gesetzt = 0
        for pfad, nach_sprache in TEXTE.items():
            wert = nach_sprache.get(code)
            if wert and setze(daten, pfad, wert):
                gesetzt += 1
        if gesetzt:
            datei.write_text(json.dumps(daten, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")
        print(f"{code}: {gesetzt} Schluessel ergaenzt")


if __name__ == "__main__":
    main()
