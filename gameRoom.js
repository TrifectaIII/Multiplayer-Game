


//Global Server Settings from gameSettings.js
///////////////////////////////////////////////////////////////////////////

const gameSettings = require('./gameSettings.js');



//Collision Functions from collisions.js
///////////////////////////////////////////////////////////////////////////

const collisions = require('./collisions.js');



// Helper Functions
///////////////////////////////////////////////////////////////////////////

//returns random integer between low and high, inclusive
function randint(low,high) {
    if (high > low) {
        return Math.floor(Math.random() * (high - low + 1) + low);
    }
    return Math.floor(Math.random() * (low - high + 1) + high);
}

//calculates angle of vector between player position and shot destination
function angle(x, y, dest_x, dest_y) {
    return Math.atan2(dest_x - x, dest_y - y);
}

//calculates component velocities of shot based on angle and net speed
function velocity(ang, speed) {
    return {
        x:Math.sin(ang) * speed,
        y:Math.cos(ang) * speed,
    };
}



// ROOM CONSTRUCTOR
///////////////////////////////////////////////////////////////////////////

//constructor for room objects
function Room (roomId) {

    this.roomId = roomId;

    //hold info about game objects
    this.players = {};
    this.shots = {};
    this.pickups = {};
    this.enemies = {};

    //counters for object ids
    this.shotIdCounter = 0;
    this.pickupIdCounter = 0;
    this.enemyIdCounter = 0;

    //spawn pickups
    this.pickupSpawner = setInterval(
        this.spawnPickup.bind(this), //bind to room scope
        gameSettings.pickupTime //interval from game settings
    );

    //counts each enemy wave
    this.waveCount = 0;

    //how many lives the players have left
    this.livesCount = 3;

    //how many players have joined at any time, up to 4
    this.playersSeen = 0;

    //switch for if the game is over
    this.gameOver = false;
}



// ROOM UPDATE
///////////////////////////////////////////////////////////////////////////

//called every gameSettings.tickRate ms in index.js
Room.prototype.update = function () {

    //check for a game over
    let gameOver = true;

    //if lives left, not a game over
    if (this.livesCount > 0) {
        gameOver = false;
    }
    //if any players alive, not a game over
    for (let id in this.players) {
        if (this.players[id].health > 0) {
            gameOver = false;
        }
    }
    this.gameOver = gameOver;

    //return game info for emit to room
    return {
        player_info: this.updatePlayers(),
        shot_info: this.updateShots(),
        pickup_info: this.updatePickups(),
        enemy_info: this.updateEnemies(),

        game_info: {
            waveCount: this.waveCount,
            livesCount: this.livesCount,
            gameOver: this.gameOver,
        },
    }
}

//UPDATE SHOTS 
/////////////////////////////////////////

Room.prototype.updateShots = function () {

    if (!this.gameOver) {
        //loop through all shots
        for (let id in this.shots) {
            let shot = this.shots[id];

            //move based on velocity
            shot.x += shot.velocity.x;
            shot.y += shot.velocity.y;

            let destroyed = false;

            // check for collisions with enemys
            for (let id in this.enemies) {
                let enemy = this.enemies[id];
                if (collisions.collide(
                        enemy, gameSettings.enemies[enemy.type].radius, 
                        shot, 0
                    )) {
                        //remove health
                        if (enemy.health > 0) {
                            enemy.health--;
                            destroyed = true;
                            if (enemy.health <= 0) {
                                if (shot.playerId in this.players) {
                                    this.players[shot.playerId].killStreak++;
                                }
                                delete this.enemies[id];
                            }
                        }
                } 
            }

            //remove range based on speed
            shot.range -= gameSettings.classes[shot.type].shots.speed;
            
            //destroy if out of range
            destroyed = destroyed || shot.range <= 1;
            
            //delete if destroyed
            if (destroyed) {
                delete this.shots[id];
            }
        }
    }

    // collect info on remaining shots
    var shot_info = {};
    
    for (let id in this.shots) {
        let shot = this.shots[id];
        shot_info[id] = {
            x: shot.x,
            y: shot.y,
            type: shot.type,
        };
    }

    return shot_info;
}

//UPDATE PLAYERS
/////////////////////////////////////////

Room.prototype.updatePlayers = function () {

    //respawn any dead players
    for (let id in this.players) {
        let player = this.players[id];
        if (player.type != 'none' &&
            !player.respawning &&
            player.health <= 0) {

                //mark as respawning
                player.respawning = true;

                //if game not over, wait for respawn time
                if (!this.gameOver) {
                    //set to respawn and choose new class
                    setTimeout(function () {
                        //ask for new class choice on respawn
                        player.type = 'none';
                        player.emit('player_died');
                    }.bind(this), 
                    //respawn time from settings
                    gameSettings.respawnTime);
                }

                //if game over, do it automatically
                else {
                    player.type = 'none';
                    player.emit('player_died');
                }
        }
    }

    if (!this.gameOver) {
        //loop through all players
        for (let id in this.players) {
            let player = this.players[id];

            //ask for class if not chosen
            if (player.type == 'none') {
                continue;
            }

            //reduce shot cooldown
            player.cooldown -= gameSettings.tickRate;

            //shoot for player if clicking and no cooldown
            if (player.clicking && 
                player.cooldown <= 0 &&
                player.health > 0) {
                    this.playerShoot(player);
                    //start cooldown
                    player.cooldown = gameSettings.classes[player.type].shots.cooldown;
            }
            
            //move player based on direction
            if (player.health > 0) {

                //speed is set by class
                let speed = gameSettings.classes[player.type].speed;
                let speedComponent = speed/(Math.sqrt(2));

                //move based on direction sent by client
                switch (player.direction) {
                    case 'none':
                        break;
                    //diagonal movements use component speed
                    case 'rightup':
                        player.x += speedComponent;
                        player.y -= speedComponent;
                        break;
                    case 'leftup':
                        player.x -= speedComponent;
                        player.y -= speedComponent;
                        break;
                    case 'rightdown':
                        player.x += speedComponent;
                        player.y += speedComponent;
                        break;
                    case 'leftdown':
                        player.x -= speedComponent;
                        player.y += speedComponent;
                        break;
                    //cardinal movements use raw speed
                    case 'right':
                        player.x += speed;
                        break;
                    case 'left':
                        player.x -= speed;
                        break;
                    case 'up':
                        player.y -= speed;
                        break;
                    case 'down':
                        player.y += speed;
                        break;
                }

                //check for collisions with other players
                for (let pid in this.players) {
                    if (player.id != pid && 
                        player.type != 'none' &&
                        this.players[pid].health > 0) {
                            collisions.collideAndDisplace(
                                player, 
                                gameSettings.classes[player.type].radius,
                                this.players[pid], 
                                gameSettings.classes[this.players[pid].type].radius
                            );
                    }
                }

                //boundaries
                player.x = Math.min(Math.max(player.x, 0), gameSettings.width);
                player.y = Math.min(Math.max(player.y, 0), gameSettings.height);
            }
        }
    }

    //collect info on players
    let player_info = {};

    for (let id in this.players) {
        let player = this.players[id];
        player_info[id] = {
            x: player.x,
            y: player.y,
            type: player.type,
            health: player.health,
            name: player.name,
            killStreak: player.killStreak,
        };
    }
    
    return player_info;
}

//UPDATE ENEMIES
/////////////////////////////////////////

Room.prototype.updateEnemies = function () {

    if (!this.gameOver) {
        //spawn new wave if all enemies dead
        if (this.enemyCount() <= 0) {
            this.spawnWave();
        }

        //loop through all enemies
        for (let id in this.enemies) {
            let enemy = this.enemies[id];

            //find closest player
            let closestDistance = Infinity;
            let closestId = 0;
            for (let pid in this.players) {
                if (this.players[pid].type != 'none' &&
                    this.players[pid].health > 0) {
                    let thisDistance = collisions.distance(this.players[pid], enemy);
                    if (thisDistance < closestDistance) {
                        closestDistance = thisDistance;
                        closestId = pid;
                    }
                }
            }

            //reduce attack cooldown
            if (enemy.attackCooldown > 0) {
                enemy.attackCooldown -= gameSettings.tickRate;
            }

            if (closestDistance < Infinity) {
                let player = this.players[closestId];

                //move in direction of closest player
                let ang = angle(enemy.x, enemy.y, player.x, player.y);
                let vel = velocity(ang, gameSettings.enemies[enemy.type].speed);
                enemy.x += vel.x;
                enemy.y += vel.y;

                //attacking
                if (enemy.attackCooldown <= 0 &&
                    collisions.collide(
                        enemy, gameSettings.enemies[enemy.type].radius,
                        player, gameSettings.classes[player.type].radius
                    )) {

                        //reset enemy cooldown
                        enemy.attackCooldown = gameSettings.enemies[enemy.type].attackCooldown;
                        
                        //do damage to player
                        player.health -= gameSettings.enemies[enemy.type].attackDamage;
                        
                        //if player died, do not allow negative life
                        player.health = Math.max(player.health, 0);
                }
            }

            //check for collisions with other enemies
            for (let eid in this.enemies) {
                if (enemy.id != eid) {
                    collisions.collideAndDisplace(
                        enemy, gameSettings.enemies[enemy.type].radius,
                        this.enemies[eid], gameSettings.enemies[this.enemies[eid].type].radius,
                    );
                }
            }

            //check for collisions with living players
            for (let pid in this.players) {
                if (this.players[pid].type != 'none' &&
                    this.players[pid].health > 0) {
                        collisions.collideAndDisplace(
                            enemy, 
                            gameSettings.enemies[enemy.type].radius,
                            this.players[pid], 
                            gameSettings.classes[this.players[pid].type].radius
                        );
                }
            }
        }
    }

    //collect info on enemies
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

//UPDATE PICKUPS
/////////////////////////////////////////

Room.prototype.updatePickups = function () {

    if (!this.gameOver) {
        //loop through all pickups
        for (let id in this.pickups) {
            let pickup = this.pickups[id];

            //find closest alive player
            let closestDistance = Infinity;
            let closestId = 0;
            for (let pid in this.players) {
                if (this.players[pid].type != 'none' &&
                    this.players[pid].health > 0) {
                    let thisDistance = collisions.distance(this.players[pid], pickup);
                    if (thisDistance < closestDistance) {
                        closestDistance = thisDistance;
                        closestId = pid;
                    }
                }
            }

            let player = this.players[closestId];

            //if player is close enough
            if (closestDistance < Infinity &&
                collisions.collide(
                    player, 
                    gameSettings.classes[player.type].radius,
                    pickup, 
                    gameSettings.pickupRadius
                )
            ) {
                switch (pickup.type) {
                    case "health":
                        //if player not at max health
                        if (player.health < gameSettings.classes[player.type].maxHealth) {
                            //give health and delete pickup
                            player.health = Math.min(
                                gameSettings.classes[player.type].maxHealth,
                                player.health + gameSettings.pickupHealthAmount
                            );
                            delete this.pickups[id];
                        }
                        break;
                }
            }
        }
    }

    //collect info for clients
    let pickup_info = {};

    for (let id in this.pickups) {
        let pickup = this.pickups[id];
        pickup_info[id] = {
            x: pickup.x,
            y: pickup.y,
            type: pickup.type,
        }
    }

    return pickup_info;
}



// ADD SOCKET TO ROOM AND SET IT UP
///////////////////////////////////////////////////////////////////////////

Room.prototype.addPlayer = function (player) {
    if (!this.isFull()) {

        //add to players object
        this.players[player.id] = player;

        //join socketio room
        player.join(this.roomId);

        //set roomId to socket
        player.roomId = this.roomId;

        //start killStreak at 0
        player.killStreak = 0;

        //SET UP LISTENERS
        /////////////////////////////////

        //give default class
        player.type = 'none';

        //if haven't seen enough players to meet cap yet, give a life
        if (!this.gameOver &&
            this.playersSeen < gameSettings.roomCap) {
            this.livesCount++;
            this.playersSeen++;
        }

        //set class based on player choice
        player.on ('class_choice', function (type) {
            //only change if valid choice and a life exists
            if (this.livesCount > 0 &&
                player.type == 'none' &&
                type in gameSettings.classes) {

                //set class
                player.type = type;

                //subtract life
                this.livesCount--;
                
                //spawn player in

                //mark as not respawning
                player.respawning = false;
                
                //give random position in world
                player.x = randint(100, gameSettings.width - 100);
                player.y = randint(100, gameSettings.height - 100);

                //give max health based on 
                player.health = gameSettings.classes[player.type].maxHealth;

                //reset killstreak
                player.killStreak = 0;

                //tell player he is spawned
                player.emit('player_spawned');
            }
        }.bind(this));//bind to room scope

        //give default direction
        player.direction = 'none';

        //switch player direction
        player.on('direction', function (direction) {

            player.direction = direction;

        });

        //give default click value
        player.clicking = false;

        //start with no shooting cooldown
        player.cooldown = 0;

        //start with no ready shots
        player.readyShots = 0;

        //switch clicking state
        player.on('click', function (clicking) {

            player.clicking = clicking;
            
            //shoot right away to avoid a click getting clipped by tickRate
            if (player.clicking && 
                player.cooldown <= 0 &&
                player.health > 0) {
                    this.playerShoot(player);
                    //start cooldown
                    player.cooldown = gameSettings.classes[player.type].shots.cooldown;
            }
        }.bind(this));//bind to room scope

        //handle shooting
        player.on('shoot', function (dest_x, dest_y) {
            //only shoot if alive and have ready shots
            if (player.health > 0 && player.readyShots > 0) {

                //remove 1 ready shot
                player.readyShots--;
                        
                //each class shoots differently
                let myClass = gameSettings.classes[player.type];

                //single-shot classes
                if (myClass.shots.count == 1) {
                    //calculate velocity based on shot speed and where the player clicked
                    vel = velocity(
                        angle(player.x, player.y, dest_x, dest_y), 
                        myClass.shots.speed
                    );

                    //use id counter as id, then increase
                    var id = this.shotIdCounter++;
                    //create new object
                    this.shots[id] = {
                        x: player.x,
                        y: player.y,
                        type: player.type,
                        playerId: player.id,
                        velocity: vel,
                        range: myClass.shots.range,
                    };
                }

                //multi-shot (shotgun) classes
                else {
                    for (let i = 0; i < myClass.shots.count; i++) {

                        let vel = velocity(
                            angle(
                                player.x, player.y, 
                                dest_x, dest_y
                            ) 
                            + (i - myClass.shots.count/2 + 0.5) 
                            * (myClass.shots.angle/(myClass.shots.count-1)),
                            myClass.shots.speed
                        );

                        //use id counter as id, then increase
                        var id = this.shotIdCounter++;
                        //create new object
                        this.shots[id] = {
                            x: player.x,
                            y: player.y,
                            type: player.type,
                            playerId: player.id,
                            velocity: vel,
                            range: myClass.shots.range,
                        };
                    }
                }
            }
        }.bind(this));//bind to room scope

        //restart game if client requests and game is over
        player.on('restart_game', function () {
            //make sure game is actually over

            //reset all players
            if (this.gameOver) {
                for (let id in this.players) {
                    this.players[id].health = 0;
                    this.players[id].type = 'none';
                }

                //reset room
                this.enemies = {};
                this.shots = {};
                this.pickups = {};
                this.shotIdCounter = 0;
                this.pickupIdCounter = 0;
                this.enemyIdCounter = 0;

                clearInterval(this.pickupSpawner);
                this.pickupSpawner = setInterval(
                    this.spawnPickup.bind(this), //bind to room scope
                    gameSettings.pickupTime //interval from game settings
                );

                this.waveCount = 0;
                this.playersSeen = this.playerCount();
                this.livesCount = 3 + this.playerCount();
                this.gameOver = false;
            }
        }.bind(this));//bind to room scope

        //confirm join with server after player totally set up
        player.emit('joined',this.roomId);
    }
}



// OTHER ROOM METHODS
///////////////////////////////////////////

//remove socket if socket exists in room
Room.prototype.removePlayer = function (player) {
    if (player.id in this.players) {
        delete this.players[player.id];
    }
}

//creates shots from given player to given spot based on class
Room.prototype.playerShoot = function (player) {

    //add 1 to ready shots
    player.readyShots++;

    //ask for coordinates
    player.emit('shoot_request');
}

//spawns pickup into the room
Room.prototype.spawnPickup = function () {
   
    if (Object.keys(this.pickups).length < this.playerCount() * gameSettings.pickupMax) {
        //use id counter as id, then increase
        let id = this.pickupIdCounter++;
        this.pickups[id] = {
            //choose a random type from the settings list
            type: gameSettings.pickupTypes[randint(0, gameSettings.pickupTypes.length-1)],
            x: randint(100, gameSettings.width-100),
            y: randint(100, gameSettings.height-100),
        }
    }
}

//spawns a wave of enemies around the edge of the game area
Room.prototype.spawnWave = function () {
    this.waveCount += 1;

    //cap based on number of players and wave count
    let enemyCap = this.playerCount() * (gameSettings.enemyMax + this.waveCount - 1);

    for (let i = 0; i < enemyCap; i++) {

        //use id counter as id, then increase
        let id = this.enemyIdCounter++;

        //pick randoim type for this enemy
        let type = Object.keys(gameSettings.enemies)[randint(0, Object.keys(gameSettings.enemies).length -1)];

        //determine side that enemy will spawn on
        let side = randint(1,4);

        //determine starting x and y
        var x;
        var y;
        switch (side) {
            //top
            case 1:
                y = 0;
                x = randint(0, gameSettings.width);
                break;
            //bottom
            case 2:
                y = gameSettings.height;
                x = randint(0, gameSettings.width);
                break;
            //right
            case 3:
                y = randint(0, gameSettings.height);
                x = gameSettings.width;
                break;
            //left
            case 4:
                y = randint(0, gameSettings.height);;
                x = 0;
                break;
        }

        this.enemies[id] = {
            type: type,
            x: x,
            y: y,
            health: gameSettings.enemies[type].maxHealth,
            attackCooldown: 0,
        }
    }
}

//count then number of enemies in the room
Room.prototype.enemyCount = function () {
    return Object.keys(this.enemies).length;
}

//get current population of room
Room.prototype.playerCount = function () {
    return Object.keys(this.players).length;
}

//checks if room is full of players
Room.prototype.isFull = function () {
    return this.playerCount() >= gameSettings.roomCap;
}

//checks if room is empty
Room.prototype.isEmpty = function () {
    return this.playerCount() == 0;
}

//stops timing events for the room
Room.prototype.shutdown = function () {
    clearInterval(this.pickupSpawner);
}



// EXPORTS CONSTRCTOR TO index.js
///////////////////////////////////////////////////////////////////////////
module.exports = Room;