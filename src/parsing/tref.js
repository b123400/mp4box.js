BoxParser.trefBox.prototype.parse = function(stream) {
	var ret;
	var box;
	while (stream.getPosition() < this.start+this.size) {
		ret = BoxParser.parseOneBox(stream, true);
		box = new BoxParser.TrackReferenceTypeBox(ret.type, ret.size, ret.hdr_size, ret.start);
		box.parse(stream);
		this.boxes.push(box);
	}
}

