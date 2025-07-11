var GLYPHERY = (function () {
    "use strict";

    function SnapLine(origin, axis) {
        this.origin = origin;
        this.axis = axis.normalized();
        this.style = "rgba(0,0,0.2,.5)";
        this.dash = [10, 2, 5, 2];
    }

    SnapLine.prototype.draw = function (context, width, height) {
        context.save();
        context.strokeStyle = this.style;
        context.setLineDash(this.dash);
        context.beginPath();
        context.moveTo(this.origin.x, this.origin.y);
        context.lineTo(this.origin.x + width * this.axis.x, this.origin.y + height * this.axis.y);
        context.stroke();
        context.restore();
    };

    SnapLine.prototype.snap = function (point, snapDistance) {
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
            var offset = R2.subVectors(point, this.origin),
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

    SnapLine.prototype.drawSnap = function (context, point, snapDistance, drawDistance) {
        var drawSnapped = this.snap(point, drawDistance),
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

    function Editor() {
        this.maximize = false;
        this.updateInDraw = true;
        this.editArea = document.getElementById("points");
        this.editing = false;
        this.editPoint = null;
        this.Space = R2;
        this.snaps = [
            new SnapLine(new R2.V(0, 0), new R2.V(1, 1)),
            new SnapLine(new R2.V(0, 20), new R2.V(1, 0)),
            new SnapLine(new R2.V(0, 100), new R2.V(1, 0)),
            new SnapLine(new R2.V(0, 180), new R2.V(1, 0)),
            new SnapLine(new R2.V(20, 0), new R2.V(0, 1))
        ];
        this.snapDistance = 4;

        this.batch = new BLIT.Batch("images/");
        this.vertexImage = this.batch.load("vertex.png");
        this.vertexShadow = this.batch.load("vertexShadow.png");
        this.batch.commit();

        this.font = new GLYPH.Font();

        var segment = new SPLINE.BezierCurve(),
            path = new SPLINE.Path();

        path.addSegment(segment);
        segment.addPoint(new this.Space.V(10,  10));
        segment.addPoint(new this.Space.V(100, 200));
        segment.addPoint(new this.Space.V(200, 100));
        segment.addPoint(new this.Space.V(200, 200));

        this.editCodePoint = "A".codePointAt(0);
        this.font.newGlyph(this.editCodePoint, [path]);

        var editor = this;
        document.getElementById("buttonSave").addEventListener("click", function() {
            editor.checkpoint();
        }, false);
        document.getElementById("buttonLoad").addEventListener("click", function() {
            editor.loadCheckpoint();
        }, false);
    }

    Editor.prototype.snap = function (point, snapDistance) {
        var snapped = point;
        for (var s = 0; s < this.snaps.length; ++s) {
            snapped = this.snaps[s].snap(snapped, snapDistance);
        }
        return snapped;
    }

    Editor.prototype.update = function (now, elapsed, keyboard, pointer) {
        let editGlyph = this.font.glyphForCodepoint(this.editCodePoint),
            paths = editGlyph.getSplines();
        if (pointer.activated()) {
            var stab = new this.Space.V(pointer.location().x, pointer.location().y);
            for (var i = 0; i < paths.length; ++i) {
                var path = paths[i];
                for (var s = 0; s < path.segments.length; ++s) {
                    var points = path.segments[s].points;
                    for (var p = 0; p < points.length; ++p) {
                        if (this.Space.pointDistance(points[p], stab) < 10) {
                            this.editPoint = points[p];
                        }
                    }
                }
            }
        }

        if (this.editPoint) {
            if (pointer.primary) {
                var stab = new this.Space.V(pointer.location().x, pointer.location().y);
                if (keyboard.isCtrlDown()) {
                    stab = this.snap(stab, this.snapDistance);
                }
                this.editPoint.copy(stab);
            } else {
                this.editPoint = null;
            }
        }
    };

    Editor.prototype.drawPath = function (context, path, lineStyle, handleStyle, hullStyle) {
        this.drawLines(context, path.build(100), lineStyle);
        var prevWasHandle = false;
        var prevPoint = null;
        for (var s = 0; s < path.segments.length; ++s) {
            var points = path.segments[s].points;
            for (var p = 0; p < points.length; ++p) {
                var isHandle = (p === 0 && s === 0) || (p === (points.length - 1) && (s < path.segments.length - 1 || !path.isClosed()));
                this.drawVertex(context, points[p], isHandle ? [0,1,0] : [1,0,0]);
                if (p > 0 || s > 0) {
                    this.drawLine(context, prevPoint, points[p], isHandle || prevWasHandle ? handleStyle : hullStyle);
                }
                if (points[p] == this.editPoint) {
                    for (var snap = 0; snap < this.snaps.length; ++snap) {
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
    };
    
    Editor.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);

        for (var snap = 0; snap < this.snaps.length; ++snap) {
            this.snaps[snap].draw(context, width, height);
        }

        let editGlyph = this.font.glyphForCodepoint(this.editCodePoint),
            paths = editGlyph.getSplines();
        for (let p = 0; p < paths.length; ++p) {
            this.drawPath(context, paths[p], "black", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.1)");
        }
    };

    Editor.prototype.drawVertex = function (context, location, tint) { 
        if (this.batch.loaded) {
            BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
            BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
        }
    };
    
    Editor.prototype.drawLine = function (context, start, end, style) {
        this.drawLines(context, [start, end], style);
    };

    Editor.prototype.drawLines = function (context, points, style) {
        context.save();
        context.strokeStyle = style || "rgba(0,0,0,.5)";
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (var p = 1; p < points.length; ++p) {
            context.lineTo(points[p].x, points[p].y);
        }
        context.stroke();
        context.restore();
    };

    Editor.prototype.checkpoint = function () {
        this.editArea.value = this.font.asJSONString();
    };

    Editor.prototype.loadCheckpoint = function () {
        this.font.loadFromJSON(this.editArea.value);
    };

    return {
        Editor: Editor
    };
}());