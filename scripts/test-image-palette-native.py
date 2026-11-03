#!/usr/bin/env python3
"""Run the production pixel extractor without Expo (requires kotlinc/java or swiftc)."""
import json
import pathlib
import shutil
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE = ROOT / 'modules/expo-image-colors'

# name, RGBA populations, expected neutral-accent flag. Opaque pixels exercise both
# implementations' existing channel conversion without platform image decoders.
CASES = [
    ('black', [(0, 0, 0, 255)] * 1000, True),
    ('white', [(255, 255, 255, 255)] * 1000, True),
    ('greyscale', [(i % 256, i % 256, i % 256, 255) for i in range(1000)], True),
    ('near neutral noise', [(128 + i % 3 - 1, 128, 128 - i % 3 + 1, 255) for i in range(1000)], True),
    ('sparse coloured noise', [(128, 128, 128, 255)] * 999 + [(255, 0, 0, 255)], True),
    ('coloured detail on grey', [(128, 128, 128, 255)] * 990 + [(255, 0, 0, 255)] * 10, False),
    ('single hue', [(0, 160, 80, 255)] * 1000, False),
    ('warm grey', [(132, 128, 124, 255)] * 1000, True),
    ('cool grey', [(124, 128, 132, 255)] * 1000, True),
    ('sepia', [(145, 128, 105, 255)] * 1000, True),
    ('olive', [(128, 128, 110, 255)] * 1000, True),
    ('colour with neutral majority', [(128, 128, 128, 255)] * 800 + [(240, 20, 30, 255)] * 100 + [(20, 30, 240, 255)] * 100, False),
    ('empty', [], None),
    ('below alpha cutoff', [(128, 128, 128, 127)] * 1000, None),
    ('transparent', [(0, 0, 0, 0)] * 1000, None),
]

# Recorded from the existing chromatic extractor, before monochrome metadata.
COLOUR_PALETTES = {
    'single hue': ('#10562C', '#61DE8A'),
    'colour with neutral majority': ('#0F15CF', '#A3CBFF'),
    'coloured detail on grey': ('#87110A', '#FFB5A5'),
    'sparse coloured noise': ('#87110A', '#FFB5A5'),
}


ALBUM_FIXTURES = json.loads((ROOT / 'scripts/fixtures/artwork-accent/albums.json').read_text())
for fixture in ALBUM_FIXTURES:
    rgb = fixture['rgb']
    pixels = [tuple(bytes.fromhex(rgb[i:i + 6])) + (255,) for i in range(0, len(rgb), 6)]
    CASES.append((fixture['name'], pixels, fixture['neutral']))

ALBUM_PALETTES = {fixture['name']: fixture.get('palette') for fixture in ALBUM_FIXTURES}


class NativePaletteTests(unittest.TestCase):
    def run_program(self, build, run, directory):
        compiled = subprocess.run(build, cwd=directory, capture_output=True, text=True)
        self.assertEqual(compiled.returncode, 0, compiled.stdout + compiled.stderr)
        result = subprocess.run(run, cwd=directory, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(result.stdout.strip(), f'{len(CASES)} fixtures passed')

    @unittest.skipUnless(shutil.which('kotlinc') and shutil.which('java'), 'kotlinc and java required')
    def test_kotlin_extractor(self):
        source = (MODULE / 'android/src/main/java/expo/modules/imagecolors/ExpoImageColorsModule.kt').read_text()
        # Keep the production constants and all pixel/colour math verbatim.
        core = source[source.index('  // --- Tunable constants'):]
        imports = '\n'.join(line for line in source.splitlines() if line.startswith('import kotlin.math.'))
        fixture_lines = []
        for name, pixels, expected in CASES:
            values = ','.join(str((a << 24 | r << 16 | g << 8 | b) - (1 << 32) if a >= 128 else (a << 24 | r << 16 | g << 8 | b)) for r, g, b, a in pixels)
            check = 'result == null' if expected is None else f'result != null && (result["monochrome"] == true) == {str(expected).lower()}'
            if name in ALBUM_PALETTES:
                palette = ALBUM_PALETTES[name]
                for mode in ['dark', 'light']:
                    if palette is None:
                        check += f' && result?.get("{mode}") == null'
                    else:
                        for field, colour in palette[mode].items():
                            value = 'null' if colour is None else f'"{colour}"'
                            check += f' && (result?.get("{mode}") as Map<*, *>)["{field}"] == {value}'
            if name in COLOUR_PALETTES:
                for mode, colour in zip(['dark', 'light'], COLOUR_PALETTES[name]):
                    check += f' && (result?.get("{mode}") as Map<*, *>) ["primary"] == "{colour}"'
            fixture_lines.append(f'run {{ val result = method.invoke(extractor, "{values}".split(",").filter {{ it.isNotEmpty() }}.map {{ it.toInt() }}.toIntArray()) as Map<*, *>?; check({check}) {{ "{name}: $result" }} }}')
        main = '''
fun main() {
  val extractor = Extractor()
  val method = Extractor::class.java.getDeclaredMethod("extractPalette", IntArray::class.java)
  method.isAccessible = true
''' + '\n'.join(fixture_lines) + f'\n println("{len(CASES)} fixtures passed")\n}}\n'
        with tempfile.TemporaryDirectory() as directory:
            pathlib.Path(directory, 'Palette.kt').write_text(imports + '\nclass Extractor {\n' + core + main)
            self.run_program(['kotlinc', 'Palette.kt', '-include-runtime', '-d', 'palette.jar'], ['java', '-jar', 'palette.jar'], directory)

    @unittest.skipUnless(shutil.which('swiftc'), 'swiftc required')
    def test_swift_extractor(self):
        source = (MODULE / 'ios/ExpoImageColorsModule.swift').read_text()
        core = source[source.index('  // --- Tunable constants'):].replace('private static func extractPalette', 'static func extractPalette')
        fixture_lines = []
        for name, pixels, expected in CASES:
            values = ','.join(str(channel) for pixel in pixels for channel in pixel)
            check = 'result == nil' if expected is None else f'result != nil && ((result?["monochrome"] as? Bool) == true) == {str(expected).lower()}'
            if name in ALBUM_PALETTES:
                palette = ALBUM_PALETTES[name]
                for mode in ['dark', 'light']:
                    if palette is None:
                        check += f' && (result?["{mode}"] as? [String: Any?]) == nil'
                    else:
                        for field, colour in palette[mode].items():
                            value = 'nil' if colour is None else f'"{colour}"'
                            check += f' && ((result?["{mode}"] as? [String: Any?])?["{field}"] as? String) == {value}'
            if name in COLOUR_PALETTES:
                for mode, colour in zip(['dark', 'light'], COLOUR_PALETTES[name]):
                    check += f' && ((result?["{mode}"] as? [String: Any?])?["primary"] as? String) == "{colour}"'
            fixture_lines.append(f'do {{ let result = Extractor.extractPalette(rgba: "{values}".split(separator: ",").map {{ UInt8($0)! }}, width: {len(pixels)}, height: 1); precondition({check}, "{name}") }}')
        with tempfile.TemporaryDirectory() as directory:
            pathlib.Path(directory, 'main.swift').write_text('import Foundation\nclass Extractor {\n' + core + '\n' + '\n'.join(fixture_lines) + f'\nprint("{len(CASES)} fixtures passed")\n')
            self.run_program(['swiftc', 'main.swift', '-o', 'palette'], ['./palette'], directory)


if __name__ == '__main__':
    unittest.main()
