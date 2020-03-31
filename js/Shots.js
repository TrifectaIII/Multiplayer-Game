//Global Server Settings from gameSettings.js
///////////////////////////////////////////////////////////////////////////

const gameSettings = require(__dirname + '/gameSettings.js');


//Collision/Physics Functions from Physics.js
///////////////////////////////////////////////////////////////////////////

const Physics = require(__dirname + '/Physics.js');
const QT = require(__dirname +'/Qtree.js');



// object constructor for enemies
function Shots (room) {

    //hold individual shot objects
    this.shots = {};

    //counter for object id's
    this.idCounter = 0;

    //save room that object exists in
    this.room = room;
}

Shots.prototype.update = function () {

    if (!this.room.gameOver) {
        //loop through all shots
        for (let id in this.shots) {
            let shot = this.shots[id];

            //move based on velocity
            shot.x += shot.velocity.x;
            shot.y += shot.velocity.y;

            let destroyed = false;

            // check for collisions with enemies

            let nearby_objs = this.room.Quadtree.query(new QT.QT_bound(shot.x,shot.y,100,100));

            for (let id in nearby_objs) {
                let enemy = nearby_objs[id];

                if (enemy.obj_type =="enemy" ) {
                    if (Physics.isColliding(
                            enemy, gameSettings.enemyTypes[enemy.type].radius, 
                            shot, 0 //shots have no radius
                        )) {
                            //remove health based on class
                            if (enemy.health > 0) {
                                enemy.health -= gameSettings.playerTypes[shot.type].shots.damage;
                                destroyed = true;

                                Physics.collideShotEnemy(shot,enemy);

                                //check if enemy died
                                if (enemy.health <= 0) {

                                    //increase killStreak
                                    if (shot.playerId in this.room.players.players) {
                                        this.room.players.players[shot.playerId].killStreak++;
                                    }
                                    //delete enemy
                                    delete this.room.enemies.enemies[this.findIndexOfEnemy(enemy)]
                                }
                            }
                    }
                } 
            }

            //remove range based on velocity
            shot.range -= gameSettings.playerTypes[shot.type].shots.velocity;
            
            //destroy if out of range
            destroyed = destroyed || shot.range <= 1;
            
            //delete if destroyed
            if (destroyed) {
                delete this.shots[id];
            }
        }
    }
}


//create a new shot
Shots.prototype.spawnShot = function (player, destX, destY) {

    //each class shoots differently
    let classShots = gameSettings.playerTypes[player.type].shots;

    //single-shot classes
    if (classShots.count <= 1) {
        
        //calculate velocity based on shot velocity and where the player clicked
        let velocity = Physics.componentVector(
            Physics.angleBetween(player.x, player.y, destX, destY), 
            classShots.velocity
        );

        //use id counter as id, then increase
        let id = this.idCounter++;
        //create new object
        this.shots[id] = {
            x: player.x,
            y: player.y,
            type: player.type,
            playerId: player.id,
            velocity: velocity,
            range: classShots.range,
        };
    }

    //multi-shot (shotgun) classes
    else {
        for (let i = 0; i < classShots.count; i++) {

            //calculate velocity based on shot velocity and where the player clicked and spread
            let velocity = Physics.componentVector(
                Physics.angleBetween(
                    player.x, player.y, 
                    destX, destY
                ) 
                + (i - classShots.count/2 + 0.5) 
                * (classShots.angle/(classShots.count-1)),
                classShots.velocity
            );

            //use id counter as id, then increase
            let id = this.idCounter++;
            //create new object
            this.shots[id] = {
                x: player.x,
                y: player.y,
                type: player.type,
                playerId: player.id,
                velocity: velocity,
                range: classShots.range,
            };
        }
    }
}  

// collect info on shot objects
Shots.prototype.collect = function () {

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

Shots.prototype.findIndexOfEnemy = function (enemy) {

    for( i in this.room.enemies.enemies){
        let e= this.room.enemies.enemies[i]
        if (e.x == enemy.x && e.y == enemy.y){
            return i;
        }
    }
}

module.exports = Shots;