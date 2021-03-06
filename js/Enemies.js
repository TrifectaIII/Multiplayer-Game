//Global Server Settings from gameSettings.js
///////////////////////////////////////////////////////////////////////////

const gameSettings = require(__dirname + '/../gameSettings.js');


//Container Class for Extending from Container.js
///////////////////////////////////////////////////////////////////////////

const Container = require(__dirname + '/Container.js');


//Collision/Physics Functions from Physics.js
///////////////////////////////////////////////////////////////////////////

const Physics = require(__dirname + '/Physics.js');
const QT = require(__dirname +'/Qtree.js');


//class for individual enemy
class Enemy {

    constructor(id, type, x, y) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.velocity = {
            x: 0,
            y: 0,
        };
        this.health = gameSettings.enemyTypes[this.type].maxHealth;
        this.cooldown = 0;
    }

    //return enemy radius
    getRadius() {
        return gameSettings.enemyTypes[this.type].radius;
    }

    //return enemy max speed 
    getMaxSpeed() {
        return gameSettings.enemyTypes[this.type].maxVelocity;
    }

    //return enemy acceleration magnitude
    getAcceleration() {
        return gameSettings.enemyTypes[this.type].acceleration;
    }
    
    //return acceleration adjusted for tickrate
    getTickAcceleration () {
        return gameSettings.enemyTypes[this.type].acceleration/gameSettings.tickRate;
    }

    //return current velocity adjusted for tickrate
    getTickVelocity () {
        return {
            x: this.velocity.x/gameSettings.tickRate,
            y: this.velocity.y/gameSettings.tickRate
        }
    }

    //return enemy mass
    getMass() {
        return gameSettings.enemyTypes[this.type].mass;
    }

    //return info about enemy attacks
    getAttackInfo() {
        return gameSettings.enemyTypes[this.type].attack;
    }

    //return info about enemy shots
    getShotInfo() {
        return gameSettings.enemyTypes[this.type].shots;
    }
}


// class for enemies container
class Enemies extends Container {

    constructor(room) {

        //call Container constructor
        super(room);

        //counter for object id's
        this.idCounter = 0;
    }

    //updates all enemies
    update() {


        //get player and ability objects from room
        let players = this.room.players.playing;
        let abilities = this.room.abilities.objects;

        //loop through all enemies
        for (let id in this.objects) {
            let enemy = this.objects[id];


            //dont update if inside a freeze ability
            let frozen = false;
            for (let aid in abilities) {
                let ability = abilities[aid];
                if (
                    ability.constructor.name === 'Freeze' && 
                    Physics.distance(ability, enemy) <= gameSettings.abilityTypes.freeze.radius
                ){
                        frozen=true;
                        break;
                } 
            }
            if (frozen) continue;

            //find closest player
            let closestDistance = Infinity;
            let closestId = 0;

            for (let pid in players) {
                if (players[pid].health > 0) {
                    let thisDistance = Physics.distance(players[pid], enemy);
                    if (thisDistance < closestDistance) {
                        closestDistance = thisDistance;
                        closestId = pid;
                    }
                }
            }

            //reduce attack cooldown
            if (enemy.cooldown > 0) {
                enemy.cooldown -= (1000/gameSettings.tickRate);
            }

            //degrade velocities with drag factor
            //get normalized velocity vector
            let dragAccel = Physics.normalizeVector(enemy.velocity);
            //factor in acceleration magnitude and drag factor
            dragAccel.x *= enemy.getTickAcceleration() * gameSettings.dragFactor * -1;
            dragAccel.y *= enemy.getTickAcceleration() * gameSettings.dragFactor * -1;
            //change velocity using drag
            enemy.velocity.x += dragAccel.x;
            enemy.velocity.y += dragAccel.y;

            //if a living player exists
            if (closestDistance < Infinity) {

                //get player object
                let player = players[closestId];

                //accelerate in direction of closest player
                let acceleration = Physics.componentVector(
                    Physics.angleBetween(enemy.x, enemy.y, player.x, player.y),
                    enemy.getTickAcceleration()
                );
                enemy.velocity.x += acceleration.x;
                enemy.velocity.y += acceleration.y;

                //reduce velocity to max, if needed
                Physics.capVelocity(enemy, enemy.getMaxSpeed());

                //move based on velocity
                let tickVel = enemy.getTickVelocity();
                enemy.x += tickVel.x;
                enemy.y += tickVel.y;

                //attacking
                //check for off cooldown
                if (enemy.cooldown <= 0) {

                    //shoot if enemy type has shots are are in range
                    if (enemy.getShotInfo() &&
                        enemy.getShotInfo().range >= Physics.distance(enemy, player) - player.getRadius()) {

                        //reset enemy cooldown
                        enemy.cooldown = enemy.getAttackInfo().cooldown;

                        //shoot at player
                        this.room.shots.spawnEnemyShot(enemy, player.x, player.y);
                    }
                    else if (Physics.isColliding(
                        enemy, enemy.getRadius(),
                        player, player.getRadius()
                    )) {

                        //reset enemy cooldown
                        enemy.cooldown = enemy.getAttackInfo().cooldown;

                        //do damage to player
                        this.room.players.damagePlayer(player, enemy.getAttackInfo().damage);
                    }
                }
            }

            //boundaries
            enemy.x = Math.min(Math.max(enemy.x, 0), gameSettings.width);
            enemy.y = Math.min(Math.max(enemy.y, 0), gameSettings.height);
            let near_by_objects = this.room.Quadtree.query(new QT.QT_bound(enemy.x, enemy.y, 150, 150));

            //check for collisions with other enemies
            for (let i in near_by_objects) {
                //recall that near_by_objects is a list of lists: [[object_id, object_data]...]
                let obj = near_by_objects[i];
                if (obj.constructor.name == "Enemy") {
                    if (enemy.id != obj.id) {
                        Physics.collideAndDisplace(
                            enemy,
                            enemy.getRadius(),
                            obj,
                            obj.getRadius()
                        );
                    }
                }
                else if (obj.constructor.name == "Player") {

                    if (obj.id in this.room.players.playing &&
                        obj.health > 0) {
                        Physics.collideAndDisplace(
                            enemy,
                            enemy.getRadius(),
                            obj,
                            obj.getRadius()
                        );
                    }
                }
            }
        }
    }

    // spawn an individual enemy in
    spawnEnemy() {
        
        var type;
        //if mono wave, choose that type
        if (this.room.waveType in gameSettings.enemyTypes) {
            type = this.room.waveType;
        }
        //otherwise choose randomly
        else {
            //pick random type for this enemy
            type = Object.keys(gameSettings.enemyTypes)[Math.floor(Math.random() * Object.keys(gameSettings.enemyTypes).length)];
        }

        //determine side that enemy will spawn on
        let side = Math.floor(Math.random() * 4);

        //determine starting x and y based on side
        var x;
        var y;
        switch (side) {
            //top
            case 0:
                y = 0;
                x = Math.floor(Math.random() * (gameSettings.width + 1));
                break;
            //bottom
            case 1:
                y = gameSettings.height;
                x = Math.floor(Math.random() * (gameSettings.width + 1));
                break;
            //right
            case 2:
                y = Math.floor(Math.random() * (gameSettings.height + 1));
                x = gameSettings.width;
                break;
            //left
            case 3:
                y = Math.floor(Math.random() * (gameSettings.height + 1));
                x = 0;
                break;
        }

        //use id counter as id, then increase
        let id = 'enemy' + (this.idCounter++).toString();

        //create enemy object
        this.objects[id] = new Enemy(id, type, x, y);
    }

    //damages an individual enemy
    damageEnemy(enemy, amount, playerId) {

        //subtract health
        enemy.health -= amount;

        // if enemy died
        if (enemy.health <= 0) {

            //give player credit for the kill
            if (playerId in this.room.players.objects) {
                this.room.players.giveKillCredit(this.room.players.objects[playerId]);
            }

            //drop pickup based on chance
            if (Math.random() < gameSettings.enemyDropChance) {
                this.room.pickups.spawnPickup(enemy.x, enemy.y);
            }

            //delete enemy
            delete this.objects[enemy.id];
        }
    }

    //collects info on enemies to send to clients
    collect() {

        let enemy_info = {};

        for (let id in this.objects) {
            let enemy = this.objects[id];
            enemy_info[id] = {
                x: enemy.x,
                y: enemy.y,
                type: enemy.type,
                health: enemy.health,
            };
        }

        return enemy_info;
    }
}

//export to room
module.exports = Enemies;