manhattanRouters = (function () {

    'use strict';

    var config = {

        // size of the step to find a route
        step: 12,


        // if number of route finding loops exceed the maximum, stops searching and returns
        // fallback route
        maximumLoops: 2000,

        // possible starting directions from an element
        startDirections: ['left', 'right', 'top', 'bottom'],

        // possible ending directions to an element
        endDirections: ['left', 'right', 'top', 'bottom'],

        // specify directions above
        directionMap: {
            right: {x: 1, y: 0},
            bottom: {x: 0, y: 1},
            left: {x: -1, y: 0},
            top: {x: 0, y: -1}
        },

        // maximum change of the direction
        maxAllowedDirectionChange: 90,

        // padding applied on the element bounding boxes
        paddingBox: function () {

            var step = this.step;

            return {
                x: -step,
                y: -step,
                width: 2 * step,
                height: 2 * step
            };
        },

        // an array of directions to find next points on the route
        directions: function () {
            var step = this.step;
            return [
                {offsetX: step, offsetY: 0, cost: step},
                {offsetX: 0, offsetY: step, cost: step},
                {offsetX: -step, offsetY: 0, cost: step},
                {offsetX: 0, offsetY: -step, cost: step}
            ];
        },

        // a penalty received for direction change
        penalties: function () {
            return {
                0: 0,
                45: this.step / 2,
                90: this.step / 2
                , 180: 0  //to fix bug
            };
        },
        // if a function is provided, it's used to route the link while dragging an end
        // i.e. function(from, to, opts) { return []; }
        draggingRoute: null
    };

    // Map of obstacles
    // Helper structure to identify whether a point lies in an obstacle.
    function ObstacleMap(opt) {

        this.map = {};
        this.options = opt;
        // tells how to divide the paper when creating the elements map
        this.mapGridSize = 100;
    }

    ObstacleMap.prototype.build = function (graph, source, target) {

        var opt = this.options;
        var excludedEnds = [source, target];
        var excludedAncestors = _.union(_.map(excludedEnds, 'id'), _.map(graph.getAncestors(source), 'id'), _.map(graph.getAncestors(target), 'id'));

        // builds a map of all elements for quicker obstacle queries
        // The svg is divided to  cells, where each of them holds an information which
        // elements belong to it. When we query whether a point is in an obstacle we don't need
        // to go through all obstacles, we check only those in a particular cell.
        var mapGridSize = this.mapGridSize;
        _.chain(graph.getModel().cells)
            .filter(function (cell) {
                return cell.isVertex()
            })
            .reject(function (cell) {
                return _.contains(excludedAncestors, cell.id);
            })
            .map(function (cell) {
                return graph.getCellBounds(cell)
            })
            // expand their boxes by specific padding
            .each(function (bbox) {
                bbox.moveAndExpand(opt.paddingBox)
            })
            // build the map
            .reduce(function (map, bbox) {

                var origin = bbox.origin().snapToGrid(mapGridSize);
                var corner = bbox.corner().snapToGrid(mapGridSize);

                for (var x = origin.x; x <= corner.x; x += mapGridSize) {
                    for (var y = origin.y; y <= corner.y; y += mapGridSize) {

                        var gridKey = x + '@' + y;

                        map[gridKey] = map[gridKey] || [];
                        map[gridKey].push(bbox);
                    }
                }

                return map;

            }, this.map).value();

        return this;
    };

    ObstacleMap.prototype.isPointAccessible = function (point) {
        var mapKey = point.clone().snapToGrid(this.mapGridSize).toString();

        return _.every(this.map[mapKey], function (obstacle) {
            return !obstacle.containsPoint(point);
        });
    };


    // {
    //     key: {
    //         value: value,
    //         status: open;
    //     }
    // }
    function SortedSet() {
        this.items = [];
        this.hash = {};
        this.OPEN = 1;
        this.CLOSE = 2;
    }

    SortedSet.prototype.add = function (item, value) {

        if (this.hash[item]) {
            // remove and insert again based on value
            this.items.splice(this.items.indexOf(item), 1);
        } else {
            this.hash[item] = {
                status: this.OPEN
            }
        }

        this.hash[item].value = value;

        var index = _.sortedIndex(this.items, item, function (i) {
            return this.hash[i].value;
        }, this);

        this.items.splice(index, 0, item);
    };

    SortedSet.prototype.remove = function (item) {
        this.hash[item].status = this.CLOSE;
    };

    SortedSet.prototype.isOpen = function (item) {
        return this.hash[item] && (this.hash[item].status === this.OPEN);
    };

    SortedSet.prototype.isClose = function (item) {
        return this.hash[item] && (this.hash[item].status === this.CLOSE);
    };

    SortedSet.prototype.isEmpty = function () {
        return this.items.length === 0;
    };

    SortedSet.prototype.pop = function () {
        var item = this.items.shift();
        this.remove(item);
        return item;
    };


    function normalizePoint(point) {
        return new mxPoint(
            point.x === 0 ? 0 : Math.abs(point.x) / point.x,
            point.y === 0 ? 0 : Math.abs(point.y) / point.y
        );
    }

    function reconstructRoute(parents, endPoint, startCenter, endCenter) {
        var route = [];
        var previousDirection = normalizePoint(endCenter.difference(endPoint));
        var current = endPoint;
        var parent;

        while ((parent = parents[current])) {

            var direction = normalizePoint(current.difference(parent));

            //add point in when direction change
            if (!direction.equals(previousDirection)) {
                route.unshift(current);
                previousDirection = direction;
            }

            current = parent;
        }

        var startDirection = normalizePoint(current.difference(startCenter));
        if (!startDirection.equals(previousDirection)) {
            route.unshift(current);
        }

        return route;
    }

    function getRectPoints(bbox, directionList, opt) {

        var step = opt.step;
        var center = bbox.center();
        var startPoints = _.chain(opt.directionMap).pick(directionList).map(function (direction) {

            var x = direction.x * bbox.width / 2;
            var y = direction.y * bbox.height / 2;

            var point = center.clone().offset(x, y);

            if (bbox.containsPoint(point)) {

                point.offset(direction.x * step, direction.y * step);
            }

            return point.snapToGrid(step);

        }).value();

        return startPoints;
    }

    function normalizeAngle(angle) {
        return (angle % 360) + (angle < 0 ? 360 : 0);
    };

    function getDirectionAngle(start, end, directionLength) {

        var q = 360 / directionLength;
        return Math.floor(normalizeAngle(start.theta(end) + q / 2) / q) * q;
    }


    function getDirectionChange(angle1, angle2) {

        var dirChange = Math.abs(angle1 - angle2);
        return dirChange > 180 ? 360 - dirChange : dirChange;
    }

    function estimateCost(from, endPoints) {
        var min = Infinity;

        for (var i = 0, len = endPoints.length; i < len; i++) {
            var cost = from.manhattanDistance(endPoints[i]);
            if (cost < min) min = cost;
        }

        return min;
    }

    function toMxPointFromString(pointString) {
        var xy = pointString.split(pointString.indexOf('@') === -1 ? ' ' : '@');
        return new mxPoint(parseInt(xy[0], 10), parseInt(xy[1], 10))
    }

    function findRoute(start, end, obstacleMap, opt) {

        //caculate start points and end points
        var step = opt.step;
        var startPoints = _.filter(getRectPoints(start, opt.startDirections, opt), obstacleMap.isPointAccessible, obstacleMap);
        var startCenter = start.center().snapToGrid(step);
        var endPoints = _.filter(getRectPoints(end, opt.endDirections, opt), obstacleMap.isPointAccessible, obstacleMap);
        var endCenter = end.center().snapToGrid(step);

        if (startPoints.length > 0 && endPoints.length > 0) {

            // The set of possible  points to be evaluated, initially containing the start points.
            var openSet = new SortedSet();
            // Keeps predecessor of given element.
            var parents = {};
            // Cost from start to a point along best known path.
            var costs = {};

            _.each(startPoints, function (point) {
                var key = point.toString();
                openSet.add(key, estimateCost(point, endPoints));
                costs[key] = 0;
            });
            var loopsRemain = opt.maximumLoops;
            var endPointsKeys = _.invoke(endPoints, 'toString');

            // main route finding loop
            while (!openSet.isEmpty() && loopsRemain > 0) {

                var currentKey = openSet.pop();
                var currentPoint = toMxPointFromString(currentKey);
                var currentCost = costs[currentKey];
                var previousDirectionAngle = currentDirectionAngle;
                var currentDirectionAngle = parents[currentKey]
                    ? getDirectionAngle(parents[currentKey], currentPoint, opt.directions.length)
                    : opt.previousDirAngle != null ? opt.previousDirAngle : getDirectionAngle(startCenter, currentPoint, opt.directions.length);

                // if get the endpoint
                if (endPointsKeys.indexOf(currentKey) >= 0) {
                    // stop route to enter the end point in opposite direction.
                    directionChangedAngle = getDirectionChange(currentDirectionAngle, getDirectionAngle(currentPoint, endCenter, opt.directions.length));
                    if (currentPoint.equals(endCenter) || directionChangedAngle < 180) {
                        opt.previousDirAngle = currentDirectionAngle;
                        return reconstructRoute(parents, currentPoint, startCenter, endCenter);
                    }
                }

                // Go over all possible directions and find neighbors.
                for (var i = 0; i < opt.directions.length; i++) {

                    var directionChangedAngle;
                    var direction = opt.directions[i];
                    directionChangedAngle = getDirectionChange(currentDirectionAngle, direction.angle);
                    if (previousDirectionAngle && directionChangedAngle > opt.maxAllowedDirectionChange) {
                        continue;
                    }

                    var neighborPoint = currentPoint.clone().offset(direction.offsetX, direction.offsetY);
                    var neighborKey = neighborPoint.toString();
                    if (openSet.isClose(neighborKey) || !obstacleMap.isPointAccessible(neighborPoint)) {
                        continue;
                    }

                    var costFromStart = currentCost + direction.cost + opt.penalties[directionChangedAngle];

                    if (!openSet.isOpen(neighborKey) || costFromStart < costs[neighborKey]) {
                        // neighbor point has not been processed yet or the cost of the path
                        // from start is lesser than previously calcluated.
                        parents[neighborKey] = currentPoint;
                        costs[neighborKey] = costFromStart;
                        openSet.add(neighborKey, costFromStart + estimateCost(neighborPoint, endPoints));
                    }
                }

                loopsRemain--;
            }
        }
        return null;
    }

    function resolveOptions(opt) {

        opt.directions = _.result(opt, 'directions');
        opt.penalties = _.result(opt, 'penalties');
        opt.paddingBox = _.result(opt, 'paddingBox');

        _.each(opt.directions, function (direction) {

            var point1 = new mxPoint(0, 0);
            var point2 = new mxPoint(direction.offsetX, direction.offsetY);

            direction.angle = normalizeAngle(point1.theta(point2));
        });
    }

    function router(state, source, target, points, result, opt) {
        //when drag connection point after connecting
        if ((points != null && points.length > 0) || source == null || target == null) {
            mxEdgeStyle.SegmentConnector(state, source, target, points, result);
            return;
        }

        resolveOptions(opt);
        var graph = state.view.graph;

        var sourceBBox = graph.getCellBounds(source.cell).clone().moveAndExpand(opt.paddingBox);
        var targetBBox = graph.getCellBounds(target.cell).clone().moveAndExpand(opt.paddingBox);
        var obstacleMap = (new ObstacleMap(opt)).build(graph, source.cell, target.cell);
        var routes = findRoute(sourceBBox, targetBBox, obstacleMap, opt);
        if (routes == null) {
            //fallback to OrthConnector
            return mxEdgeStyle.OrthConnector(state, source, target, points, result);
        }
        Array.prototype.push.apply(result, routes);
    }

    return function (state, source, target, points, result, opt) {

        return router(state, source, target, points, result, _.extend({}, config, opt));
    };

})();


mxEdgeStyle.ManhattanConnector = function (state, source, target, points, result) {
    var points = manhattanRouters(state, source, target, points, result, {});
};

