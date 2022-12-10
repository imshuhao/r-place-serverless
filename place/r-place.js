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
var curr_pos = 0;

function getXY(pos) {
    return {
        x: pos % 1000,
        y: Math.floor(pos / 1000)
    }
}

function initBoard(start, bitmap) {
    console.log("initBoard, start: " + start + ", bitmap.length: " + bitmap.length);
    let context = document.getElementById('canvas').getContext('2d');
    for (let i = 0; i < bitmap.length; i++) {
        let color = bitmap[i];
        let {x, y} = getXY(start + i);
        context.fillStyle = colorMap[color];
        context.fillRect(x, y, 1, 1);
    }
}

$(function(){
    socket = new WebSocket("wss://0jr8jctd81.execute-api.us-east-2.amazonaws.com/Prod");
    socket.onopen = async function (event) {
        $('#sendButton').removeAttr('disabled');
        console.log("connected, sending hello");
        var initPayload = {
            "action":"sendmessage",
            "giveMeData": 1
        }
        socket.send(JSON.stringify(initPayload));
    };
    socket.onclose = function (event) {
        alert("closed code: " + event.code + "\nreason: " +event.reason + "\nwasClean: "+event.wasClean);
    };
    socket.onmessage = function (event) {
        body = event.data;
        if (!initFinished){
            if (body.endsWith("--EOF--")) {
                body = body.slice(0, -7);
                initFinished = true;
            }
            console.log(body.slice(-10));
            let chunk = Uint8Array.from(atob(body), c => c.charCodeAt(0));
            initBoard(curr_pos, chunk);
            curr_pos += chunk.length;
        }
        else if (body.startsWith("COOLDOWN")){
            alert("You are on cooldown for " + body.slice(9) + " seconds");
        }
        else{
            var o=JSON.parse(event.data);
            console.log(o);
            var context = document.getElementById('canvas').getContext('2d');
            let {x, y} = getXY(o.position);
            context.fillStyle = colorMap[o.color];
            context.fillRect(x, y, 1, 1);
        }
    };
    $('#setForm').submit(function( event ) {
        var payload = {
            "action":"sendmessage",
            "color": parseInt($('#color').val()),
            "position": parseInt($('#x').val()) + parseInt($('#y').val()) * 1000
        };
        socket.send(JSON.stringify(payload));
        event.preventDefault();
    });
});