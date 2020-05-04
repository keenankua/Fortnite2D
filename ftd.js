function randint(n) { return Math.round(Math.random()*n); }
function rand(n) { return Math.random()*n; }

var BLACK = 'rgba(0,0,0,255)';
var WHITE = 'rgba(255,255,255,255)';
var DARKGREY = 'rgba(75,75,75,255)';
var RED = 'rgba(255,0,0,255)';
var GREEN = 'rgba(0,255,0,255)';
var BLUE = 'rgba(0,0,255,255)';
var YELLOW = 'rgba(255,255,0,255)';
var MAGENTA = 'rgba(255,0,255,255)';
var TAN = 'rgba(210,180,140,255)';
var TANLIGHT = 'rgba(255,255,244,255)';
var LIGHTGREEN = 'rgba(102,178,102,255)';
var ORANGE = 'rgba(232,126,4,255)';

var STAGE_COLOUR = TAN;
var PLAYABLE_SIZE = 4000;
// Camera is size of viewable area as defined in the HTML
var CAMERA_SIZE = 800;
// Since player is centralized on camera, padding per side is half of camera size
var MAP_PADDING = CAMERA_SIZE/2;
var TOTAL_MAP_SIZE = PLAYABLE_SIZE + MAP_PADDING*2;
var MAP_CENTER_X = Math.floor(TOTAL_MAP_SIZE/2);
var MAP_CENTER_Y = Math.floor(TOTAL_MAP_SIZE/2);
var PLAYABLE_LEFT_EDGE = MAP_PADDING;
var PLAYABLE_RIGHT_EDGE = MAP_PADDING + PLAYABLE_SIZE;
var PLAYABLE_TOP_EDGE = MAP_PADDING;
var PLAYABLE_BOTTOM_EDGE = MAP_PADDING + PLAYABLE_SIZE;

var HUD_COLOUR = WHITE;
var HUD_FONT = 'bolder 50px monospace';

var PLAYER_COLOUR = RED;
var PLAYER_OUTLINE_COLOUR = BLACK;
var PLAYER_START_HEALTH = 100;
var PLAYER_START_AMMO = 50;
var PLAYER_SIZE = 30;
var PLAYER_SPEED = 5;

var NUM_OPPONENTS = 15;
var OPPONENT_COLOUR = BLUE;
var OPPONENT_MIN_HEALTH = 30;
var OPPONENT_MAX_HEALTH = 100;
var OPPONENT_AMMO = 50;
var OPPONENT_SPEED = 2;
var OPPONENT_SIZE_DIVISOR = 2;
var OPPONENT_MIN_SIZE = 15;
var OPPONENT_STEPS_BETWEEN_ATTACKS = 30;

var AMMO_COLOUR = YELLOW ;
var AMMO_MIN_AMOUNT = 10;
var AMMO_MAX_AMOUNT = 50;
var AMMO_HEALTH = 20;
var AMMO_SIZE_DIVISOR = 3;
var AMMO_MIN_SIZE = 5;
var NUM_AMMO_PACKS = 75;

var HEALTHPACK_COLOUR = GREEN;
var HEALTHPACK_MIN_AMOUNT = 10;
var HEALTHPACK_MAX_AMOUNT = 50;
var HEALTHPACK_SIZE_DIVISOR = 2;
var HEALTHPACK_MIN_SIZE = 5;
var HEALTHPACK_HEALTH = 20;
var NUM_HEALTHPACKS = 50;

var BULLET_COLOUR = DARKGREY;
var BULLET_SIZE = 8;
var BULLET_RANGE = 75;
var BULLET_SPEED = 8;

var CROSSHAIR_COLOUR = RED;
var CROSSHAIR_SIZE = 4;
var CROSSHAIR_DIST = 25;

var OBSTACLE_COLOUR = BLACK;
var OBSTACLE_MIN_SIZE = 30;
var OBSTACLE_MAX_SIZE = 350;
var NUM_OBSTACLES = 100;

var LAVA_COLOUR = ORANGE;
var LAVA_DAMAGE = 0.05;

var HEAL_TILE_COLOUR = GREEN;
var HEAL_TILE_HEALTH = 0.025;

var SPECIAL_TILES_MIN_SIZE = 50;
var SPECIAL_TILES_MAX_SIZE = 200;
var NUM_SPECIAL_TILES = 25;

var BULLET_DAMAGE = 8;


class Server{
	constructor(port){
		this.current_id=0;
		this.port = port;
		var WebSocketServer = require('ws').Server;
		this.wss = new WebSocketServer({port: this.port});
		this.stage = new Stage(this.wss);
		this.init();
		
		this.connected_players={};

	}
	
	init(){
		this.wss.on('close', (ws) => {
			console.log('closed');
			//this.connected_players
		});
		
		this.wss.on('disconnect', (ws) => {
			console.log('disconnected');
		});

		this.wss.broadcast = (array_of_actors) =>{
			for(let ws of this.wss.clients){ 
				var newArray = array_of_actors.slice();
				// Each player has their own independent score, camera, and hud
				newArray.push(this.connected_players[ws.id].getScoreJson());
				newArray.push(this.connected_players[ws.id].getCamera().getJSON());
				newArray.push(this.connected_players[ws.id].getHud().getJSON());
				ws.send(JSON.stringify(newArray));
			}
		}

		this.wss.on('connection', ws => {
			ws.stage=this.stage
			ws.id = this.current_id;
			
			this.current_id = this.current_id + 1;
			
			this.connected_players[ws.id] = this.stage.newPlayer();
			
			ws.player = this.connected_players[ws.id];
			ws.on('disconnect', function(ws){
				this.stage.removePlayer(this.player);
				

			});
			ws.on('close', function(ws){
				this.stage.removePlayer(this.player);
				
			});
			ws.on('message', (message) =>{
				
				var message = JSON.parse(message);
				var player = this.connected_players[ws.id];
				if(message.type == "keyboard"){
					if(message.direction == "up"){
						player.setMovingUp(message.value);
					}
					if(message.direction == "down"){
						player.setMovingDown(message.value);
					}
					if(message.direction == "left"){
						player.setMovingLeft(message.value);
					}
					if(message.direction == "right"){
						player.setMovingRight(message.value);
					}
				}
				if(message.type == "attack"){
					player.attack();
				}
				if(message.type == "aim"){
					player.adjustCrosshair(message.x, message.y);
				}

			});
			
			
		});
		
		this.startGame();
	}
		
	startGame(){
		var interval=setInterval(()=> {this.stage.step(); this.stage.draw();} ,20);
	}
	
	
}

class Stage {
	constructor(wss) {
		this.wss = wss;
		this.obstacles=[];
		this.actors=[]; // all actors on this stage (monsters, player, boxes, ...)
		this.players=[]; // a special actor, the player
	
		// the logical playable width and height of the stage
		this.width=PLAYABLE_SIZE;
		this.height=PLAYABLE_SIZE;
		this.initializeObjects();

		this.spam_array=[];
		
			
	}


	initializeObjects() {
		
		// Add lava and health tiles, first since it should be on the bottom
		for (var j = 0; j < NUM_SPECIAL_TILES; j++) {
			//random number of healer and lava zones
			var type = Math.floor(Math.random() * 2);
			// Random size
			var tileWidth = Math.floor(Math.random() * (SPECIAL_TILES_MAX_SIZE - SPECIAL_TILES_MIN_SIZE + 1)) + SPECIAL_TILES_MIN_SIZE;
			var tileHeight = Math.floor(Math.random() * (SPECIAL_TILES_MAX_SIZE - SPECIAL_TILES_MIN_SIZE + 1)) + SPECIAL_TILES_MIN_SIZE;
			var x_loc = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-tileWidth - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
			var y_loc = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-tileHeight - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			if(type == 0) {
				var tile = new LavaRectangle(this, x_loc, y_loc, LAVA_COLOUR, tileWidth, tileHeight);
				}
			else{
				var tile = new HealerRectangle(this, x_loc, y_loc, HEAL_TILE_COLOUR, tileWidth, tileHeight);
			}			
			this.addActor(tile);
		}
			
		// Add obstacles
		for (var j = 0; j < NUM_OBSTACLES; j++) {
			var obstacleWidth = Math.floor(Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE + 1)) + OBSTACLE_MIN_SIZE;
			var obstacleHeight = Math.floor(Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE + 1)) + OBSTACLE_MIN_SIZE;
			var obstacleX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-obstacleWidth  - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
			var obstacleY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-obstacleHeight  - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			var obstacle = new RectangleObstacle(obstacleX, obstacleY, OBSTACLE_COLOUR, obstacleWidth, obstacleHeight);
			this.addObstacle(obstacle);
		}

		// Add ammo packs
		for (var j = 0; j < NUM_AMMO_PACKS; j++) {
			var ammoAmount = Math.floor(Math.random() * (AMMO_MAX_AMOUNT - AMMO_MIN_AMOUNT + 1)) + AMMO_MIN_AMOUNT;
			// Healthpack size is based on how much it heals
			var ammoSize = Math.ceil(ammoAmount / AMMO_SIZE_DIVISOR) + AMMO_MIN_SIZE;
			// Subtract ammo size from width and height since position is from top left corner
			var ammoX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-ammoSize - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
			var ammoY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-ammoSize - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			while (this.onObstacle(ammoX, ammoY, ammoSize)) {
				ammoX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-ammoSize - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
				ammoY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-ammoSize - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			}
			var ammo = new AmmoPack(this, ammoX, ammoY, AMMO_COLOUR, AMMO_HEALTH, ammoAmount);
			this.addActor(ammo);
		}
		
		// Add healthpacks
		for (var j = 0; j < NUM_HEALTHPACKS; j++) {
			var healAmount = Math.floor(Math.random() * (HEALTHPACK_MAX_AMOUNT - HEALTHPACK_MIN_AMOUNT + 1)) + HEALTHPACK_MIN_AMOUNT;
			// Healthpack size is based on how much it heals
			var healthSize = Math.ceil(healAmount / HEALTHPACK_SIZE_DIVISOR) + HEALTHPACK_MIN_SIZE;
			var healthX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-healthSize - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
			var healthY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-healthSize - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			// Make sure health doesn't spawn on top of obstacle
			while (this.onObstacle(healthX, healthY, healthSize)) {
				healthX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-healthSize - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
				healthY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-healthSize - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
			}
			var healthpack = new HealthPack(this, healthX, healthY, HEALTHPACK_COLOUR, healAmount, HEALTHPACK_HEALTH);
			this.addActor(healthpack);
		}

	}
	
	newPlayer(){
		var playerX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-PLAYER_SIZE - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
		var playerY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-PLAYER_SIZE - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
		
		while (this.onObstacle(playerX, playerY, PLAYER_SIZE)) {
			// Avoid spawning player on obstacle
			playerX = Math.floor(Math.random() * (PLAYABLE_RIGHT_EDGE-PLAYER_SIZE - PLAYABLE_LEFT_EDGE + 1)) + PLAYABLE_LEFT_EDGE;
			playerY = Math.floor(Math.random() * (PLAYABLE_BOTTOM_EDGE-PLAYER_SIZE - PLAYABLE_TOP_EDGE + 1)) + PLAYABLE_TOP_EDGE;
		}
		var colour = '#'+(0x1000000+(Math.random())*0xffffff).toString(16).substr(1,6);
		var player = new Player(this, playerX, playerY, PLAYER_START_HEALTH, PLAYER_START_AMMO, PLAYER_SIZE, colour, PLAYER_OUTLINE_COLOUR, PLAYER_SPEED, BULLET_RANGE, BULLET_SPEED);
		this.addPlayer(player);

		// Add camera centered around player
		var camera = new Camera(this, playerX+PLAYER_SIZE/2-CAMERA_SIZE/2, playerY+PLAYER_SIZE/2-CAMERA_SIZE/2, CAMERA_SIZE);
		player.addCamera(camera);

		// Add hud (Heads Up Display - health and ammo)
		player.addHud(new Hud(player, camera, HUD_COLOUR));
		
		return player;
	}
	
	addPlayer(player) {
		this.addActor(player);
		this.players.push(player);
	}
	
	getPlayers() {
		return this.players;
	}
	getPlayer(id){
		return this.players[id];
	}

	removePlayer(player) {
		var index=this.players.indexOf(player);
		if(index!=-1) {
			this.players.splice(index,1);
		}
		
		this.removeActor(player);
		this.removeActor(player.crosshair);
		
	}


	addActor(actor) {
		this.actors.push(actor);
	}

	addObstacle(actor) {
		this.obstacles.push(actor);
	}

	removeActor(actor) {
		var index=this.actors.indexOf(actor);
		if(index!=-1) {
			this.actors.splice(index,1);
		}
	}

	// Take one step in the animation of the game.  Do this by asking each of the actors to take a single step. 
	// NOTE: Careful if an actor died, this may break!
	step() {
		for(var i=0;i<this.actors.length;i++) {
			this.actors[i].step();
		}
	}

	draw() {
		this.spam_array=[];
		
		for(var i=0;i<this.actors.length;i++) {
			this.spam_array.push(this.actors[i].getJSON());
		}
		for(var i=0;i<this.obstacles.length;i++) {
			this.spam_array.push(this.obstacles[i].getJSON());

		}
		this.wss.broadcast(this.spam_array);
	}

	// return the first actor at coordinates (x,y) return null if there is no such actor
	getActor(x, y) {
		for(var i=0;i<this.actors.length;i++) {
			if(this.actors[i].x==x && this.actors[i].y==y) {
				return this.actors[i];
			}
		}
		return null;
	}
	
	// return the collidable actors that overlap with the actor passed in if moved in dx dy, or null
	// assumes square actors
	getCollision(actor, dx, dy) {
		var topLeftCorner = new Pair(actor.x+dx, actor.y+dy);
		var bottomRightCorner = new Pair(actor.x+actor.size+dx, actor.y+actor.size+dy);
		var results = []
		var collidableObjects = ["AmmoPack", "HealthPack", "Player"];
		for (var i = 0; i < this.actors.length; i++) {
			var actorClass = this.actors[i].constructor.name;
			if (collidableObjects.includes(actorClass)) {
				var objectTopLeftCorner = new Pair(this.actors[i].x, this.actors[i].y);
				var objectBottomRightCorner = new Pair(this.actors[i].x+this.actors[i].size, this.actors[i].y+this.actors[i].size);
				if (this.getOverlap(topLeftCorner, bottomRightCorner, objectTopLeftCorner, objectBottomRightCorner)) {
					results.push(this.actors[i]);
				}
			}
		}
		return results;
	}
	
	// Checks if two rectangles overlap
	getOverlap(topLeft1, bottomRight1, topLeft2, bottomRight2) {
		if (topLeft1.x > bottomRight2.x || topLeft2.x > bottomRight1.x) {
			// rectangles are to the left/right of eachother 
			return false;
		}
		else if (topLeft1.y > bottomRight2.y || topLeft2.y > bottomRight1.y) {
			// rectangles are above/below each other
			return false;
		}
		return true;
	}
	
	// Return if the move by the player is in the playable area
	moveIsInPlayableArea(player, dx, dy) {
		// Left side of player out of bounds or right side of player out of bounds
		if (player.x+dx < PLAYABLE_LEFT_EDGE || player.x+player.size+dx > PLAYABLE_RIGHT_EDGE) {
			return false;
		}
		else if (player.y+dy < PLAYABLE_TOP_EDGE || player.y+player.size+dy > PLAYABLE_BOTTOM_EDGE) {
			return false;
		}
		
		for (var j = 0; j < NUM_OBSTACLES; j++) {
			var obstacle = this.obstacles[j];
			if(obstacle.playerCollides(player.x + dx, player.y + dy, player.size)) {
				return false;
			}
		}
		
		return true;
	}

	// Return if a square with side length size at x,y overlaps any obstacles
	onObstacle(x, y, size) {
		for (var i = 0; i < this.obstacles.length; i++) {
			var squareTopLeft = new Pair(x, y);
			var squareBottomRight = new Pair(x+size, y+size);
			var obstacleRect = this.obstacles[i].rectangle;
			var overlap = this.getOverlap(squareTopLeft, squareBottomRight, obstacleRect.top_left, obstacleRect.bottom_right);
			if (overlap) {
				return true;
			}
		}
		return false;
	}
	
} // End Class Stage

class Camera {
	constructor(stage, x, y, size) {
		this.stage = stage;
		this.x = x;
		this.y = y;
		this.size = size;
	}
	
	move(dx, dy) {
		this.x = this.x + dx;
		this.y = this.y + dy;
		//var context = this.stage.canvas.getContext('2d');
		//context.setTransform(1, 0, 0, 1, -1*this.x, -1*this.y);
	}
	getJSON(){
		return {'type':'camera', 'x': this.x, 'y' : this.y};
	}
}


class Player {
	constructor(stage, x, y, health, ammo, size, colour, outlineColour, speed, bulletRange, bulletSpeed) {
		this.stage = stage;
		this.x = x;
		this.y = y;
		this.health = health;
		this.ammo = ammo;
		this.size = size;
		this.colour = colour;
		this.outlineColour = outlineColour;
		this.speed = speed;
		this.bulletRange = bulletRange;
		this.bulletSpeed = bulletSpeed;
		this.dx = 0;
		this.dy = 0;
		this.score = 0;
		this.crosshair = new Crosshair(this.stage, MAP_CENTER_X, MAP_CENTER_Y-CROSSHAIR_DIST, CROSSHAIR_SIZE, this.colour, new Pair(0, 1));
		this.stage.addActor(this.crosshair);
		
	}
	addCamera(camera) {
		this.camera = camera;
		// Initialize context transform
		this.camera.move(0,0);
	}
	
	getCamera(){
		return this.camera;
	}
	removeCamera() {
		this.camera = null;
	}

	addHud(hud) {
		this.hud = hud;
	}
	getHud(){
		return this.hud;
	}
	
	move(dx, dy) {
	}
	
	step() {
		var normalizedDxDy = this.normalizeDxDy();
		var x_move = normalizedDxDy.x * this.speed;
		var y_move = normalizedDxDy.y * this.speed;
		var targetPosX = this.x + x_move;
		var targetPosY = this.y + y_move;
		
		if (!this.stage.moveIsInPlayableArea(this, x_move, y_move)) {
			return;
		}
		
		var canMove = true;
		var collisionObjects = this.stage.getCollision(this, x_move, y_move);
		for(var i=0;i<collisionObjects.length;i++) {
			var collisionObjectClass = collisionObjects[i].constructor.name;
			if (collisionObjectClass == "AmmoPack") {
				this.ammo = this.ammo + collisionObjects[i].amount;
				this.stage.removeActor(collisionObjects[i]);
			}
			else if (collisionObjectClass == "HealthPack") {
				// Don't go over 100 hp
				this.health = Math.min(this.health + collisionObjects[i].amount, PLAYER_START_HEALTH);
				this.stage.removeActor(collisionObjects[i]);
			}
		}
		if (canMove) {
			this.x = targetPosX;
			this.y = targetPosY;
			this.crosshair.x = this.crosshair.x + x_move;
			this.crosshair.y = this.crosshair.y + y_move;
			this.camera.move(x_move, y_move);
		}
	}
	
	setMovingRight(isMovingRight) {
		if(isMovingRight){
			this.dx = 1;
		}
		else if(this.dx == 1){
			this.dx = 0;
		}
	}
	setMovingLeft(isMovingLeft) {
		if(isMovingLeft){
			this.dx = -1;
		}
		else if(this.dx == -1){
			this.dx = 0;
		}
	}
	
	setMovingUp(isMovingUp) {
		if(isMovingUp){
			this.dy = -1;
		}
		else if(this.dy == -1){
			this.dy = 0;
		}
	}
	
	setMovingDown(isMovingDown) {
		if(isMovingDown){
			this.dy = 1;
		}
		else if(this.dy == 1){
			this.dy = 0;
		}
	}

	normalizeDxDy() {
		var normalized = new Pair(this.dx, this.dy);
		normalized.normalize();
		return normalized;
	}
	
	setdx(dx) {
		this.dx = dx;
	}
	
	setdy(dy) {
		this.dy = dy;
	}
	
	attack() {
		if (this.ammo == 0) {
			return;
		}
		var velocity = new Pair(this.crosshair.normDirVector.x * this.bulletSpeed, this.crosshair.normDirVector.y * this.bulletSpeed);
		var b = new Bullet(this.stage, this, this.getPlayerCenter(), velocity, this.colour, BULLET_SIZE, this.bulletRange);
		this.stage.addActor(b);
		this.ammo--;
	}
	
	adjustCrosshair(clientX, clientY) {
		var playerCenter = this.getPlayerCenter();
		// clientX and clientY are in camera coords, so we need to use camera coords for player
		// Player is always in the center of the camera
		var playerCameraCoordsX = CAMERA_SIZE / 2;
		var playerCameraCoordsY = CAMERA_SIZE / 2;
		var dirVector = new Pair(clientX - playerCameraCoordsX, clientY - playerCameraCoordsY);
		dirVector.normalize();
		this.crosshair.normDirVector = dirVector;
		// Crosshair position must be in canvas coords so they're drawn in the correct spot
		this.crosshair.x = playerCenter.x + dirVector.x * CROSSHAIR_DIST;
		this.crosshair.y = playerCenter.y + dirVector.y * CROSSHAIR_DIST;
		
	}
	
	getPlayerCenter() {
		return new Pair(this.x + (this.size / 2), this.y + (this.size / 2));
	}
	
	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
	
	getSize() {
		return this.size;
	}
	
	getColour() {
		return this.colour;
	}
	
	takeDamage(source, amount) {
		this.health = this.health - amount;
		if(this.health <= 0) {
			this.health = 0;
			// Killed by someone's bullet, so increment the shooter's score
			if (source.constructor.name == "Bullet") {
				source.player.incrementScore();
			}
			this.lose();
		}
	}

	heal(amount) {
		this.health = this.health + amount;
		if(this.health > 100) {
			this.health = 100;
		}
	}
	
	incrementScore() {
		this.score = this.score + 1;
	}
	
	getScoreJson() {
		return {'type':'score', 'score': this.score}
	}
	
	lose() {
		this.stage.removeActor(this);
		this.stage.removeActor(this.crosshair);
		//addScore();
		//this.wss.broadcast(this.spam_array);
	}
	
	getJSON(){
		return {'type':'rectangle', 'x': this.x, 'y' : this.y, 'width' : this.size, 'height' : this.size, 'color' : this.colour }
	}

}

class Crosshair {
	constructor(stage, x, y, size, colour, normDirVector) {
		this.stage = stage;
		this.x = x;
		this.y = y;
		this.size = size;
		this.colour = colour;
		this.normDirVector = normDirVector;
	}
	
	step() {
		
	}
	
	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
		
	takeDamage(source, amount) {
		//do nothing
	}

	getJSON(){
		return {'type':'circle', 'x': this.x, 'y' : this.y, 'size' : this.size, 'color' : this.colour };
	}

}

class AmmoPack {
	constructor(stage, x, y, colour, health, amount) {
		this.stage = stage;
		this.x = x;
		this.y = y;
		this.colour = colour;
		this.health = health;
		this.amount = amount;
		this.calcSize();
	}
	
	step() {
	}

	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
	
	getColour() {
		return this.colour;
	}
	
	calcSize() {
		this.size = (this.amount / AMMO_SIZE_DIVISOR) + AMMO_MIN_SIZE;
	}

	takeDamage(source, amount) {
		
	}

	getJSON(){
		return {'type':'rectangle', 'x': this.x, 'y' : this.y, 'width' : this.size, 'height' : this.size, 'color' : this.colour };
	}

}

class HealthPack {
	constructor(stage, x, y, colour, amount, health) {
		this.stage = stage;
		this.x = x;
		this.y = y;
		this.colour = colour;
		this.amount = amount;
		this.health = health;
		this.calcSize();
	}
	
	step() {
		
	}
	
	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
	
	getColour() {
		return this.colour;
	}
	
	calcSize() {
		this.size = (this.amount / HEALTHPACK_SIZE_DIVISOR) + HEALTHPACK_MIN_SIZE;
	}
	
	// Healthpacks can be shot for 1/2 the health by the player
	takeDamage(source, amount) {
	
	}

	getJSON(){
		return {'type':'rectangle', 'x': this.x, 'y' : this.y, 'width' : this.size, 'height' : this.size, 'color' : this.colour }
	}
}

class Bullet {
	constructor(stage, player, position, velocity, colour, size, range) {
		this.stage = stage;
		this.player = player;
		this.position = position;
		this.intPosition(); // this.x, this.y are int version of this.position
		this.velocity = velocity;
		this.colour = colour;
		this.size = size;
		this.range = range;
	}
	
	headTo(position) {
		this.velocity.x = position.x - this.position.x;
		this.velocity.y = position.y - this.position.y;
		this.velocity.normalize();
	}

	toString() {
		return this.position.toString() + " " + this.velocity.toString();
	}

	step() {
		// range measured in steps
		this.range--;
		if (this.range == 0) {
			this.stage.removeActor(this);
			return;
		}
		
		if (!this.stage.moveIsInPlayableArea(this, this.velocity.x, this.velocity.y)) {
			this.stage.removeActor(this);
			return;
		}
		
		var collisionObjects = this.stage.getCollision(this, this.velocity.x, this.velocity.y);
		for(var i=0;i<collisionObjects.length;i++) {
			if (collisionObjects[i].getColour() != this.colour) {
				collisionObjects[i].takeDamage(this, BULLET_DAMAGE);
				this.stage.removeActor(this);
			}
		}
		this.position.x = this.position.x + this.velocity.x;
		this.position.y = this.position.y + this.velocity.y;
		this.intPosition();
	}
	
	takeDamage(source, amount) {
		//do nothing
	}
		
	intPosition() {
		this.x = Math.round(this.position.x);
		this.y = Math.round(this.position.y);
	}
	
	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}
	
	getColour() {
		return this.colour;
	}

	getJSON(){
		return {'type':'circle', 'x': this.position.x, 'y' : this.position.y, 'size' : this.size/2, 'color' : this.colour }
	}
}

class Rectangle {
	constructor(x_position, y_position, colour, width, height) {
		this.x = x_position;
		this.y = y_position
		this.colour = colour;
		this.width = width;
		this.height = height;
		this.top_left = new Pair(x_position, y_position);
		this.bottom_right = new Pair(x_position + width, y_position + height);
	}
	
	playerCollides(px, py, player_size) {
		var player_top_left = new Pair(px, py);
		var player_bottom_right = new Pair(px + player_size, py + player_size);

		if (player_top_left.x > this.bottom_right.x || this.top_left.x > player_bottom_right.x) {
			// rectangles are to the left/right of eachother 
			return false;
		}
		else if (player_top_left.y > this.bottom_right.y || this.top_left.y > player_bottom_right.y) {
			// rectangles are above/below each other
			return false;
		}
		return true;
	}
	
	getJSON(){
		return {'type':'rectangle', 'x': this.x, 'y' : this.y, 'width' : this.width, 'height' : this.height, 'color' : this.colour }
	}
}

class RectangleObstacle{
	constructor(x_position, y_position, colour, width, height) {
		this.rectangle = new Rectangle(x_position, y_position, colour, width, height);
	}
	
	playerCollides(px, py, player_size) {
	  return this.rectangle.playerCollides(px, py, player_size)
	}

	step() {
		//do nothing
	}
	
	getX() {
		return this.rectangle.x;
	}
	
	getY() {
		return this.rectangle.y;
	}
	
	getColour() {
		return this.rectangle.colour;
	}
	
	takeDamage(source, amount) {
		//do nothing
	}

	getJSON(){
		return this.rectangle.getJSON();
	}
}

class LavaRectangle {
	constructor(stage, x_position, y_position, colour, width, height) {
		this.rectangle = new Rectangle(x_position, y_position, colour, width, height);
		this.stage = stage;
	}
	
	step() {
		var player_number = 0;
		var player = this.stage.getPlayer(player_number);
		while(player != null){
			if(this.rectangle.playerCollides(player.getX(), player.getY(), player.getSize())) {
				player.takeDamage(this, LAVA_DAMAGE);
			}
			player_number = player_number + 1;
			player = this.stage.getPlayer(player_number);
		}
	}

	getX() {
		return this.rectangle.x;
	}
	
	getY() {
		return this.rectangle.y;
	}
	
	getColour() {
		return this.rectangle.colour;
	}
	
	takeDamage(source, amount) {
		//do nothing
	}

	getJSON(){
		return this.rectangle.getJSON();
	}
}

class HealerRectangle {
	constructor(stage, x_position, y_position, colour, width, height) {
		this.rectangle = new Rectangle(x_position, y_position, colour, width, height);
		this.stage = stage;
	}
		
	step() {
		var player_number = 0;
		var player = this.stage.getPlayer(player_number);
		while(player != null){
			if(this.rectangle.playerCollides(player.getX(), player.getY(), player.getSize())) {
				player.heal(HEAL_TILE_HEALTH);
			}
			player_number = player_number + 1;
			player = this.stage.getPlayer(player_number);
		}
	}

	getX() {
		return this.rectangle.x;
	}
	
	getY() {
		return this.rectangle.y;
	}
	
	getColour() {
		return this.rectangle.colour;
	}
	
	takeDamage(source, amount) {
		//do nothing
	}

	getJSON(){
		return this.rectangle.getJSON();
	}
	
}


class Hud {
	constructor(player, camera, colour) {
		// Hud needs to know player info
		this.player = player;
		// Hud is tied to camera pos
		this.camera = camera;
		this.colour = colour;
	}
	
	step() {
	}
	
	getX() {
		return this.x;
	}
	
	getY() {
		return this.y;
	}	
	
	getColour() {
		return this.colour;
	}
	
	takeDamage(source, amount) {
		//do nothing
	}

	getJSON(){
		return {'type':'hud', 'health': Math.floor(this.player.health), 'ammo' : this.player.ammo, 'cameraX' : this.camera.x, 'cameraY' : this.camera.y, 'color' : this.colour }
	}

}

class Pair {
	constructor(x,y) {
		this.x = x;
		this.y = y;
	}

	toString() {
		return "("+this.x+","+this.y+")";
	}

	normalize() {
		// Avoid divide by 0
		if (this.x == 0 && this.y == 0) {
			this.x = 0;
			this.y = 0;
			return;
		}
		
		var magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
		this.x = this.x / magnitude;
		this.y = this.y / magnitude;
	}

}


var process = require('process');

var port = parseInt(process.argv[2]); 
var webSocketPort = port+1;
var express = require('express');
var cookieParser = require('cookie-parser')
const sqlite3 = require('sqlite3').verbose();

var app = express();
app.use(cookieParser()); // parse cookies before processing other middleware

var db = new sqlite3.Database('db/database.db', (err) => {
	if (err) {
		console.error(err.message);
	}
	console.log('Connected to the database.');
});
// ----------------------------------------------------------------------------------
// BEGIN: To restrict access to / 
// ----------------------------------------------------------------------------------
var user="rob", password="rob"; // REPLACE THESE TO KEEP OTHERS OUT OF YOUR APPLICATION
var id = Math.random().toString(36).substring(2, 15) + 
	Math.random().toString(36).substring(2, 15);

app.get('/login/:user/password/:password', function (req, res) {

let sql = 'SELECT COUNT(*) AS userCount FROM player where username=? and password=?;';
	db.all(sql, [req.params.user, req.params.password], (err, rows) => {
		var result = {};
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		}
		else if (rows[0] && rows[0].userCount >= 1) {
			res.send({
				"code":200,
				"success":"Login successful"
			});
		}
		else {
			res.send({
				"code":204,
				"success":"Login failed"
			});
		}
	});

});

app.post('/create/:user/password/:password', function (req, res) {

let sql = 'INSERT INTO player(username, password) VALUES (?,?);';
	db.run(sql, [req.params.user, req.params.password], (err) => {
		var result = {};
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		}
		else {
			res.send({
				"code":200,
				"success":"Account created"
			});
		}
	});
});

app.post('/addScore/:user/score/:score/date/:date', function (req, res) {

let sql = 'INSERT INTO scores(username, score, gameDate) VALUES (?,?,?);';
	db.run(sql, [req.params.user, req.params.score, req.params.date], (err) => {
		var result = {};
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		}
		else {
			res.send({
				"code":200,
				"success":"Score added"
			});
		}
	});
});


app.post('/save/:user/name/:name/anime/:anime/email/:email', function (req, res) {

let sql = 'update player set name=?, email=?, anime=? where username=?;';
	db.run(sql, [req.params.name, req.params.email, req.params.anime, req.params.user], (err) => {
		var result = {};
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		}
		else {
			res.send({
				"code":200,
				"success":"Score added"
			});
		}
	});
});


app.get('/getHighscores', function (req, res) {

let sql = 'SELECT username, score FROM scores ORDER BY score DESC LIMIT 10;';
	db.all(sql, [], (err, rows) => {
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		} else {
			var html = "<table><tr><th>User</th><th>Score</th></tr>";
			for (var i = 0; i < rows.length; i++) {
				html = html.concat("<tr><td>", rows[i].username,"</td><td>", rows[i].score,"</td></tr>");
			}
			html = html.concat("</table>");
			res.send({
				"code":200,
				"success":html
			});
		}
	});
});

app.get('/getProfile/:name', function (req, res) {

let sql = 'SELECT name,email,anime FROM player where username=?;';
	db.all(sql, [req.params.name], (err, rows) => {
  		if (err) {
			res.send({
				"code":400,
				"failed":"Error ocurred"
			});
  		} else {
			var result = JSON.stringify({'name' : rows[0].name, 'email' : rows[0].email, 'anime' : rows[0].anime});
						res.send({
				"code":200,
				"success":result
			});
		}
	});
});


// ----------------------------------------------------------------------------------
// END: To restrict access to /
// ----------------------------------------------------------------------------------

app.use('/',express.static('static_files')); // this directory has files to be returned

app.listen(port, function () {
  console.log('Example app listening on port '+port);
});

var serve = new Server(webSocketPort);