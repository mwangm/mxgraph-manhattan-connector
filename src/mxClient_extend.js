mxGraph.prototype.getAncestors = function () {
    var result = [];
    var vertex = this;
    while (vertex.parent != null) {
        result.push(vertex.parent);
        vertex = vertex.parent;
    }
    return result;
};

mxRectangle.prototype.moveAndExpand = function (r) {

    this.x += r.x || 0;
    this.y += r.y || 0;
    this.width += r.width || 0;
    this.height += r.height || 0;
    return this;
};

mxRectangle.prototype.origin = function () {

    return new mxPoint(this.x, this.y);
};

mxRectangle.prototype.corner = function () {
    return new mxPoint(this.x + this.width, this.y + this.height);
};

mxRectangle.prototype.center = function () {
    return new mxPoint(this.x + this.width / 2, this.y + this.height / 2);
};

mxRectangle.prototype.containsPoint = function (point) {

    return point.x >= this.x && point.x <= this.x + this.width && point.y >= this.y && point.y <= this.y + this.height;
};

mxPoint.prototype.snapToGrid = function (gx, gy) {
    this.x = snapToGrid(this.x, gx);
    this.y = snapToGrid(this.y, gy || gx);
    return this;
};

mxPoint.prototype.offset = function (offsetX, offsetY) {
    this.x += offsetX || 0;
    this.y += offsetY || 0;
    return this;
};

mxPoint.prototype.manhattanDistance = function (p) {

    return Math.abs(p.x - this.x) + Math.abs(p.y - this.y);
};

mxPoint.prototype.difference = function (p) {

    return new mxPoint(this.x - p.x, this.y - p.y);
};

mxPoint.prototype.theta = function (p) {

    p = p.clone();
    var y = -(p.y - this.y);
    var x = p.x - this.x;
    var PRECISION = 10;
    var rad = (y.toFixed(PRECISION) == 0 && x.toFixed(PRECISION) == 0) ? 0 : Math.atan2(y, x);
    return 180 * rad / Math.PI;
};

mxPoint.prototype.toString = function () {

    return this.x + '@' + this.y;
};

var snapToGrid = snapToGrid = function (value, gridSize) {
    return gridSize * Math.round(value / gridSize);
};
