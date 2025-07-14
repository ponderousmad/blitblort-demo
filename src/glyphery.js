let GLYPHERY = (function () {
    "use strict";

    class SnapLine extends Object {
        constructor(origin, axis) {
            super();

            this.origin = origin;
            this.axis = axis.normalized();
            this.style = "rgba(0,0,0.2,.5)";
            this.dash = [10, 2, 5, 2];
        }

        draw(context, width, height) {
            context.save();
            context.strokeStyle = this.style;
            context.setLineDash(this.dash);
            context.beginPath();
            context.moveTo(this.origin.x, this.origin.y);
            context.lineTo(this.origin.x + width * this.axis.x, this.origin.y + height * this.axis.y);
            context.stroke();
            context.restore();
        };

        snap(point, snapDistance) {
            // Avoid numerical issues for strictly vertical/horizontal
            if (this.axis.x === 0) {
                if (Math.abs(this.origin.x - point.x) <= snapDistance) {
                    return new R2.V(this.origin.x, point.y);
                }
            } else if (this.axis.y === 0) {
                if (Math.abs(this.origin.y - point.y) <= snapDistance) {
                    return new R2.V(point.x, this.origin.y);
                }
            } else {
                // Construct the line segment from the point to the snap origin.
                let offset = R2.subVectors(point, this.origin),
                // Project that segment onto the axis direction.
                    projectedOffset = this.axis.scaled(offset.dot(this.axis));
                offset.sub(projectedOffset);
                
                // If the length of that segment is less or equal to the snap distance, add it to the point.
                if (offset.lengthSq() <= snapDistance * snapDistance) {
                    return R2.subVectors(point, offset);
                }
            }
            return point;
        }

        drawSnap(context, point, snapDistance, drawDistance) {
            let drawSnapped = this.snap(point, drawDistance),
                snapToleranceSq = 0.0001;
            if (point == drawSnapped) {
                return;
            }
            context.save();
            if (R2.pointDistanceSq(drawSnapped, this.snap(point, snapDistance)) < snapToleranceSq) {
                context.strokeStyle = "rgba(0,255,0,0.5)";
            } else {
                context.strokeStyle = "rgba(255,0,0,0.25)";
            }
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(drawSnapped.x, drawSnapped.y);
            context.stroke();
            context.restore();
        }
    }

    class Rectangle extends Object {
        constructor(startLocation) {
            super();
            this.topLeft = startLocation.clone();
            this.topRight = this.topLeft.clone();
            this.bottomLeft = this.topLeft.clone();
            this.bottomRight = this.topLeft.clone();
            this.spline = new SPLINE.Path(true);
            this.spline.addSegment(new SPLINE.LineSegment(this.topLeft, this.topRight));
            this.spline.addSegment(new SPLINE.LineSegment(undefined, this.bottomRight));
            this.spline.addSegment(new SPLINE.LineSegment(undefined, this.bottomLeft));
        }

        update() {
            this.topRight.x = this.bottomRight.x;
            this.bottomLeft.y = this.bottomRight.y;
        }
    };

    class Editor extends Object {
        constructor() {
            super();
            this.maximize = false;
            this.updateInDraw = true;
            this.fontEditArea = document.getElementById("fontData");
            this.snaps = [
                new SnapLine(new R2.V(0, 0), new R2.V(1, 1)),
                new SnapLine(new R2.V(0, 20), new R2.V(1, 0)),
                new SnapLine(new R2.V(0, 100), new R2.V(1, 0)),
                new SnapLine(new R2.V(0, 180), new R2.V(1, 0)),
                new SnapLine(new R2.V(20, 0), new R2.V(0, 1))
            ];
            this.snapDistance = 4;
            this.vertexSize = 10;
            this.tesselation = 20;
            this.hoverPoint = new R2.V(0, 0);
            this.addRect = null;

            this.batch = new BLIT.Batch("images/");
            this.vertexImage = this.batch.load("vertex.png");
            this.vertexShadow = this.batch.load("vertexShadow.png");
            this.batch.commit();

            this.font = new GLYPH.Font();

            this.fontGrid = {
                glyphScale: 0.1,
                glyphWidth: 260,
                glyphHeight: 220,
                xStartOffset: 20,
                xSpacing: 4,
                yStartOffset: 250,
                ySpacing: 10,
                lowerStart: "a".charCodeAt(0),
                lowerEnd: "z".charCodeAt(0),
                upperStart: "A".charCodeAt(0),
                upperEnd: "Z".charCodeAt(0),
                digitStart: "0".charCodeAt(0),
                digitEnd: "9".charCodeAt(0)
            };

            let path = new SPLINE.Path(true),
                segment = new SPLINE.BezierCurve();

            path.addSegment(segment);
            segment.addPoint(new R2.V(20,  20));
            segment.addPoint(new R2.V(50,  20));
            segment.addPoint(new R2.V(90,  20));
            segment.addPoint(new R2.V(120, 20));

            segment = new SPLINE.LineSegment(undefined, new R2.V(120, 180));
            path.addSegment(segment);

            segment = new SPLINE.BezierCurve();
            path.addSegment(segment);
            segment.addPoint(new R2.V(90, 180));
            segment.addPoint(new R2.V(50, 180));
            segment.addPoint(new R2.V(20, 180));

            segment = new SPLINE.LineSegment();
            path.addSegment(segment);

            this.editCodePoint = "A".codePointAt(0);
            this.editSpline = 0;
            this.editSegment = 0;
            this.editPoint = null;
            this.font.newGlyph(this.editCodePoint, [path]);

            let editor = this;
            document.getElementById("buttonSave").addEventListener("click", function() {
                editor.checkpoint();
            }, false);
            document.getElementById("buttonLoad").addEventListener("click", function() {
                editor.loadCheckpoint();
            }, false);

            this.checkpoint();
        }

        snap(point, snapDistance) {
            let snapped = point;
            for (let s = 0; s < this.snaps.length; ++s) {
                snapped = this.snaps[s].snap(snapped, snapDistance);
            }
            return snapped;
        }

        checkSelectVertex(stab) {
            let editGlyph = this.font.glyphForCodepoint(this.editCodePoint);
            if (editGlyph) {
                for (const path of editGlyph.getSplines()) {
                    for (const segment of path.getSegments()) {
                        for (const point of segment.controlPoints()) {
                            if (R2.pointDistance(point, stab) < this.vertexSize) {
                                this.editPoint = point;
                            }
                        }
                    }
                }
            }
            return this.editPoint != null;
        }

        checkSelectGlyphRow(stab, startCodePoint, endCodePoint, xOffset, yOffset) {
            const xSpacing = this.fontGrid.glyphWidth * this.fontGrid.glyphScale + this.fontGrid.xSpacing;
            for (let codePoint = startCodePoint; codePoint <= endCodePoint; ++codePoint) {
                let glyphBox = new R2.AABox(xOffset, yOffset, this.fontGrid.glyphWidth * this.fontGrid.glyphScale, this.fontGrid.glyphHeight * this.fontGrid.glyphScale);
                if (glyphBox.contains(stab)) {
                    this.editCodePoint = codePoint;
                    return;
                }
                xOffset += xSpacing;
            }
        }

        checkSelectGlyph(stab) {
            let yOffset = this.fontGrid.yStartOffset,
                ySpacing = this.fontGrid.glyphHeight * this.fontGrid.glyphScale + this.fontGrid.ySpacing;

            this.checkSelectGlyphRow(stab, this.fontGrid.lowerStart, this.fontGrid.lowerEnd, this.fontGrid.xStartOffset, yOffset);
            yOffset += ySpacing;
            this.checkSelectGlyphRow(stab, this.fontGrid.upperStart, this.fontGrid.upperEnd, this.fontGrid.xStartOffset, yOffset);
            yOffset += ySpacing;
            this.checkSelectGlyphRow(stab, this.fontGrid.digitStart, this.fontGrid.digitEnd, this.fontGrid.xStartOffset, yOffset);
        }

        addRectangle(stab) {
            this.addRect = new Rectangle(stab);
            this.editPoint = this.addRect.bottomRight;

            let editGlyph = this.font.glyphForCodepoint(this.editCodePoint);
            if (editGlyph) {
                editGlyph.addSpline(this.addRect.spline);
            } else {
                this.font.newGlyph(this.editCodePoint, [this.addRect.spline]);
            }
        }

        getStab(pointer) {
            return new R2.V(pointer.location().x, pointer.location().y);
        }

        getSnappedStab(keyboard, pointer) {
            let stab = this.getStab(pointer);
            if (keyboard.isCtrlDown()) {
                stab = this.snap(stab, this.snapDistance);
            }
            return stab;
        }

        update(now, elapsed, keyboard, pointer) {

            this.hoverPoint = new R2.V(pointer.hoverLocation().x, pointer.hoverLocation().y);

            if (pointer.activated()) {
                if (keyboard.isAsciiDown("B")) {
                    this.addRectangle(this.getSnappedStab(keyboard, pointer));

                    // Early out
                    return;
                }

                let stab = this.getStab(pointer);
                if (!this.checkSelectVertex(stab)) {
                    this.checkSelectGlyph(stab);
                }
            }

            if (this.editPoint) {
                if (pointer.primary) {
                    this.editPoint.copy(this.getSnappedStab(keyboard, pointer));
                    if (this.addRect) {
                        this.addRect.update();
                    }
                } else {
                    this.editPoint = null;
                    this.addRect = null;
                }
            }
        }

        drawVertex(context, location, tint) { 
            if (this.batch.loaded) {
                BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
                BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
            }
        }

        drawLines(context, points, style) {
            context.save();
            context.strokeStyle = style || "rgba(0,0,0,.5)";
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            for (let p = 1; p < points.length; ++p) {
                context.lineTo(points[p].x, points[p].y);
            }
            context.stroke();
            context.restore();
        }
        
        drawLine(context, start, end, style) {
            this.drawLines(context, [start, end], style);
        }

        drawPath(context, path, points, lineStyle, handleStyle, hullStyle) {
            if (!path.isClosed()) {
                this.drawLines(context, points, lineStyle);
            }
            let prevWasHandle = false,
                prevPoint = null,
                segments = path.getSegments();
            for (let s = 0; s < segments.length; ++s) {
                let points = segments[s].controlPoints();
                for (let p = 0; p < points.length; ++p) {
                    let isHandle = (p === 0 && s === 0) || segments[s].isLinear() || (p === (points.length - 1) && (s < segments.length - 1 || !path.isClosed()));
                    this.drawVertex(context, points[p], isHandle ? [0,1,0] : [1,0,0]);
                    if (p > 0 || s > 0) {
                        this.drawLine(context, prevPoint, points[p], isHandle || prevWasHandle ? handleStyle : hullStyle);
                    }
                    if (points[p] == this.editPoint) {
                        for (let snap = 0; snap < this.snaps.length; ++snap) {
                            this.snaps[snap].drawSnap(context, points[p], this.snapDistance, 20);
                        }
                    }
                    prevWasHandle = isHandle;
                    prevPoint = points[p];
                }
            }
            if (path.isClosed()) {
                this.drawLine(context, prevPoint, segments[0].start(), handleStyle);
            }
        }

        fillPath(context, path, points, fillStyle) {
            context.save();
            context.fillStyle = fillStyle;
            context.beginPath();

            context.moveTo(points[0].x, points[0].y);
            for (const point of points) {
                context.lineTo(point.x, point.y);
            }

            context.fill();
            context.restore();
        }

        drawEditGlyph(context, width, height) {
            for (const snap of this.snaps) {
                snap.draw(context, width, height);
            }

            let editGlyph = this.font.glyphForCodepoint(this.editCodePoint);
            if (editGlyph) {
                for (const path of editGlyph.getSplines()) {
                    let points = path.build(this.tesselation);
                    if (path.isClosed()) {
                        let fillStyle = GLYPH.isInsidePolygon(points, this.hoverPoint) ? "rgba(0,64,0,0.1)" : "rgba(64,0,0, 0.1)";
                        this.fillPath(context, path, points, fillStyle);
                    } else {
                        this.drawLines(context, points, "rgba(0, 0, 0, 0.8)");
                    }
                    this.drawPath(context, path, points, "black", "rgba(0,0,255,0.5)", "rgba(0,128,255,0.5)");
                }
            }
        }

        drawScaledGlyph(context, codePoint, xOffset, yOffset, scale) {
            context.save();
            context.translate(xOffset, yOffset);
            context.scale(scale, scale);
            context.strokeStyle = "rgba(255,0,255,0.5)";
            context.beginPath();
            context.rect(0, 0, this.fontGrid.glyphWidth, this.fontGrid.glyphHeight);
            context.stroke();

            let glyph = this.font.glyphForCodepoint(codePoint);
            if (glyph) {
                let paths = glyph.getSplines();
                for (const path of paths) {
                    let points = path.build(this.tesselation);
                    if (path.isClosed()) {
                        this.fillPath(context, path, points, "rgba(0, 0, 0, 0.5)");
                    } else {
                        this.drawLines(context, points, "rgba(0, 0, 0, 0.8)");
                    }
                }
            }
            context.restore();
        }

        drawGlyphRow(context, startCodePoint, endCodePoint, xOffset, yOffset) {
            const xSpacing = this.fontGrid.glyphWidth * this.fontGrid.glyphScale + this.fontGrid.xSpacing;
            for (let codePoint = startCodePoint; codePoint <= endCodePoint; ++codePoint) {
                this.drawScaledGlyph(context, codePoint, xOffset, yOffset, this.fontGrid.glyphScale);
                xOffset += xSpacing;
            }
        }

        drawFont(context, width, height) {
            let yOffset = this.fontGrid.yStartOffset,
                ySpacing = this.fontGrid.glyphHeight * this.fontGrid.glyphScale + this.fontGrid.ySpacing;

            this.drawGlyphRow(context, this.fontGrid.lowerStart, this.fontGrid.lowerEnd, this.fontGrid.xStartOffset, yOffset);
            yOffset += ySpacing;
            this.drawGlyphRow(context, this.fontGrid.upperStart, this.fontGrid.upperEnd, this.fontGrid.xStartOffset, yOffset);
            yOffset += ySpacing;
            this.drawGlyphRow(context, this.fontGrid.digitStart, this.fontGrid.digitEnd, this.fontGrid.xStartOffset, yOffset);
        }
        
        draw(context, width, height) {
            context.clearRect(0, 0, width, height);

            this.drawEditGlyph(context, width, height);
            this.drawFont(context, width, height);
        }

        checkpoint() {
            this.fontEditArea.value = this.font.asJSONString();
        }

        loadCheckpoint() {
            this.font.loadFromJSON(this.fontEditArea.value);
        }
    }

    return {
        Editor: Editor
    };
}());