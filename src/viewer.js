import _ from 'underscore';
import $ from 'jquery';

import cytoscape from 'cytoscape';

import klay from 'cytoscape-klay';
import euler from 'cytoscape-euler';
import coseBilkent from 'cytoscape-cose-bilkent';
import cola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';

import autopanOnDrag from 'cytoscape-autopan-on-drag';

import {readFile} from './utils.js';

const iconPerType = {
    'threat-actor': {
        color: '#d32b49',
        shape: 'ellipse',
    },
    'tool': {
        color: '#6661ab',
        shape: 'star',
    },
    'vulnerability': {
        color: '#eaca6b',
        shape: 'diamond',
    },
    'malware': {
        color: '#6661ab',
        shape: 'ellipse',
    },
    'intrusion-set': {
        color: '#396eb6',
        shape: 'ellipse',
    },
    'indicator': {
        color: '#e38850',
        shape: 'pentagon',
    },
    'attack-pattern': {
        color: '#6661ab',
        shape: 'diamond',
    },
    'course-of-action': {
        color: '#7fbe82',
        shape: 'ellipse',
    },
    'campaign': {
        color: '#1d6775',
        shape: 'star',
    },
    'report': {
        color: '#2d2b5f',
        shape: 'ellipse',
    },
    'identity': {
        color: '#9c9d9d',
        shape: 'diamond',
    },
    'marking-definition': {
        color: '#72d1fb',
        shape: 'tag',
        image:false
    },
    'sighting': {
        color: '#383839',
        shape: 'ellipse',
    },
    'observed-data': {
        color: '#AB558C',
        shape: 'ellipse',
    },
    'relationship': {
        color: '#31A9C1',
        shape: 'ellipse',
    },
    // stix2.1
    'opinion': {
        color: '#881177',
        shape: 'ellipse',
    },
    // custom object
    'x-eclecticiq-hypothesis': {
        color: '#009688',
        shape: 'ellipse',
        image:require('!svg-inline-loader?removeSVGTagAttrs=false!../icons/x-eclecticiq-hypothesis.svg')
    },
    // idref placeholder node
    'idref': {
        color: '#ccc',
        shape: 'octagon',
        image:false
    }
}

const unknownIconTmpl = `
<svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
<g id="event-icon">
    <circle id="e" cx="100" cy="100" r="100" fill="#B99435"/>
    <text
        x="50%" y="150"
        text-anchor="middle"
        style="font: bold 150px sans-serif"
        fill="white" stroke="white">
        <%= letter %>
    </text>
</g>
</svg>`;


cytoscape.use(klay);
cytoscape.use(euler);
cytoscape.use(coseBilkent);
cytoscape.use(cola);
cytoscape.use(dagre);
autopanOnDrag(cytoscape);


const DEFAULT_LAYOUT = 'cola';
const NODE_WIDTH = 30;
const NODE_HEIGHT = 30;

const layoutProperties = {
    'euler': {
        pull: 0.006,
        mass: (node) => 10,
        animation: false,
        dragCoeff: 0.3,
    },
    'cose-bilkent': {
        animate: 'end',
        animationEasing: 'ease-out',
        animationDuration: 300,
        nodeRepulsion: 200,
        idealEdgeLength: NODE_WIDTH * 3,
        gravityRange: 50,
        gravity: 8.2,
        // nestingFactor: 10,
        padding: 50,
    },
    'cola': {
        convergenceThreshold: 100, // end layout sooner, may be a bit lower quality
        animate: false,
    },
};

const cache = {};


function encodeSvg(icon) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(icon);
}

for(let type in iconPerType) {
    if (iconPerType[type].image === false) {
        // console.log('skip')
    } else if (typeof iconPerType[type].image === 'string') {
        iconPerType[type].image = encodeSvg(iconPerType[type].image);
    } else {
        let svg = require('!svg-inline-loader?removeSVGTagAttrs=false!../svgs/'+type+'-noback-flat.svg');
        if (svg.indexOf('fill="') > 0) {
            let color = svg.substr(svg.indexOf('fill="') + 'fill="'.length, 7); // ex. parses color from fill="#000000"
            console.warn("FOUND COLOR : " + color + " vs. " + iconPerType[type].color);
            iconPerType[type].color = color;
        }
        iconPerType[type].image = encodeSvg(svg);
    }
}

// console.log(iconPerType)

const TLP_HEX_COLORS = {
    red: '#ff0000',
    amber: '#ff8c00',
    green: '#7cfc00',
    white: '#ccc',
    none: '#008080',
};


const DEFAULT_GRAPH_STYLE = [
    {
        selector: 'node',
        style: {
            'shape': 'data(shape)',
            'width': NODE_WIDTH,
            'height': NODE_HEIGHT,
            'background-color': 'data(color)',
            'background-width': '80%',
            'background-height': '80%',
            'background-position-x': '50%',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'label': '',
            'color': 'rgba(0, 0, 0, 0.5)',
            'font-size': '10pt',
            'text-max-width': '300px',
            'text-wrap': 'ellipsis',
        },
    },
    {
        selector: 'node[image]',
        style: {
            'background-image': 'data(image)',
        },
    },
    {
        selector: 'node[type="relationship"]',
        style: {
            'background-image': 'data(image)',
            'width': NODE_WIDTH / 2,
            'height': NODE_HEIGHT / 2,
            'font-size': '8pt',
        },
    },
    {
        selector: 'node[type="marking-definition"]',
        style: {
            'width': NODE_WIDTH / 2,
            'height': NODE_HEIGHT / 2,
            'font-size': '8pt',
        },
    },
    {
        selector: 'node[type="idref"]',
        style: {
            'width': NODE_WIDTH / 2,
            'height': NODE_HEIGHT / 2,
            'font-size': '8pt',
        },
    },
    {
        selector: 'edge',
        style: {
            'width': 1,
            'opacity': 0.5,
            'label': 'data(label)',
            // 'curve-style': 'haystack',
            // 'haystack-radius': 0,
            'curve-style': 'straight',
            'line-color': '#bbb',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'min-zoomed-font-size': '5pt',
        },
    },
    {
        selector: 'edge[label="x_eclecticiq_alternative_hypothesis_refs"]',
        style: {
            'curve-style': 'bezier',
            'control-point-step-size': 40,
            'line-color': '#ccc',
        },
    },
    {
        selector: '.bleak',
        style: {
            opacity: 0.1,
        },
    },
    {
        selector: 'edge.autorotate',
        style: {
            'font-size': '9pt',
            'color': '#222',
            'edge-text-rotation': 'autorotate',
        },
    },
    {
        selector: 'node:selected',
        style: {
            'background-color': 'black',
        },
    },
];


function makeNodeElement(obj) {
    let icon = iconPerType[obj.type];

    if (!icon) {
        icon = getUnknownIcon(obj.type);
    }

    if (obj.type === 'marking-definition') {
        icon.color = TLP_HEX_COLORS[obj.definition.tlp];
    }
    return {
        group: 'nodes',
        data: {
            id: obj.id,
            label: obj.name,
            _raw: obj,
            shape: 'ellipse',
            type: obj.type,
            ...icon,
        },
        selectable: true,
        grabbable: true,
        classes: [obj.type, 'icon-' + obj.type],
    };
}


function makeEdgeElement(obj) {
    return {
        group: 'edges',
        data: {
            id: obj.id,
            source: obj.source_ref,
            target: obj.target_ref,
            label: obj.relationship_type,
            arrow: 'triangle',
            _raw: obj,
        },
        classes: ['autorotate'],
    };
}


function makeIdrefNodeElement(ref, originalRef) {
    return makeNodeElement({
        id: ref,
        type: 'idref',
        name: 'IDREF ' + ref,
        original_relationship: originalRef,
    });
}


function makeEdgesForRefs(node) {
    const entity = node.data._raw;
    const edges = [];
    if (!entity) {
        return edges;
    }
    _.forEach(entity, function (val, field) {
        // treat all fields ending with _ref(s) as a reference fields
        if (!field.endsWith('_ref') && !field.endsWith('_refs')) {
            return;
        }
        const refs = (typeof val === 'string') ? [val] : val;
        _.forEach(refs, function(ref) {
            const edge = makeEdgeElement({
                id: 'rel-' + entity.id + '-' + ref,
                source_ref: entity.id,
                target_ref: ref,
                relationship_type: field,
            });
            edges.push(edge);
        });
    });
    return edges;
}


function makeRelationshipNode(existingEdge) {
    const newNode = makeNodeElement({
        id: existingEdge.data.id,
        name: existingEdge.data.name || existingEdge.data.id,
        type: 'relationship',
        _raw: existingEdge.data,
    });
    const newEdges = [
        makeEdgeElement({
            id: 'rel-' + existingEdge.data.source + '-' + newNode.data.id,
            source_ref: existingEdge.data.source,
            target_ref: newNode.data.id,
            relationship_type: existingEdge.data.label,
        }),
        makeEdgeElement({
            id: 'rel-' + newNode.data.id + '-' + existingEdge.data.targer,
            source_ref: newNode.data.id,
            target_ref: existingEdge.data.target,
            relationship_type: existingEdge.data.label,
        }),
    ];
    return {node: newNode, edges: newEdges};
}

function getUnknownIcon(nodeType) {
    const template = _.template(unknownIconTmpl);
    const letter = nodeType.charAt(0).toUpperCase();
    return {
        color: '#B99435',
        shape: 'ellipse',
        image: encodeSvg(template({
            nodeType: nodeType,
            letter: letter})),
    };
}


function showNodeDetails($sidebar, stixId, node) {
    const entity = node._raw;
    const tmpl = _.template(`
        <img class='sidebar-type-icon'
             src='<%= icon %>'>
        <%= obj.type %>
        <span class='sidebar-close-icon'>×</span>
        <h2 class='sidebar-title'><%- (obj.name || (
            obj.definition_type == 'tlp' ?
                (obj.definition_type + ': ' + obj.definition.tlp)
                : obj.definition_type)) %></h2>
        <p><%= obj.description %></p>
        <p><strong>Labels:</strong> <%- (obj.labels || []).join(', ') %></p>
        <p><strong>External references:</strong>
            <%= (obj.external_references || [])
                .map((x) => ((x.description ? x.description + ": ": "")
                             + (x.url || x.source_name || "")))
                .join('; ') %>
        </p>
        <p><strong>Created</strong>: <%= obj.created %></p>
        <p><strong>ID:</strong> <%= obj.id %></p>
        <p>
            <strong>JSON:</strong><br/>
            <textarea class='sidebar-textarea' readonly='yes'><%- JSON.stringify(obj, null, 4) %>
            </textarea>
        </p>
    `);
    $sidebar.html(tmpl({
        obj: entity,
        elId: stixId,
        icon: (iconPerType[entity.type] || getUnknownIcon(entity.type)).image}));
    $sidebar.find('.sidebar-close-icon').on('click', function() {
        $sidebar.css('display', 'none');
    });
    $sidebar.css('display', 'block');
}


function initSidebar(cy, stixId) {
    cy.nodes().on('click', function(e) {
        e.preventDefault();
        const clickedNode = e.target.data();
        showNodeDetails(cy.sidebar, stixId, clickedNode);
    });
}


function downloadData(data) {
    $('<a />', {
        'download': data['id'] + '.json',
        'href': 'data:application/json,' + encodeURIComponent(JSON.stringify(data, null, 4)),
    }).appendTo('body').click(function() {
        $(this).remove();
    })[0].click();
}

function downloadPng(data) {
    $('<a />', {
        'download': 'graph.png',
        'href': data,
    }).appendTo('body').click(function() {
        $(this).remove();
    })[0].click();
}


function initDownloadLinks(cy) {
    const $elem = $(cy.element).find('.download-json');
    $elem.off('click');
    $elem.on('click', function(e) {
        e.preventDefault();
        downloadData(cy.raw_data);
    });
    const $elem2 = $(cy.element).find('.download-png');
    $elem2.off('click');
    $elem2.on('click', function(e) {
        e.preventDefault();
        downloadPng(cy.png());
    });
}


function runLayout(cy, layoutName) {
    const layout = cy.layout({
        name: layoutName,
        ...layoutProperties[layoutName],
    });
    layout.run();
    setTimeout(function() {
        layout.stop();
    }, 300);
    cy.layoutName = layoutName;
}


function populateIdrefEdge(nodesMap, edgesMap, edge) {
    let source = nodesMap[edge.data.source];
    let target = nodesMap[edge.data.target];

    const newNodes = [];
    const edgesToDelete = [];
    let newEdges = [];

    if (!source) {
        // a relationship to a relationship
        if (edge.data.source.startsWith('relationship')) {
            const existingEdge = edgesMap[edge.data.source];
            if (existingEdge) {
                edgesToDelete.push(existingEdge);
                const {node, edges} = makeRelationshipNode(existingEdge);
                source = node;
                newEdges = newEdges.concat(edges);
            }
        }
        source = source || makeIdrefNodeElement(edge.data.source, edge.data._raw);
        newNodes.push(source);
    }
    if (!target) {
        // a relationship to a relationship
        if (edge.data.target.startsWith('relationship')) {
            const existingEdge = edgesMap[edge.data.target];
            if (existingEdge) {
                edgesToDelete.push(existingEdge);
                const {node, edges} = makeRelationshipNode(existingEdge);
                target = node;
                newEdges = newEdges.concat(edges);
            }
        }
        target = target || makeIdrefNodeElement(edge.data.target, edge.data._raw);
        newNodes.push(target);
    }
    return {
        newNodes: newNodes,
        newEdges: newEdges,
        edgesToDelete: edgesToDelete,
    };
};


function makeElements(bundle, showIdrefs, highlighted, hidden, showMarkings) {
    let nodes = [];
    const nodesMap = {};
    // create nodes for every non-relationship object in a bundle
    _.forEach(bundle.objects, function (obj) {
        if (obj.type === 'relationship') {
            return;
        }
        const node = makeNodeElement(obj);
        if ((highlighted.length > 0 && highlighted.indexOf(node.data.id) == -1)
            || (hidden.length > 0 && hidden.indexOf(node.data.id) > -1)) {
            // skip hidden node
            return;
        }
        if (!showMarkings && obj.type === 'marking-definition') {
            return;
        }
        nodes.push(node);
        nodesMap[node.data.id] = node;
    });

    let edges = [];
    const edgesMap = {};
    // create edges for every relationship object in a bundle
    _.forEach(bundle.objects, function (obj) {
        if (obj.type != 'relationship') {
            return;
        }
        const edge = makeEdgeElement(obj);
        if ((highlighted.length > 0
                && (highlighted.indexOf(edge.data.source) == -1
                    || highlighted.indexOf(edge.data.target) == -1))
            || (hidden.length > 0
                && (hidden.indexOf(edge.data.source) > -1
                    || highlighted.indexOf(edge.data.target) > -1))) {
            // skip relationship if one of nodes was hidden
            return;
        }
        edges.push(edge);
        edgesMap[edge.data.id] = edge;
    });

    // create nodes and edges for all references in fields
    nodes.forEach(function(node) {
        const refEdges = makeEdgesForRefs(node);
        edges = edges.concat(refEdges);
    });

    if (showIdrefs) {
        // create IDREF placeholder entities for hanging edges
        const idrefEdges = _.filter(edges, function(e) {
            return !(nodesMap[e.data.source] && nodesMap[e.data.target]);
        });
        idrefEdges.forEach(function(edge) {
            const {newNodes, newEdges, edgesToDelete} = populateIdrefEdge(nodesMap, edgesMap, edge);
            edges = _.difference(edges, edgesToDelete);
            nodes = nodes.concat(newNodes);
            edges = edges.concat(newEdges);
        });
    } else {
        // Removing hanging entities
        const connectedEdges = _.filter(edges, function(e) {
            return (nodesMap[e.data.source] && nodesMap[e.data.target]);
        });
        edges = connectedEdges;
    }
    const elements = nodes.concat(edges);
    return elements;
};


function initWrapper(element, options) {
    const {caption, width, height, hideFooter} = options;

    const $elem = $(element);
    $elem.addClass('stix-viewer-block');
    $elem.append('<div class="stix-viewer"></div>');

    const $viewer = $elem.find('.stix-viewer');
    $viewer.append('<div class="stix-graph"></div>');

    const $graph = $viewer.find('.stix-graph');

    $elem.css({width: width});
    $graph.css({
        width: '100%',
        height: height,
    });

    if (caption) {
        const tmpl = _.template(`
            <div class="viewer-header"><%= caption %></div>
        `);
        $elem.prepend(tmpl({'caption': caption}));
    }
    if (!hideFooter) {
        $elem.append(`
            <div class='viewer-footer'>
                made with <a href="https://traut.github.io/stixview/">stixview</a>
                <span style="float:right">
                    <a href="#" class="download-json">STIX2</a>&nbsp;
                    <a href="#" class="download-png">PNG</a>
                </span>
            </div>
        `);
    }
}


function initDragDrop(elem, callback) {
    elem.addEventListener('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).addClass('dragover-active');
        e.dataTransfer.dropEffect = 'copy';
    });
    elem.addEventListener('dragleave', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).removeClass('dragover-active');
    });
    elem.addEventListener('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).removeClass('dragover-active');
        const files = e.dataTransfer.files; // Array of all files
        if (files.length > 1) {
            console.error('More than 1 file dropped, picking first one', files);
        };
        if (files.lengh == 0) {
            return;
        }
        const file = files[0];
        readFile(file, callback);
    });
}


function initGraph(element, options, dataFetchCallback) {
    const {
        allowDragDrop,
        caption,
        layout,
        showSidebar,
        disableMouseZoom,
        disablePanning,
        highlightedObjects,
        hiddenObjects,
        hideFooter,
        showMarkings,
        minZoom,
        maxZoom,
        graphWidth,
        graphHeight,
        style,
        onClickNode,
    } = options;

    const $elem = $(element);
    const width = graphWidth || element.clientWidth || 800;
    const height = graphHeight || 600;

    initWrapper(element, {width, height, caption, hideFooter});

    const $viewer = $elem.find('.stix-viewer');
    const $graph = $viewer.find('.stix-graph');

    if (allowDragDrop) {
        $graph.html(
            `<div class='viewer-placeholder'>Drag and drop STIX2 json file here</div>`);
        initDragDrop(element, function(bundle) {
            dataFetchCallback(bundle);
        });
    }

    const stixId = element.dataset.stixViewId;

    const cy = cache[stixId] = cytoscape({
        style: style || DEFAULT_GRAPH_STYLE,
        userZoomingEnabled: !disableMouseZoom,
        userPanningEnabled: !disablePanning,
    });
    cy.stixviewContainer = $graph;
    cy.minZoom(minZoom || 0.3);
    cy.maxZoom(maxZoom || 2.5);

    cy.highlightedObjects = highlightedObjects || [];
    cy.hiddenObjects = hiddenObjects || [];
    cy.showMarkings = showMarkings;

    if (showSidebar) {
        $viewer.append('<div class="sidebar"></div>');
        cy.sidebar = $viewer.find('.sidebar');
    }

    if (onClickNode) {
        cy.on('click', 'node', function(e) {
            e.preventDefault();
            const clickedNode = e.target.data();
            onClickNode(clickedNode);
        });
    }

    cy.layoutName = layout;
    cy.stixId = stixId;
    cy.element = element;

    const graph = {
        cy: cy,
        element: element,
        $elem: $elem,
        options: options,
        runLayout: function(layoutName) {
            return runLayout(cy, layoutName);
        },
        enableLabels: function() {
            cy.style()
                .selector('node')
                .style('label', 'data(label)')
                .update();
        },
        disableLabels: function() {
            cy.style()
                .selector('node')
                .style('label', '')
                .update();
        },
        fit: function() {
            cy.fit();
        },
        markAsLoading: function() {
            $elem.addClass('loading');
            $elem.find('.viewer-placeholder').remove();
        },
        markAsNotLoading: function() {
            graph.$elem.removeClass('loading');
        },
    };
    return graph;
}


function loadGraph(graph, bundle, showIdrefs, callback) {
    const cy = graph.cy;
    cy.remove('node');
    cy.remove('edge');

    cy.mount(cy.stixviewContainer);

    graph.$elem.find('.viewer-placeholder').remove();

    const graphElements = makeElements(
        bundle,
        showIdrefs,
        cy.highlightedObjects,
        cy.hiddenObjects,
        cy.showMarkings);

    cy.add(graphElements);
    cy.raw_data = bundle;

    cy.once('layoutstop', function() {
        callback && callback(graph);
    });

    if (!graph.options.disableLabels) {
        cy.style()
            .selector('node')
            .style('label', 'data(label)')
            .update();
    }

    if (!graphElements) {
        callback && callback(graph);
    }
    initDownloadLinks(cy);

    runLayout(cy, cy.layoutName || DEFAULT_LAYOUT);
    if (cy.sidebar) {
        initSidebar(cy, cy.stixId);
    }
}


export {initGraph, loadGraph};
