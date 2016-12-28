function main(container) {
    if (!mxClient.isBrowserSupported()) {
        mxUtils.error('Browser is not supported!', 200, false);
    } else {
        mxEvent.disableContextMenu(container);
        var graph = new mxGraph(container);
        new mxRubberband(graph);
        var parent = graph.getDefaultParent();

        graph.getModel().beginUpdate();
        try{
            var style = graph.getStylesheet().getDefaultEdgeStyle();
            style[mxConstants.STYLE_LABEL_BACKGROUNDCOLOR] = '#FFFFFF';
            style[mxConstants.STYLE_STROKEWIDTH] = '2';
            style[mxConstants.STYLE_ROUNDED] = true;
            style[mxConstants.STYLE_EDGE] = mxEdgeStyle.ManhattanConnector;

            var v1 = graph.insertVertex(parent, null, 'Hello,', 50, 50, 140, 70);
            var v2 = graph.insertVertex(parent, null, 'World!', 750, 450, 140, 70);
            var v3 = graph.insertVertex(parent, null, 'obstacle', 350, 150, 140, 80);
            var v4 = graph.insertVertex(parent, null, 'obstacle', 300 , 50, 140, 80);
            var e1 = graph.insertEdge(parent, null, 'depend', v1, v2);

        } finally {
            graph.getModel().endUpdate();
        }
    }
}

window.onload = function () {
    var container = document.getElementById('graphContainer');
    main(container);
};
