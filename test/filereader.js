var mp4box;

var boxtree;
var boxtable;
var treeview_node;
var progressbar;
var progresslabel;
var fileinput;
var urlinput;
var fancytree;

Log.setLogLevel(Log.debug);

var chunkSize  = 1024 * 1024; // bytes

function dragenter(e) {
	e.stopPropagation();
	e.preventDefault();
}

function drop(e) {
	var file;

	if (!e) {
		file = document.getElementById('fileinput').files[0];
	}
	else {
		file = e.dataTransfer.files[0];
	}
	if (file) {
		parseFile(file);
	}
}

function httpload(url) {	
	mp4box 	   = new MP4Box(false, false);
	var downloader = new Downloader();
	var startDate = new Date();
	var nextStart = 0;
	downloader.setCallback(
		function (response, end, error) { 
			if (response) {
				progressbar.progressbar({ value: Math.ceil(100*downloader.chunkStart/downloader.totalLength) });
				mp4box.appendBuffer(response);
				nextStart += chunkSize;
				
			}
			if (end) {
				progressbar.progressbar({ value: 100 });
				var endRead = new Date();
	            console.log("Done reading file ("+downloader.totalLength+ " bytes) in "+(endRead - startDate)+" ms");
				createTreeView(mp4box.inputIsoFile.boxes);
	            console.log("Done constructing tree in "+(new Date() - endRead)+" ms");
				mp4box.flush();
			} else {
				downloader.setChunkStart(nextStart); 
			}
			if (error) {
				console.log("Error downloading file");
			}
		}
	);
	downloader.setInterval(1000);
	downloader.setChunkSize(chunkSize);
	downloader.setUrl(url);
	downloader.start();	
}

function httploadFromUrl() {
	httpload(urlinput.val());
}

function httploadFromList() {
	httpload(urlSelector.find(":selected").val());
}

function getBoxTable(box) {
	var html = '<table>';
	html += '<thead>';
	html += '<tr>';
	html += '<th>';
	html += 'Property name';
	html += '</th>';
	html += '<th>';
	html += 'Property value';
	html += '</th>';
	html += '</tr>';
	html += '</thead>';
	html += '<tbody>';
	for (var prop in box) {
		if (["hdr_size", "start", "boxes", "subBoxNames", "entries", "samples", "references", "items", "item_infos", "extents"].indexOf(prop) > -1) {
			continue;
		} else if (box[prop] instanceof BoxParser.Box) {
			continue;
		} else if (typeof box[prop] === "function") {
			continue;
		} else if (box.subBoxNames && box.subBoxNames.indexOf(prop.slice(0,4)) > -1) {
			continue;
		} else {
			html += '<tr>';
			html += '<td><code>';
			html += prop;
			html += '</code></td>';
			html += '<td><code>';
			html += box[prop];
			html += '</code></td>';
			html += '</tr>';
		}
	}
	html += '</tbody>';
	html += '</html>';
	return html;
}

function getFancyTreeData(boxes) {
	var array = [];
	for (var i = 0; i < boxes.length; i++) {
		var box = boxes[i];
		var fancytree_node = {};
		array.push(fancytree_node);
		fancytree_node.title = box.type || i;
		fancytree_node.data = { 'box': box };
		if (box.boxes) {
			fancytree_node.children = getFancyTreeData(box.boxes);
			fancytree_node.folder = true;
		} else if (box.entries) {
			fancytree_node.children = getFancyTreeData(box.entries);
			fancytree_node.folder = true;
		} else if (box.references) {
			fancytree_node.children = getFancyTreeData(box.references);
			fancytree_node.folder = true;
		} else if (box.items) {
			fancytree_node.children = getFancyTreeData(box.items);
			fancytree_node.folder = true;
		} else if (box.item_infos) {
			fancytree_node.children = getFancyTreeData(box.item_infos);
			fancytree_node.folder = true;
		} else if (box.extents) {
			fancytree_node.children = getFancyTreeData(box.extents);
			fancytree_node.folder = true;
		}
	}
	return array;
}

function createTreeView(boxes) {
	fancytree.reload(getFancyTreeData(boxes));
	fancytree = boxtree.fancytree('getTree');
}

function parseFile(file) {
    var fileSize   = file.size;
    var offset     = 0;
    var self       = this; // we need a reference to the current object
    var readBlock  = null;
 	var startDate  = new Date();
	
	mp4box 	   = new MP4Box(false, false);

	mp4box.onError = function(e) { 
		console.log("mp4box failed to parse data."); 
	};

    var onparsedbuffer = function(mp4box, buffer) {
    	console.log("Appending buffer with offset "+offset);
		buffer.fileStart = offset;
    	mp4box.appendBuffer(buffer);	
	}

	var onBlockRead = function(evt) {
        if (evt.target.error == null) {
            onparsedbuffer(mp4box, evt.target.result); // callback for handling read chunk
            offset += evt.target.result.byteLength;
			progressbar.progressbar({ value: Math.ceil(100*offset/fileSize) });
        } else {
            console.log("Read error: " + evt.target.error);
            return;
        }
        if (offset >= fileSize) {
			progressbar.progressbar({ value: 100 });
        	var endRead = new Date();
            console.log("Done reading file ("+fileSize+ " bytes) in "+(endRead - startDate)+" ms");
			createTreeView(mp4box.inputIsoFile.boxes);
			buildItemTable(mp4box.inputIsoFile.items);
            console.log("Done constructing tree in "+(new Date() - endRead)+" ms");
            return;
        }

        readBlock(offset, chunkSize, file);
    }

    readBlock = function(_offset, length, _file) {
        var r = new FileReader();
        var blob = _file.slice(_offset, length + _offset);
        r.onload = onBlockRead;
        r.readAsArrayBuffer(blob);
    }

    readBlock(offset, chunkSize, file);
}

function buildItemTable(items) {
	var html;
	var i, j;
	html = "<table>";
	html += "<thead>";
	html += "<tr>";
	html += "<th>ID</th>";
	html += "<th>Name</th>";
	html += "<th>Type</th>";
	html += "<th>Primary</th>";
	html += "<th>Protected</th>";
	html += "<th>Byte ranges</th>";
	html += "<th>References [type, item ID]</th>";
	html += "</tr>";
	html += "</thead>";
	html += "<tbody>";
	for (i in items) {
		var item = items[i];
		html += "<tr onclick='displayItemContent("+item.id+");'>";
		html += "<td>"+item.id+"</td>";
		html += "<td>"+(item.name ? item.name: "")+"</td>";
		html += "<td>"+(item.type === "mime" ? item.content_type : item.type)+"</td>";
		html += "<td>"+(item.primary ? "Yes" : "No")+"</td>";
		html += "<td>"+(item.protection ? item.protection : "No")+"</td>";
		html += "<td>";
		for (j = 0; j < item.extents.length; j++) {
			html+= "["+item.extents[j].offset+"-"+(item.extents[j].offset+item.extents[j].length-1)+"] "
		}
		html += "</td>";
		html += "<td>";
		if (item.ref_to) {
			for (j = 0; j < item.ref_to.length; j++) {
				html+= "["+item.ref_to[j].type+", "+item.ref_to[j].id+"] "
			}
		}
		html += "</td>";
		html += "</tr>";
	}
	html += "</tbody>";
	html += "</table>";
	$("#itemview").html(html);
}

window.onload = function () {
	boxtree = $('#boxtree');
	boxtable = $('#boxtable');
	progressbar = $('#progressbar');
	progresslabel = $('#progress-label');
	fileinput = $('#fileinput');
	urlinput = $('#urlinput');
	urlSelector = $('#urlSelector');
	progressbar.progressbar({ 
		value: 0, 
		change: function() {
           progresslabel.text( 
              progressbar.progressbar( "value" ) + "%" );
        },
        complete: function() {
           progresslabel.text( "Loading Completed!" );
        }
    });
	fileinput.button();

	var fancytree_options = {};
	fancytree_options.autoScroll = true;
	fancytree_options.source = [];
	fancytree_options.activate = function(event, data) {
		var node = data.node;
		if( !$.isEmptyObject(node.data) ){
			boxtable.html(getBoxTable(node.data.box));
		}
	};
	boxtree.fancytree(fancytree_options);
	fancytree = boxtree.fancytree('getTree');

	boxtable.html(getBoxTable({}));

	$("#tabs").tabs();
	$("#resulttabs").tabs();

	buildUrlList(urlSelector[0], true);
	
	if (window.location.search) {
		httpload(window.location.search.substring(1));
	}
}

function displayItemContent(id) {
	var string;
	var item = mp4box.inputIsoFile.getItem(id);	
	console.log("Item "+id+", content:");
	switch (item.content_type) {
		case "text/html":
		case "text/css":
		case "application/ecmascript":
			string = (new MP4BoxStream(item.data.buffer)).readString(item.data.length);
			console.log(string);
			break;
		default:
			console.log("Cannot display binary data");

	}
	mp4box.inputIsoFile.releaseItem(id);
}