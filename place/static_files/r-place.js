const colorMap = {
    0: "#000000",
    1: "#005500",
    2: "#00aa00",
    3: "#00ff00",
    4: "#0000ff",
    5: "#0055ff",
    6: "#00aaff",
    7: "#00ffff",
    8: "#ff0000",
    9: "#ff5500",
    10: "#ffaa00",
    11: "#ffff00",
    12: "#ff00ff",
    13: "#ff55ff",
    14: "#ffaaff",
    15: "#ffffff",
};

var socket;

var bitmap_str = "";
var initFinished = false;


function initBoard(bitmap) {
    let context = document.getElementById('canvas').getContext('2d');
    console.log(bitmap.length);
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < 1000; j++) {
            let index = i * 1000 + j;
            let color = bitmap[index];
            context.fillStyle = colorMap[color];
            context.fillRect(j, i, 1, 1);
        }
    }
}

$(function(){
    // socket = new WebSocket("ws://"+window.location.hostname+":8081");
    socket = new WebSocket("wss://6ne1n7727b.execute-api.us-east-2.amazonaws.com/Prod");
    socket.onopen = async function (event) {
        $('#sendButton').removeAttr('disabled');
        console.log("connected, sending hello");
        var payload = {
            "action":"sendmessage",
            "giveMeData": 1
        }
        socket.send(JSON.stringify(payload));
        await new Promise(r => setTimeout(r, 100));
    };
    socket.onclose = function (event) {
        alert("closed code: " + event.code + "\nreason: " +event.reason + "\nwasClean: "+event.wasClean);
    };
    socket.onmessage = function (event) {
        if (!initFinished){
            bitmap_str = bitmap_str.concat(event.data);
            console.log(bitmap_str.length);
            if (bitmap_str.endsWith("--EOF--")) {
                console.log("got all data");
                bitmap_str = bitmap_str.slice(0, -7);
                initBoard(Uint8Array.from(atob(bitmap_str), c => c.charCodeAt(0)));
                initFinished = true;
                delete bitmap_str;
                return;
            }
        }
        else{
            var o=JSON.parse(event.data);
            console.log(o);

            var context = document.getElementById('canvas').getContext('2d');
            let x = o.position % 1000;
            let y = Math.floor(o.position / 1000);
            context.fillStyle = colorMap[o.color];
               context.fillRect(x, y, 1, 1);
        }
    }

    // Comment out the event handler below when in production
    // $('#canvas').mousemove(function(event){
    // 	var x=event.pageX-this.offsetLeft;
    // 	var y=event.pageY-this.offsetTop;
    // 	var o = { 'x': x, 'y': y, 'r': 0, 'g':0, 'b':0 };
    // 	socket.send(JSON.stringify(o));
    // });
    $('#setForm').submit(function( event ) {
        var payload = {
            "action":"sendmessage",
            "color": parseInt($('#color').val()),
            "position": parseInt($('#x').val()) + parseInt($('#y').val()) * 1000
        };
        // console.log(payload);
        socket.send(JSON.stringify("payload sent"));
          event.preventDefault();
    });
});