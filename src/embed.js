import $ from 'jquery';
import _ from 'underscore';


let urlCache = {};
let gistCache = {};


function loadUrl(url) {
    let p = urlCache[url] || new Promise(function(resolve, reject) {
        $.get(url)
            .done(function(res) {
                let bundle = JSON.parse(res);
                resolve(bundle);
            })
            .fail(reject);
    });
    urlCache[url] = p;
    return p;
}


function loadGist(id, file) {
    let url = 'https://api.github.com/gists/' + id;

    let p = gistCache[id] || new Promise(function(resolve, reject) {
        $.get(url)
            .done(function(res) {
                file = file || Object.keys(res.files)[0];
                let details = res.files[file];
                resolve({
                    bundle: JSON.parse(details.content),
                    url: details.raw_url
                });
            })
            .fail(reject);
    });
    gistCache[id] = p;
    return p;
}


function initDragDrop(elem, callback) {
    elem.addEventListener('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).addClass("dragover-active");
        e.dataTransfer.dropEffect = 'copy';
    });
    elem.addEventListener('dragleave', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).removeClass("dragover-active");
    });
    elem.addEventListener('drop', function(e) {
        e.stopPropagation();
        e.preventDefault();
        $(elem).removeClass("dragover-active");
        var files = e.dataTransfer.files; // Array of all files
        if (files.length > 1) {
            console.error("More than 1 file dropped, picking first one", files)
        };
        if (files.lengh == 0) {
            return
        }
        var file = files[0];
        if (file.type == 'application/json') {
            var reader = new FileReader();
            reader.onload = function(e2) {
                var data = JSON.parse(e2.target.result);
                callback(data);
            }
            reader.readAsText(file); // start reading the file data.
        }
    });
}

function isTrue(prop) {
    return (prop != null && prop != 'false');
}


function downloadData(data) {
    $('<a />', {
        'download': data['id'] + '.json',
        'href' : 'data:application/json,' + encodeURIComponent(JSON.stringify(data))
    }).appendTo('body').click(function() {
        console.info("clicked!");
        $(this).remove()
    })[0].click()
}


function initEmbeddedBlock(element, callback) {
    var $elem = $(element),
        $viewer,
        $graph,
        id,
        url,
        allowDragDrop,
        file,
        caption,
        hideFooter,
        bundle,
        graphWidth,
        graphHeight;

    id = element.dataset.stixGistId;
    url = element.dataset.stixUrl;
    allowDragDrop = isTrue(element.dataset.stixAllowDragdrop)

    file = element.dataset.gistFile;
    caption = element.dataset.caption;
    hideFooter = isTrue(element.dataset.hideFooter);

    $elem.addClass('stix-viewer-block')
    $elem.append('<div class="stix-viewer"></div>')
    $viewer = $elem.find(".stix-viewer")

    $viewer.append('<div class="stix-graph"></div>')
    $graph = $viewer.find(".stix-graph")

    graphWidth = (
        element.dataset.graphWidth
        || element.clientWidth
        || 800)

    graphHeight = (
        element.dataset.graphHeight
        || 600)

    $elem.css({
        width: graphWidth,
    });

    $graph.css({
        width: '100%',
        height: graphHeight
    });

    if (caption) {
        let tmpl = _.template(`
            <div class="viewer-header"><%= caption %></div>
        `);
        $elem.prepend(tmpl({'caption': caption}));
    }
    if (!hideFooter) {
        //$elem.append(tmpl({'url': id ? ('https://api.github.com/gists/' + id) : url}))
        $elem.append(`
            <div class='viewer-footer'>
                made with <a href="https://github.com/traut/stixview">stixview</a>
                <a href="#" class="download" style="float:right">STIX2 bundle</a>
            </div>
        `);
    }

    if (!id && !url && !allowDragDrop) {
        return false;
    }

    if (allowDragDrop) {
        $graph.html("<div class='viewer-placeholder'>Drag and drop STIX2 json file here</div>");
        initDragDrop(element, function(bundle) {
            $graph.find('.viewer-placeholder').remove();
            $elem.find(".download").on('click', function(e) {
                e.preventDefault();
                downloadData(bundle);
            });
            callback(bundle);
        });
    }

    if (id || url) {
        $elem.addClass("loading");
        $elem.find('.viewer-placeholder').remove();
    }

    if (id) {
        loadGist(id, file)
            .then(
                function({bundle, url}) {
                    callback(bundle);
                    $elem.find(".download").prop('href', url);
                },
                function(error){
                    console.error("can not load gist " + id, error);
                });
    } else if (url) {
        loadUrl(url)
            .then(
                function(bundle) {
                    callback(bundle);
                    $elem.find(".download").prop('href', url);
                },
                function(error){
                    console.error("can not load url " + url, error);
                });
    }
}

export default initEmbeddedBlock;
