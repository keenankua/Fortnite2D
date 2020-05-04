var BLACK = 'rgba(0,0,0,255)';
var TAN = 'rgba(210,180,140,255)';
var STAGE_COLOUR = TAN;
var PLAYABLE_SIZE = 4000;
var CAMERA_SIZE = 800;
var MAP_PADDING = CAMERA_SIZE/2;
var TOTAL_MAP_SIZE = PLAYABLE_SIZE + MAP_PADDING*2;
var PLAYABLE_LEFT_EDGE = MAP_PADDING;
var PLAYABLE_RIGHT_EDGE = MAP_PADDING + PLAYABLE_SIZE;
var PLAYABLE_TOP_EDGE = MAP_PADDING;
var PLAYABLE_BOTTOM_EDGE = MAP_PADDING + PLAYABLE_SIZE;
var HUD_FONT = 'bolder 50px monospace';

stage = null;
view = null;
interval = null;
canvas = null;
highscores = null;
socket = null;

function setupGame(){
	canvas = document.getElementById('stage');
	
	// https://javascript.info/keyboard-events
	document.addEventListener('keydown', moveByKey);
	document.addEventListener('keyup', moveByKeyUp);
    
	canvas.addEventListener('mousemove', adjustCrosshairByMouse);
	canvas.addEventListener('click', playerAttackByClick);
    
	socket = new WebSocket("ws://142.1.200.148:10514");
    
	socket.onmessage = function (event) {
		draw(event.data);
	}
}

function endGame() {
	window.gameUI.submitScore();
	socket.close();
}

function moveByKey(event){
	var direction = "";
	switch(event.key) {
  	case 'w':
		direction = "up";
    	    	break;
  	case 'a':
    		direction = "left";
    		break;
  	case 's':
    		direction = "down";
    		break;
  	case 'd':
    		direction = "right";
    		break;
	default:
		return;
	
	}
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({"type" : "keyboard", "direction":direction, "value" : true}));
	}
	
}

function moveByKeyUp(event){
	var direction = "";
	switch(event.key) {
  	case 'w':
		direction = "up";
    	    	break;
  	case 'a':
    		direction = "left";
    		break;
  	case 's':
    		direction = "down";
    		break;
  	case 'd':
    		direction = "right";
    		break;
	default:
		return;
	
	}
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({"type" : "keyboard", "direction":direction, "value" : false}));
	}
}

function adjustCrosshairByMouse(event){
	var rect = canvas.getBoundingClientRect();
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({"type" : "aim", "x":event.clientX-rect.left, "y" : event.clientY-rect.top}));
	}
}

function playerAttackByClick(event) {
	if (socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({"type" : "attack"}));
	}

}

function draw(jsonstuff){
	this.spam_array=[];
	
	var context = canvas.getContext('2d');
	
	context.fillStyle = BLACK;
	context.fillRect(0, 0, TOTAL_MAP_SIZE, TOTAL_MAP_SIZE);
	context.fillStyle = STAGE_COLOUR;
	context.fillRect(PLAYABLE_LEFT_EDGE, PLAYABLE_TOP_EDGE, PLAYABLE_SIZE, PLAYABLE_SIZE);
	
	var objs = JSON.parse(jsonstuff);
	var i;
	for (i = 0; i < objs.length; i++) {
		pic = objs[i];
		if(pic.type == "rectangle"){
			context.fillStyle = pic.color;
			context.strokeStyle = pic.color;
			context.fillRect(pic.x, pic.y, pic.width, pic.height);
			context.strokeRect(pic.x, pic.y, pic.width, pic.height);
		}
		if(pic.type == "circle"){
			context.beginPath();
			context.fillStyle = pic.color;
			context.strokeStyle = pic.color;
			context.arc(pic.x, pic.y, pic.size, 0, 2 * Math.PI, false); 
			context.fill();
			context.stroke();
		}
		if(pic.type == "camera"){
			context.setTransform(1, 0, 0, 1, -1*pic.x, -1*pic.y);
		}
		if(pic.type == "hud"){
			context.strokeStyle = BLACK;
			context.font = HUD_FONT;
			context.fillStyle = pic.color;
			context.fillText("Health: " + pic.health, pic.cameraX, pic.cameraY + CAMERA_SIZE);
			context.strokeText("Health: " + pic.health, pic.cameraX, pic.cameraY + CAMERA_SIZE);
			var ammoText = "Ammo: " + pic.ammo;
			context.fillText(ammoText, pic.cameraX + CAMERA_SIZE - context.measureText(ammoText).width, pic.cameraY + CAMERA_SIZE);
			context.strokeText(ammoText, pic.cameraX + CAMERA_SIZE - context.measureText(ammoText).width, pic.cameraY + CAMERA_SIZE);
			if (pic.health == 0) {
				// Dead, add score to db
				window.gameUI.setShowPlayAgain(true);
				endGame();
			}
		}
		if(pic.type == "score"){
			window.gameUI.setScore(pic.score);
		}
	
	}
}
