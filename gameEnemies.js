//Global Server Settings from gameSettings.js
///////////////////////////////////////////////////////////////////////////

const gameSettings = require('./gameSettings.js');



//Collision/Physics Functions from gamePhysics.js
///////////////////////////////////////////////////////////////////////////

const gamePhysics = require('./gamePhysics.js');



// object constructor for enemies
function Enemies (room) {

    //hold individual enemy objects
    this.enemies = {};

    //counter for object id's
    this.idCounter = 0;

    //save room that object exists in
    this.room = room;
}

//updates all enemies
Enemies.prototype.update = function () {

    //make sure game is not over
    if (!this.room.gameOver) {
        //spawn new wave if all enemies dead
        if (this.count() <= 0) {
            this.spawnWave();
        }

        let players = this.room.players;

        //loop through all enemies
        for (let id in this.enemies) {
            let enemy = this.enemies[id];

            //find closest player
            let closestDistance = Infinity;
            let closestId = 0;

            for (let pid in this.players) {
                if (this.players[pid].type != 'none' &&
                    this.players[pid].health > 0) {
                    let thisDistance = gamePhysics.distance(this.players[pid], enemy);
                    if (thisDistance < closestDistance) {
                        closestDistance = thisDistance;
                        closestId = pid;
                    }
                }
            }

            //reduce attack cooldown
            if (enemy.cooldown > 0) {
                enemy.cooldown -= gameSettings.tickRate;
            }

            //if a living player exists
            if (closestDistance < Infinity) {

                //get player object
                let player = this.players[closestId];

                //accelerate in direction of closest player
                let acceleration = gamePhysics.componentVector(
                    gamePhysics.angleBetween(enemy.x, enemy.y, player.x, player.y), 
                    gameSettings.enemyTypes[enemy.type].acceleration
                );
                enemy.velocity.x += acceleration.x;
                enemy.velocity.y += acceleration.y;

                //reduce velocity to max, if needed
                gamePhysics.capVelocity(enemy, gameSettings.enemyTypes[enemy.type].maxVelocity);

                //move based on velocity
                enemy.x += enemy.velocity.x
                enemy.y += enemy.velocity.y

                //attacking
                if (enemy.cooldown <= 0 &&
                    gamePhysics.isColliding(
                        enemy, gameSettings.enemyTypes[enemy.type].radius,
                        player, gameSettings.playerTypes[player.type].radius
                    )) {

                        //reset enemy cooldown
                        enemy.cooldown = gameSettings.enemyTypes[enemy.type].attack.cooldown;
                        
                        //do damage to player
                        player.health -= gameSettings.enemyTypes[enemy.type].attack.damage;
                        
                        //if player died, do not allow negative life
                        player.health = Math.max(player.health, 0);
                }
            }

            //if no living players
            else {
                //slow down
                enemy.velocity.x *= 0.95;
                enemy.velocity.y *= 0.95;

                //if slow enough, stop
                if (Math.abs(enemy.velocity.x) < 0.1) {
                    enemy.velocity.x = 0;
                }
                if (Math.abs(enemy.velocity.y) < 0.1) {
                    enemy.velocity.y = 0;
                }

                //move based on velocity
                enemy.x += enemy.velocity.x
                enemy.y += enemy.velocity.y
            }

            //boundaries
            enemy.x = Math.min(Math.max(enemy.x, 0), gameSettings.width);
            enemy.y = Math.min(Math.max(enemy.y, 0), gameSettings.height);

            //check for collisions with other enemies
            for (let eid in this.enemies) {
                if (enemy.id != eid) {
                    gamePhysics.collideAndDisplace(
                        enemy, gameSettings.enemyTypes[enemy.type].radius,
                        this.enemies[eid], gameSettings.enemyTypes[this.enemies[eid].type].radius,
                    );
                }
            }

            //check for collisions with living players
            for (let pid in this.players) {
                if (this.players[pid].type != 'none' &&
                    this.players[pid].health > 0) {
                        gamePhysics.collideAndDisplace(
                            enemy, 
                            gameSettings.enemyTypes[enemy.type].radius,
                            this.players[pid], 
                            gameSettings.playerTypes[this.players[pid].type].radius
                        );
                }
            }
        }
    }
}

//spawn a wave in
Enemies.prototype.spawnWave = function () {

    //increase wavecount of room
    this.room.waveCount++;

    //number of enemies based on number of players and wave count
    let enemyNum = this.room.playerCount() * (gameSettings.enemyMax + this.waveCount - 1);

    for (let i = 0; i < enemyNum; i++) {
        this.spawnEnemy();
    }
}

// spawn an individual enemy in
Enemies.prototype.spawnEnemy = function () {

    //use id counter as id, then increase
    let id = this.idCounter++;

    //pick randoim type for this enemy
    let type = Object.keys(gameSettings.enemyTypes)[Math.floor(Math.random()*Object.keys(gameSettings.enemyTypes).length)];

    //determine side that enemy will spawn on
    let side = Math.floor(Math.random()*4);

    //determine starting x and y based on side
    var x;
    var y;
    switch (side) {
        //top
        case 0:
            y = 0;
            x = Math.floor(Math.random()*(gameSettings.width+1));
            break;
        //bottom
        case 1:
            y = gameSettings.height;
            x = Math.floor(Math.random()*(gameSettings.width+1));
            break;
        //right
        case 2:
            y = Math.floor(Math.random()*(gameSettings.height+1));
            x = gameSettings.width;
            break;
        //left
        case 3:
            y = Math.floor(Math.random()*(gameSettings.height+1));
            x = 0;
            break;
    }

    //create enemy object
    this.enemies[id] = {
        type: type,
        x: x,
        y: y,
        velocity: {
            x:0,
            y:0,
        },
        health: gameSettings.enemyTypes[type].maxHealth,
        cooldown: 0,
    }
}

Enemies.prototype.count = function () {
    return Object.keys(this.enemies).length;
}

//collects info on enemies to send to clients
Enemies.prototype.collect = function () {

    let enemy_info = {};

    for (let id in this.enemies) {
        let enemy = this.enemies[id];
        enemy_info[id] = {
            x: enemy.x,
            y: enemy.y,
            type: enemy.type,
            health: enemy.health,
        };
    }
    
    return enemy_info;
}

module.exports = Enemies;