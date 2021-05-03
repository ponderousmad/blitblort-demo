var EXAMPLES = (function () {
    "use strict";

    function Test2D() {
        this.batch = new BLIT.Batch("images/");
        this.image = this.batch.load("test.png");
        this.flip = new BLIT.Flip(this.batch, "test", 6, 2).setupPlayback(80, true);
        this.batch.commit();

        this.maximize = false;
        this.updateInDraw = true;
    }

    Test2D.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.batch.loaded) {
            this.flip.update(elapsed);
        }
    };

    Test2D.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);
        if (this.batch.loaded) {
            BLIT.draw(context, this.image, 100, 100, BLIT.ALIGN.Center, 0, 0, BLIT.MIRROR.Horizontal, [1,0,0]);
            this.flip.draw(context, 200, 50, BLIT.ALIGN.Left, 0, 0, BLIT.MIRROR.Vertical);
        }
    };

    function Test3D(viewport) {
        this.clearColor = [0, 0, 0, 1];
        this.maximize = viewport === "safe";
        this.updateInDraw = false;
        this.updateInterval = 16;
        this.angle = 0;
        this.viewport = viewport ? viewport : "canvas";
        this.program = null;
        this.batch = null;
        this.thing = null;
    }

    Test3D.prototype.setupRoom = function (room) {
        this.program = room.programFromElements("vertex-test", "fragment-test", true, true, true);
        this.batch = new BLIT.Batch("images/");

        var mesh = WGL.makePlane(WGL.uvFill());
        mesh.image = this.batch.load("uv.png");
        this.batch.commit();
        this.thing = new BLOB.Thing(mesh);
    };

    Test3D.prototype.update = function (now, elapsed, keyboard, pointer) {
        if (this.thing) {
            this.thing.rotate(elapsed * Math.PI * 0.0001, new R3.V(0, 1, 0));
        }
    };

    Test3D.prototype.render = function (room, width, height) {
        room.clear(this.clearColor);
        if (!this.batch.loaded) {
            return;
        }
        room.viewer.positionView(new R3.V(2, 0, 0), R3.origin(), new R3.V(0, 1, 0));
        room.setupView(this.program, this.viewport);
        this.thing.render(room, this.program);
    };

    function SplineExample(space) {
        this.maximize = false;
        this.updateInDraw = true;
        this.editArea = document.getElementById("points");
        this.editing = false;
        this.editPoint = null;
        this.Space = space;

        this.batch = new BLIT.Batch("images/");
        this.vertexImage = this.batch.load("vertex.png");
        this.vertexShadow = this.batch.load("vertexShadow.png");
        this.batch.commit();

        this.paths = [];

        var segment = new SPLINE.BezierCurve(),
            path = new SPLINE.Path();

        path.addSegment(segment);
        segment.addPoint(new this.Space.V(10,  10));
        segment.addPoint(new this.Space.V(100, 200));
        segment.addPoint(new this.Space.V(200, 100));
        segment.addPoint(new this.Space.V(200, 200));

        this.paths.push(path);
    }

    SplineExample.prototype.update = function (now, elapsed, keyboard, pointer) {
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
            for (var s = 0; s < this.paths.length; ++s) {
                var spline = this.paths[s];
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
    
    SplineExample.prototype.draw = function (context, width, height) {
        context.clearRect(0, 0, width, height);

        var center = new this.Space.V(width * 0.5, height * 0.5),
            handleLineStyle = "rgba(0,0,0,0.5)",
            hullLineStyle = "rgba(0,0,0,0.1)",
            lineStyle = "black";

        for (var s = 0; s < this.paths.length; ++s) {
            var spline = this.paths[s];
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

    SplineExample.prototype.drawVertex = function (context, location, tint) { 
        if (this.batch.loaded) {
            BLIT.draw(context, this.vertexImage, location.x, location.y, BLIT.ALIGN.Center, null, null, BLIT.MIRROR.None, tint);
            BLIT.draw(context, this.vertexShadow, location.x, location.y, BLIT.ALIGN.Center);
        }
    };
    
    SplineExample.prototype.drawLine = function (context, start, end, style) {
        this.drawLines(context, [start, end], style);
    };

    SplineExample.prototype.drawLines = function (context, points, style) {
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

    SplineExample.prototype.save = function () {
        var data = {
            paths: this.paths
        };
        return JSON.stringify(data, null, 4);
    };

    SplineExample.prototype.load = function (data) {
        var paths = data.paths;
        this.paths = [];
        for (var i = 0; i < paths.length; ++i) {
            var path = new SPLINE.Path(paths[i].closed),
                segments = paths[i].segments;
            this.paths.push(path);
            for (var s = 0; s < segments.length; ++s) {
                var segment = new SPLINE.BezierCurve(),
                    points = segments[s].points;
                path.addSegment(segment);
                for (var j = 0; j < points.length; ++j) {
                    var p = points[j];
                    segment.addPoint(new this.Space.V(p.x, p.y, p.z, p.w));
                }
            }
        }
    };

    SplineExample.prototype.checkpoint = function () {
        this.editArea.value = this.save();
    };

    SplineExample.prototype.loadCheckpoint = function () {
        var data = JSON.parse(this.editArea.value);
        this.load(data);
    };

    return {
        Test2D: Test2D,
        Test3D: Test3D,
        SplineExample: SplineExample
    };
}());