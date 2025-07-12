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
            this.tesselation = 20;

            this.batch = new BLIT.Batch("images/");
            this.vertexImage = this.batch.load("vertex.png");
            this.vertexShadow = this.batch.load("vertexShadow.png");
            this.batch.commit();

            this.font = new GLYPH.Font();

            let path = new SPLINE.Path(true),
                segment = new SPLINE.BezierCurve();

            path.addSegment(segment);
            segment.addPoint(new R2.V(20,  20));
            segment.addPoint(new R2.V(50,  20));
            segment.addPoint(new R2.V(90,  20));
            segment.addPoint(new R2.V(120, 20));

            segment = new SPLINE.BezierCurve();
            path.addSegment(segment);
            segment.addPoint(new R2.V(120, 60));
            segment.addPoint(new R2.V(120, 140));
            segment.addPoint(new R2.V(120, 180));

            segment = new SPLINE.BezierCurve();
            path.addSegment(segment);
            segment.addPoint(new R2.V(90, 180));
            segment.addPoint(new R2.V(50, 180));
            segment.addPoint(new R2.V(20, 180));

            segment = new SPLINE.BezierCurve();
            path.addSegment(segment);
            segment.addPoint(new R2.V(20, 140));
            segment.addPoint(new R2.V(20, 60));

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

        update(now, elapsed, keyboard, pointer) {
            let editGlyph = this.font.glyphForCodepoint(this.editCodePoint),
                paths = editGlyph.getSplines();
            if (pointer.activated()) {
                let stab = new R2.V(pointer.location().x, pointer.location().y);
                for (let i = 0; i < paths.length; ++i) {
                    let path = paths[i];
                    for (let s = 0; s < path.segments.length; ++s) {
                        let points = path.segments[s].points;
                        for (let p = 0; p < points.length; ++p) {
                            if (R2.pointDistance(points[p], stab) < 10) {
                                this.editPoint = points[p];
                            }
                        }
                    }
                }
            }

            if (keyboard.isKeyDown(POKI.KEYS.GT)) {
            }

            if (this.editPoint) {
                if (pointer.primary) {
                    let stab = new R2.V(pointer.location().x, pointer.location().y);
                    if (keyboard.isCtrlDown()) {
                        stab = this.snap(stab, this.snapDistance);
                    }
                    this.editPoint.copy(stab);
                } else {
                    this.editPoint = null;
                }
            }
        }

        drawPath(context, path, lineStyle, handleStyle, hullStyle) {
            if (!path.isClosed()) {
                this.drawLines(context, path.build(this.tesselation), lineStyle);
            }
            let prevWasHandle = false;
            let prevPoint = null;
            for (let s = 0; s < path.segments.length; ++s) {
                let points = path.segments[s].points;
                for (let p = 0; p < points.length; ++p) {
                    let isHandle = (p === 0 && s === 0) || (p === (points.length - 1) && (s < path.segments.length - 1 || !path.isClosed()));
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
                this.drawLine(context, prevPoint, path.segments[0].start(), handleStyle);
            }
        }

        fillPath(context, path, fillStyle) {
            if (!path.isClosed()) {
                return;
            }
            context.save();
            context.fillSyle = fillStyle;
            context.beginPath();

            let points = path.build(this.tesselation);

            context.moveTo(points[0].x, points[0].y);
            for (let p = 1; p < points.length; ++p) {
                context.lineTo(points[p].x, points[p].y);
            }

            context.fill();
            context.restore();
        }
        
        draw(context, width, height) {
            context.clearRect(0, 0, width, height);

            for (let snap = 0; snap < this.snaps.length; ++snap) {
                this.snaps[snap].draw(context, width, height);
            }

            let editGlyph = this.font.glyphForCodepoint(this.editCodePoint),
                paths = editGlyph.getSplines();
            for (let p = 0; p < paths.length; ++p) {
                this.fillPath(context, paths[p], "rgba(0,0,0,0.1)");
                this.drawPath(context, paths[p], "black", "rgba(0,0,255,0.5)", "rgba(0,128,255,0.5)");
            }
        }

        drawVertex(context, location, tint) { 
            if (this.batch.loaded) {
                BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
                BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
            }
        }
        
        drawLine(context, start, end, style) {
            this.drawLines(context, [start, end], style);
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