#!/usr/bin/env python3
"""Update an existing Windows package's shell without changing its launcher/vault."""
import argparse
import shutil
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('windows_package', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
target = args.windows_package / 'offline'
if not (target / 'desktop-factory.js').is_file():
    parser.error('Expected an existing NAH Windows offline package')
source = root / 'app/src/main/assets/offline'
shutil.copytree(source / 'assets', target / 'assets', dirs_exist_ok=True)
html = (source / 'index.html').read_text(encoding='utf-8')
html = html.replace('https://sachyhoc.com/nah-lab-iso/native-shell-v1.58.29/assets/', 'assets/')
html = html.replace('"homeUrl": "https://sachyhoc.com/nah-lab-iso/"', '"homeUrl": "./index.html"')
html = html.replace('<script src="assets/app.js" defer>', '<script src="desktop-factory.js"></script>\n<script src="desktop-mirror.js"></script>\n<script src="assets/app.js" defer>')
(target / 'index.html').write_text(html, encoding='utf-8')
shutil.copy2(root / 'windows/desktop-mirror.js', target / 'desktop-mirror.js')
print('Updated Windows shell to Web 1.58.29; launcher and user vault preserved')
