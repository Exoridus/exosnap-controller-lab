// Minimal Qt 6 rasterization proof for exported ExoSnap Material Lab SVGs.
// No custom shader, post-process, GPU readback or extra 3D pass.
// Usage: exosnap-svg-proof exported.svg output.png [background.png]
#include <QGuiApplication>
#include <QImage>
#include <QPainter>
#include <QSvgRenderer>
#include <QRectF>
#include <QString>
#include <QDebug>

int main(int argc,char* argv[]){
    QGuiApplication app(argc,argv);
    if(argc<3){
        qCritical() << "Usage: exosnap-svg-proof exported.svg output.png [background.png]";
        return 2;
    }
    const QString svgFile=QString::fromLocal8Bit(argv[1]);
    QSvgRenderer renderer(svgFile);
    if(!renderer.isValid()){
        qCritical() << "Invalid SVG:" << svgFile;
        return 3;
    }
    QImage image(480,320,QImage::Format_ARGB32_Premultiplied);
    image.fill(QColor(244,246,249));
    QPainter painter(&image);
    painter.setRenderHint(QPainter::Antialiasing,true);
    painter.setRenderHint(QPainter::SmoothPixmapTransform,true);
    if(argc>3){
        QImage background(QString::fromLocal8Bit(argv[3]));
        if(!background.isNull())painter.drawImage(QRectF(0,0,480,320),background);
    }
    renderer.render(&painter,QRectF(0,0,480,320));
    painter.end();
    if(!image.save(QString::fromLocal8Bit(argv[2]))){
        qCritical() << "Could not save output image";
        return 4;
    }
    return 0;
}
