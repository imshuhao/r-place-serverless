const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8081 });
 
var dim = 250; // note: this is not the right dimensions!!
var board=new Array(dim);
for(var x=0;x<dim;x++){
	board[x]=new Array(dim);
	for(var y=0;y<dim;y++){
		board[x][y]={ 'r':255, 'g':255, 'b':255 };
	}
}

wss.on('close', function() {
    console.log('disconnected');
});

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
};

// for heartbeat to make sure connection is alive 
function noop() {}
function heartbeat() {
  this.isAlive = true;
}

function isValidSet(o){
	var isValid=false;
	try {
	   isValid = 
		Number.isInteger(o.x) && o.x!=null && 0<=o.x && o.x<dim &&
		Number.isInteger(o.y) && o.y!=null && 0<=o.y && o.y<dim && 
		Number.isInteger(o.r) && o.r!=null && 0<=o.r && o.r<=255 && 
		Number.isInteger(o.g) && o.g!=null && 0<=o.g && o.g<=255 && 
		Number.isInteger(o.b) && o.b!=null && 0<=o.b && o.b<=255;
	} catch (err){ 
		isValid=false; 
	} 
	return isValid;
}
wss.on('connection', function(ws) {
	// heartbeat
  	ws.isAlive = true;
  	ws.on('pong', heartbeat);

	// send initial board: this is slow!!!
	for(x=0;x<dim;x++){
		for(y=0;y<dim;y++){
			var o = { 'x' : x, 'y' : y, 'r': board[x][y].r, 'g': board[x][y].g, 'b': board[x][y].b };
			ws.send(JSON.stringify(o));
		}
	}

	// when we get a message from the client
	ws.on('message', function(message) {
		console.log(message);
		var o = JSON.parse(message);
		if(isValidSet(o)){
			wss.broadcast(message);
			board[o.x][o.y] = { 'r': o.r, 'g': o.g, 'b': o.b };
		}
	});
});

// heartbeat (ping) sent to all clients
const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
 
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

// Static content
var express = require('express');
var app = express();

// static_files has all of statically returned content
// https://expressjs.com/en/starter/static-files.html
app.use('/',express.static('static_files')); // this directory has files to be returned

app.listen(8080, function () {
  console.log('Example app listening on port 8080!');
});

