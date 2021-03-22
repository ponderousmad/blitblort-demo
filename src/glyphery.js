var GLYPHERY = (function () {
    "use strict";

    function SnapLine(origin, axis) {
        this.origin = origin;
        this.axis = axis;
        this.style = "rgba(0,0,0.2,.5)";
        this.dash = [10, 2, 5, 2];
    }

    SnapLine.prototype.draw = function(context, width, height) {
        context.save();
        context.strokeStyle = this.style;
        context.setLineDash(this.dash);
        context.beginPath();
        context.moveTo(this.origin.x, this.origin.y);
        context.lineTo(this.origin.x + width * this.axis.x, this.origin.y + height * this.axis.y);
        context.stroke();
        context.restore();
    };

    function Editor() {
        this.maximize = false;
        this.updateInDraw = true;
        this.editArea = document.getElementById("points");
        this.editing = false;
        this.editPoint = null;
        this.Space = R2;
        this.snaps = [
            new SnapLine(new R2.V(0, 20), new R2.V(1, 0)),
            new SnapLine(new R2.V(0, 100), new R2.V(1, 0)),
            new SnapLine(new R2.V(0, 180), new R2.V(1, 0)),
            new SnapLine(new R2.V(20, 0), new R2.V(0, 1))
        ];

        this.batch = new BLIT.Batch("images/");
        this.vertexImage = this.batch.load("vertex.png");
        this.vertexShadow = this.batch.load("vertexShadow.png");
        this.batch.commit();

        this.splines = [];

        var segment = new SPLINE.BezierCurve(),
            spline = new SPLINE.Spline();

        spline.addSegment(segment);
        segment.addPoint(new this.Space.V(10,  10));
        segment.addPoint(new this.Space.V(100, 200));
        segment.addPoint(new this.Space.V(200, 100));
        segment.addPoint(new this.Space.V(200, 200));

        this.splines.push(spline);
    }

    Editor.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (keyboard.wasAsciiPressed("C", IO.UNMODIFIED)) {
            this.checkpoint();
        }

        if (keyboard.wasAsciiPressed("L", IO.UNMODIFIED)) {
            this.loadCheckpoint();
        }

        if (keyboard.wasAsciiPressed("E", IO.SHIFT)) {
            this.checkpoint();
            this.editing = !this.editing;
            this.editArea.className = this.editing ? "" : "hidden";
        }

        if (pointer.activated()) {
            var stab = new this.Space.V(pointer.location().x, pointer.location().y);
            for (var s = 0; s < this.splines.length; ++s) {
                var spline = this.splines[s];
                for (var t = 0; t < spline.segments.length; ++t) {
                    var points = spline.segments[t].points;
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
                this.editPoint.x = pointer.location().x;
                this.editPoint.y = pointer.location().y;
            } else {
                this.editPoint = null;
            }
        }
    };
    
    Editor.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);

        var center = new this.Space.V(width * 0.5, height * 0.5),
            handleLineStyle = "rgba(0,0,0,0.5)",
            hullLineStyle = "rgba(0,0,0,0.1)",
            lineStyle = "black";

        for (var snap = 0; snap < this.snaps.length; ++snap) {
            this.snaps[snap].draw(context, width, height);
        }

        for (var s = 0; s < this.splines.length; ++s) {
            var spline = this.splines[s];
            this.drawLines(context, spline.build(100), "black");
            var prevWasHandle = false;
            var prevPoint = null;
            for (var t = 0; t < spline.segments.length; ++t) {
                var points = spline.segments[t].points;
                for (var p = 0; p < points.length; ++p) {
                    var isHandle = (p === 0 && t === 0) || (p === (points.length - 1) && (t < spline.segments.length - 1 || !spline.isClosed()));
                    this.drawVertex(context, points[p], isHandle ? [0,1,0] : [1,0,0]);
                    if (p > 0 || t > 0) {
                        this.drawLine(context, prevPoint, points[p], isHandle || prevWasHandle ? handleLineStyle : hullLineStyle);
                    }
                    prevWasHandle = isHandle;
                    prevPoint = points[p];
                }
            }
            if (spline.isClosed()) {
                this.drawLine(context, prevPoint, spline.segments[0].start(), handleLineStyle);
            }
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

    Editor.prototype.save = function () {
        var data = {
            splines: this.splines
        };
        return JSON.stringify(data, null, 4);
    };

    Editor.prototype.load = function (data) {
        var splines = data.splines;
        this.splines = [];
        for (var s = 0; s < splines.length; ++s) {
            var spline = new SPLINE.Spline(splines[s].closed),
                segments = splines[s].segments;
            this.splines.push(spline);
            for (var t = 0; t < segments.length; ++t) {
                var segment = new SPLINE.BezierCurve(),
                    points = segments[t].points;
                spline.addSegment(segment);
                for (var i = 0; i < points.length; ++i) {
                    var p = points[i];
                    segment.addPoint(new this.Space.V(p.x, p.y, p.z, p.w));
                }
            }
        }
    };

    Editor.prototype.checkpoint = function () {
        this.editArea.value = this.save();
    };

    Editor.prototype.loadCheckpoint = function () {
        var data = JSON.parse(this.editArea.value);
        this.load(data);
    };

    return {
        Editor: Editor
    };
}());