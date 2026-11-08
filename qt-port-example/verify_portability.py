"""Native Qt capability probes extending the existing SVG/material examples.
Run under Xvfb with PySide6, QSG_RHI_BACKEND=opengl, LIBGL_ALWAYS_SOFTWARE=1.
Not an ExoSnap integration test, arbitrary-background or depth-parity proof.
"""
import argparse
import hashlib
import json
import time
from pathlib import Path
from PySide6.QtCore import QByteArray, QRectF, QUrl, Qt, qVersion
from PySide6.QtGui import QColor, QGuiApplication, QImage, QPainter, QPainterPath
from PySide6.QtSvg import QSvgRenderer
from PySide6.QtQuick import QQuickView

parser = argparse.ArgumentParser()
parser.add_argument('--fixtures', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
app = QGuiApplication([])

def raster(data, size=480, background=Qt.transparent):
    svg = QSvgRenderer(QByteArray(data))
    assert svg.isValid(), 'Qt rejected SVG'
    image = QImage(size, round(size * 2 / 3), QImage.Format_ARGB32_Premultiplied)
    image.fill(background)
    painter = QPainter(image)
    painter.setRenderHint(QPainter.Antialiasing)
    svg.render(painter, QRectF(0, 0, image.width(), image.height()))
    painter.end()
    return image

def digest(image):
    return hashlib.sha256(bytes(image.constBits())).hexdigest()

manifest = json.loads((args.fixtures / 'manifest.json').read_text())
backdrops = {'dark': '#09111b', 'light': '#f4f6f9', 'mixed': '#9baab4'}
svg_results = []
for fixture in manifest['fixtures']:
    name = fixture['name']
    background = QColor(backdrops[fixture['scene']])
    raw = raster((args.fixtures / (name + '.raw.svg')).read_bytes(), background=background)
    flat = raster((args.fixtures / (name + '.svg')).read_bytes(), background=background)
    assert flat.save(str(args.out / (name + '.png')))
    svg_results.append({'name': name, 'rawEqualsFlattened': digest(raw) == digest(flat), 'sha256': digest(flat)})
for scene in backdrops:
    for alpha in (0, 30, 70, 90):
        neutral = next(x for x in svg_results if x['name'] == f'{scene}-{alpha}-neutral')
        pressed = next(x for x in svg_results if x['name'] == f'{scene}-{alpha}-pressed')
        assert neutral['sha256'] != pressed['sha256'], 'Qt neutral/pressed paint identical'

# Test the exact mask operations used by the browser annulus: user-space
# white rectangle, transformed black cutout, independent center, no alpha stack.
mask = b'''<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
<defs><mask id="m" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="0" y="0" width="120" height="80">
<rect width="120" height="80" fill="white"/><circle cx="0" cy="0" r="15" transform="translate(60 40)" fill="black"/>
</mask></defs><g mask="url(#m)"><circle cx="60" cy="40" r="30" fill="white" fill-opacity="0.96"/></g>
<circle cx="60" cy="40" r="15" fill="#9ca3aa" fill-opacity="0.3"/></svg>'''
ring = raster(mask, 120)
assert abs(ring.pixelColor(60, 40).alphaF() - .3) < .02, 'SVG mask stacks alpha in center'
assert abs(ring.pixelColor(84, 40).alphaF() - .96) < .02, 'SVG annulus missing'
ring.save(str(args.out / 'native-annulus-mask.png'))
# QPainter path subtraction is a native fallback, requiring no SVG-mask support.
image = QImage(120, 80, QImage.Format_ARGB32_Premultiplied); image.fill(Qt.transparent)
outer, inner = QPainterPath(), QPainterPath()
outer.addEllipse(QRectF(30, 10, 60, 60)); inner.addEllipse(QRectF(45, 25, 30, 30))
painter = QPainter(image)
painter.fillPath(outer.subtracted(inner), QColor.fromRgbF(1, 1, 1, .96))
painter.fillPath(inner, QColor.fromRgbF(.61, .64, .67, .3)); painter.end()
assert abs(image.pixelColor(60, 40).alphaF() - .3) < .02
assert abs(image.pixelColor(84, 40).alphaF() - .96) < .02
image.save(str(args.out / 'native-annulus-painter.png'))

view = QQuickView(); view.setColor(Qt.transparent)
view.setSource(QUrl.fromLocalFile(str(Path(__file__).with_name('PortabilitySmoke.qml').resolve())))
assert view.status() != QQuickView.Error, [e.toString() for e in view.errors()]
view.resize(256, 256); view.show()
def settle():
    end = time.monotonic() + .7
    while time.monotonic() < end:
        app.processEvents(); time.sleep(.01)
settle()
root = view.rootObject()
material_results = []
for name, alpha, turn, press in [('transparent', .3, 0, 0), ('opaque', 1, 0, 0), ('rotated', .3, 35, 0), ('pressed', .3, 0, 1)]:
    root.setProperty('alpha', alpha); root.setProperty('turn', turn); root.setProperty('press', press)
    view.update(); settle(); rendered = view.grabWindow()
    assert not rendered.isNull(), 'No native Quick3D render'
    assert rendered.pixelColor(128, 128).alpha() > 10, 'Blank native Quick3D render'
    rendered.save(str(args.out / ('quick3d-' + name + '.png')))
    material_results.append({'name': name, 'sha256': digest(rendered), 'centerAlpha': rendered.pixelColor(128,128).alpha()})
assert len({x['sha256'] for x in material_results}) == 4, 'Material/transform states not rendered distinctly'
view.close()
report = {'qt': qVersion(), 'captureRevision': manifest['revision'], 'svgRenders': len(svg_results),
    'rawVsFlattenedDifferences': sum(not x['rawEqualsFlattened'] for x in svg_results),
    'svgMask': 'PASS', 'painterAnnulus': 'PASS', 'quick3dReferenceMaterial': material_results,
    'svg': svg_results, 'scope': 'Linux software OpenGL capability probes; not native ExoSnap, D3D11, original rig depth/compositor or pixel parity'}
(args.out / 'native-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k != 'svg'}, indent=2))
