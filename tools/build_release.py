"""Build a deterministic, upload-ready CrazyGames ZIP from the runtime allowlist."""
from pathlib import Path
import argparse
import re
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("root", type=Path)
args = parser.parse_args()
root = args.root.resolve()
files = ["index.html", "css/style.css", "js/lib/matter.min.js"]
files += [f"js/{name}.js" for name in ("sim", "levels", "i18n", "audio", "platform", "render", "game", "ui")]
for name in files:
    path = root / name
    if not path.is_file():
        raise SystemExit(f"Missing runtime asset: {name}")
    text = path.read_text(encoding="utf-8")
    if re.search(r"[Ѐ-ӿ]", text):
        raise SystemExit(f"Non-English Cyrillic text remains in {name}")
    if re.search(r"vkBridge|vk-bridge|vk_app_id|vk-only|VKWebApp", text):
        raise SystemExit(f"VK integration remains in {name}")
html = (root / "index.html").read_text(encoding="utf-8")
if 'https://sdk.crazygames.com/crazygames-sdk-v3.js' not in html:
    raise SystemExit("CrazyGames SDK v3 script is missing")
if 'data-action="lang"' in html or 'lang="ru"' in html:
    raise SystemExit("Russian language selection remains")
for reference in re.findall(r'(?:src|href)="([^"#]+)"', html):
    if reference.startswith("https://"):
        if reference != "https://sdk.crazygames.com/crazygames-sdk-v3.js":
            raise SystemExit(f"Unexpected external dependency: {reference}")
    elif reference not in files:
        raise SystemExit(f"Unbundled HTML asset: {reference}")
output = root / "dist" / "yoobird-crazygames.zip"
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name in files:
        entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, (root / name).read_bytes())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert "index.html" in archive.namelist()
    assert len(archive.namelist()) == len(files)
print(f"Built {output}")
print(f"{len(files)} runtime files; {sum((root / f).stat().st_size for f in files):,} bytes unpacked; {output.stat().st_size:,} bytes ZIP")
print("PASS: English-only source, no VK integration, relative assets, ZIP integrity")
