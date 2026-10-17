"""Build Windows-exclusive opaque taskbar ICO from canonical artwork without changing WebApp assets."""
from PIL import Image
from pathlib import Path
from io import BytesIO
import struct
src=Image.open('windows-taskbar-icon.png').convert('RGBA')
if src.getextrema()[3]!=(255,255): raise SystemExit('Expected opaque Windows icon')
sizes=(16,24,32,48,64,96,128,256)
parts=[]
for size in sizes:
    image=src.resize((size,size),Image.Resampling.LANCZOS)
    assert image.getextrema()[3]==(255,255)
    b=BytesIO();image.save(b,'PNG',optimize=True);parts.append(b.getvalue())
output=struct.pack('<HHH',0,1,len(sizes));offset=6+16*len(sizes)
for size,png in zip(sizes,parts):
    output+=struct.pack('<BBBBHHII',size&255,size&255,0,0,1,32,len(png),offset);offset+=len(png)
Path('icon.ico').write_bytes(output+b''.join(parts))
print('Native Taskbar ICO: opaque at all resolutions; unchanged WebApp logo')
