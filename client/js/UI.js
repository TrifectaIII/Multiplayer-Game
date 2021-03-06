//code for drawing game ui
var UI = {

    //conglomerate draw function for game UI
    drawUI: function (socket, gameState) {

        push();

        //if player is actively playing
        if (socket.id in gameState.players.playing) {

            //get player object
            let player = gameState.players.playing[socket.id];

            //draw player health and ability bar
            this.drawHealthBar(player);
            this.drawAbilityBar(player);

            //draw boss healthbar
            this.drawBossBar(gameState);

            //draw minimap
            this.drawMiniMap(gameState, player);

            //draw info about the current Room
            this.drawRoomInfo(gameState, gameSettings.playerTypes[player.type].colors.dark);

            //draw names of players
            this.drawPlayerInfo(gameState);

            //draw countdown to next wave
            this.drawWaveCountdown(gameState);

            //draw fps counter
            this.drawTechInfo(gameState, gameSettings.playerTypes[player.type].colors.dark);

            // draw crosshair
            this.drawCrosshair(gameSettings.playerTypes[player.type].colors.dark);

        }

        //if player not in game
        else {

            //draw boss healthbar
            this.drawBossBar(gameState);

            //draw minimap
            this.drawMiniMap(gameState);

            //draw info about the current Room
            this.drawRoomInfo(gameState, gameSettings.colors.darkgrey);

            //draw names of players
            this.drawPlayerInfo(gameState);

            //draw countdown to next wave
            this.drawWaveCountdown(gameState);

            //draw fps counter
            this.drawTechInfo(gameState, gameSettings.colors.darkgrey);

            //draw death menus
            if (socket.id in gameState.players.waiting) {
                this.drawDeathMenus(gameState);
            }

            // draw crosshair
            this.drawCrosshair(gameSettings.colors.darkgrey);
        }

        pop();
    },

    //draw a progress bar
    drawBar: function (options) {

        //set defaults for options
        let defaults = {
            x: 0,
            y: 0,
            w: 100,
            h: 10,
            color: 'white',
            prog: 0.5,
            leftText: '',
            rightText: '',
            fontSize: 25,
        }

        if(!options) {options = {}};

        for (let option in defaults) {
            if (options[option] === undefined) {
                options[option] = defaults[option];
            }
        }

        //prog is ratio from 0 to 1
        options.prog = Math.min(1,Math.max(0, options.prog));

        push();
        
        //draw bar
        fill('black');
        strokeWeight(0);
        rect(
            options.x-options.w/2, options.y-options.h/2,
            options.w, options.h,
        );
        fill(options.color);
        rect(
            options.x-options.w/2+2, options.y - options.h/2 + 2,
            (options.w-4)*(options.prog), options.h-4
        );

        //draw texts
        stroke('black');
        strokeWeight(4);
        textSize(options.fontSize);
        fill(gameSettings.colors.white);

        //first text (left side)
        textAlign(LEFT, CENTER);
        text(
            options.leftText,
            options.x - options.w/2 + 8,
            options.y - options.h/2 + (options.h-4)/2
        );

        //second text(right side)
        textAlign(RIGHT, CENTER);
        text(
            options.rightText,
            options.x + options.w/2 - 8,
            options.y - options.h/2 + (options.h-4)/2
        );

        pop();
    },

    //draw client player healthbar
    drawHealthBar: function (player) {

        this.drawBar({
            x: width*3/8 - 10,
            y: height - 40,
            w: width/4,
            h: 40,
            color: gameSettings.playerTypes[player.type].colors.light,
            prog: player.health/gameSettings.playerTypes[player.type].maxHealth,
            leftText: 'Health',
            rightText: player.health.toString()+' / '+ gameSettings.playerTypes[player.type].maxHealth.toString(),
        })
    },

    //draw client player ability progress bar
    drawAbilityBar: function (player) {

        //if no ability is active and bar not full
        if (player.abilityProgress !== gameSettings.abilityCap) {
            let color = gameSettings.colors.red;
            this.drawBar({
                x: width*5/8 + 10,
                y: height - 40,
                w: width/4,
                h: 40,
                color: color,
                prog: player.abilityProgress/gameSettings.abilityCap,
                leftText: 'Ability: '+ gameSettings.playerTypes[player.type].ability.toUpperCase(),
                rightText: player.abilityProgress.toString()+' / '+ gameSettings.abilityCap.toString(),
            });

            return;
        }

        //if ability ready
        let color = Animation.getColor();
        this.drawBar({
            x: width*5/8 + 10,
            y: height - 40,
            w: width/4,
            h: 40,
            color: color,
            prog: player.abilityProgress/gameSettings.abilityCap,
            leftText: 'Ability: '+ gameSettings.playerTypes[player.type].ability.toUpperCase(),
            rightText: 'Press SPACE',
        });
    },

    //draw boss's healthbar
    drawBossBar: function (gameState) {
        //only draw in boss exists
        if (Object.keys(gameState.bosses).length > 0) {
            let boss = gameState.bosses[Object.keys(gameState.bosses)[0]];
            this.drawBar({
                x: width/2,
                y: 40,
                w: width/2,
                h: 40,
                color: gameSettings.boss.colors.light,
                prog: boss.health/boss.maxHealth,
                leftText: 'Boss',
                rightText: boss.health.toString()+' / '+ boss.maxHealth.toString(),
            })
        }
    },

    //draws minimap, player argument optional
    drawMiniMap: function (gameState, player) {

        //settings for the minimap
        let minimapWidth = Math.min(250, Math.max(width/6, height/6));
        let minimapHeight = (minimapWidth/gameSettings.width) * gameSettings.height;
        let minimapOverflow = 3;
        let minimapOffset = {
            x:minimapOverflow + 3,
            y:height - minimapHeight - minimapOverflow - 3,
        }
        let minimapPipSize = 5;

        push();
        //draw minimap background
        strokeWeight(2);
        stroke('black');
        fill(0, 150);
        rect(
            minimapOffset.x - minimapOverflow,
            minimapOffset.y - minimapOverflow, 
            minimapWidth + minimapOverflow*2, 
            minimapHeight + minimapOverflow*2
        );

        //draw zones
        strokeWeight(1);
        fill(color(50,50,50,50));
        for (let id in gameState.zones) {
            let zone = gameState.zones[id];
            if (zone.closing > 0) {
                stroke(gameSettings.colors.green);
            }
            else {
                stroke(gameSettings.colors.red);
            }
            circle(
                (zone.x/gameSettings.width)*minimapWidth + minimapOffset.x,
                (zone.y/gameSettings.height)*minimapHeight + minimapOffset.y,
                zone.radius*2*(minimapWidth/gameSettings.width),
            );
        }

        //reguklar pips dont need outline
        strokeWeight(0);

        //draw enemy pips
        fill(gameSettings.colors.red);
        for (let id in gameState.enemies) {
            let enemy = gameState.enemies[id];
            circle(
                (enemy.x/gameSettings.width)*minimapWidth + minimapOffset.x,
                (enemy.y/gameSettings.height)*minimapHeight + minimapOffset.y,
                minimapPipSize,
            );
        }

        //draw boss pips
        fill(gameSettings.colors.red);
        for (let id in gameState.bosses) {
            let boss = gameState.bosses[id];
            circle(
                (boss.x/gameSettings.width)*minimapWidth + minimapOffset.x,
                (boss.y/gameSettings.height)*minimapHeight + minimapOffset.y,
                minimapPipSize*2.25,
            );
        }

        //draw other player pips
        for (let id in gameState.players.playing) {
            if (id != socket.id && gameState.players.playing[id].health > 0) {
                let player = gameState.players.playing[id];
                fill(gameSettings.playerTypes[player.type].colors.light);
                circle(
                    (player.x/gameSettings.width)*minimapWidth + minimapOffset.x,
                    (player.y/gameSettings.height)*minimapHeight + minimapOffset.y,
                    minimapPipSize,
                );
            }
        }

        //draw client player pip with outline indicator + larger
        if (player !== undefined) {
            strokeWeight(2);
            stroke(gameSettings.colors.white);
            fill(gameSettings.playerTypes[player.type].colors.light);
            circle(
                (player.x/gameSettings.width)*minimapWidth + minimapOffset.x,
                (player.y/gameSettings.height)*minimapHeight + minimapOffset.y,
                minimapPipSize*1.25,
            );
        }
        
        pop();
    },

    //display room code + info so others can join
    drawRoomInfo: function (gameState, color) {
        push();
        textAlign(LEFT, CENTER);
        stroke('black');
        strokeWeight(0);
        textSize(30);
        fill(color);
        text(`Game Code: ${roomId}`, 15, 20);

        let playerCount = Object.keys(gameState.players.playing).length + Object.keys(gameState.players.waiting).length;

        text(`Players: ${playerCount}/${gameSettings.roomCap}`, 15, 60);

        text(`Wave: ${gameState.roomInfo.waveCount}`, 15 ,100);

        //draw lives as red if none left
        if (gameState.roomInfo.livesCount <= 0) {
            fill(gameSettings.colors.red);
        }
        text(`Lives: ${gameState.roomInfo.livesCount}`, 15, 140);
        pop();
    },

    //draw name, killstreak, and healthbar for each player
    drawPlayerInfo: function (gameState) {
        push();
        rectMode(CORNERS);
        textAlign(RIGHT, CENTER);
        stroke('black');
        strokeWeight(0);
        textSize(30);
        let counter = 0;

        //draw living players first
        let sortedPlaying = Object.keys(gameState.players.playing).sort();
        for (let id of sortedPlaying) {
            
            let player = gameState.players.playing[id];

            //draw name and killstreak
            fill(gameSettings.playerTypes[player.type].colors.dark);
            text(player.name + ' : '+player.killStreak, width-15, 20+counter*50);
            
            //draw healthbar
            let barWidth = 110;
            let barHeight = 6;
            let barOffset = 15;
            fill('black');
            stroke(gameSettings.playerTypes[player.type].colors.dark);
            strokeWeight(2);
            rect(
                width-(barWidth+barOffset), 40+counter*50, 
                width-(barOffset), 40+counter*50 + barHeight
            );
            strokeWeight(0);
            fill(gameSettings.playerTypes[player.type].colors.light);
            rect(
                width-barOffset - barWidth*(player.health/gameSettings.playerTypes[player.type].maxHealth), 40+counter*50, 
                width-(barOffset), 40+counter*50 + barHeight
            );

            counter++;
        }

        let sortedWaiting = Object.keys(gameState.players.waiting).sort();
        for (let id of sortedWaiting) {
            
            let player = gameState.players.waiting[id];

            //draw name and killstreak
            fill(gameSettings.colors.darkgrey);
            text(player.name + ' : '+player.killStreak, width-15, 20+counter*50);
            
            //draw healthbar
            let barWidth = 110;
            let barHeight = 6;
            let barOffset = 15;
            fill('black');
            stroke(gameSettings.colors.darkgrey);
            strokeWeight(2);
            rect(
                width-(barWidth+barOffset), 40+counter*50, 
                width-(barOffset), 40+counter*50 + barHeight
            );
            strokeWeight(0);
            if (player.respawnTimer == 0) {
                fill(gameSettings.colors.white);
            }
            else {
                fill(gameSettings.colors.red);
            }
            rect(
                width-barOffset - barWidth*(1-(player.respawnTimer/gameSettings.respawnTime)), 40+counter*50, 
                width-(barOffset), 40+counter*50 + barHeight
            );

            counter++;
        }

        pop();
    },

    //draw countdown to next wave
    drawWaveCountdown: function (gameState) {

        push();

        //make sure countdown is going
        if (gameState.roomInfo.waveTimer > 0 &&
            Object.keys(gameState.zones).length == 0 &&
            Object.keys(gameState.bosses).length == 0) {

                let countdownNum = Math.ceil(gameState.roomInfo.waveTimer/1000);

                textAlign(CENTER, CENTER);
                textSize(75);
                stroke(0);
                fill('black');

                text(
                    countdownNum,
                    width/2,
                    height/4,
                );
        }

        pop();
    },

    //draw technical info about game
    drawTechInfo: function (gameState, color) {

        //tell FPS module to track a frame
        FPS.markFrame();

        push();
        textAlign(RIGHT, CENTER);
        textSize(30);
        strokeWeight(0);
        fill(color);
        //draw fps
        text(
            `FPS: ${FPS.getFPS()}`, 
            width-15, 
            height-110,
        );
        //draw ping
        text(
            `Ping: ${Ping.value}`,
            width-15,
            height-70,
        );
        //draw tickrate

        //set color to red if tickrate is low
        if (gameState.roomInfo.realTickRate/gameSettings.tickRate < 0.9) {
            fill(gameSettings.colors.red);
        } 
        text(
            `TPS: ${gameState.roomInfo.realTickRate}/${gameSettings.tickRate}`,
            width-15,
            height-30,
        );
        pop();
    },

    //draw cosshair
    drawCrosshair: function (color) {
        push();
        stroke(color);
        strokeWeight(2);
        fill(0,0);
        circle(mouseX, mouseY, 30);
        line(mouseX+20, mouseY, mouseX-20, mouseY);
        line(mouseX, mouseY+20, mouseX, mouseY-20);
        pop();
    },

    // DEATH MENUS
    ////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////

    //Exit Game Button
    exitGameButton: new Button(
        "EXIT\nGAME",
        gameSettings.colors.darkpink,
        gameSettings.colors.pink
    ),
    drawExitGameButton: function() {
        this.exitGameButton.update(
            width - 100, 
            height - 100, 
            height/8, 
            height/8
        );
        this.exitGameButton.draw();
    },

    //CLASS MENU
    ////////////////////////////////////////////////////////////

    //create button for each player class
    classButtons: function () {
        let classButtons = {};

        for (let className in gameSettings.playerTypes) {
            classButtons[className] = new Button(
                className.toUpperCase(),
                gameSettings.playerTypes[className].colors.dark,
                gameSettings.playerTypes[className].colors.light
            );
        }

        return classButtons;
    }(),

    drawClassMenu: function () {
        push();
        textAlign(CENTER, CENTER);

        let classCount = Object.keys(this.classButtons).length;
        
        //update and draw buttons
        let counter = 1;
        for (let className in this.classButtons) {
            let button = this.classButtons[className];
            button.update(
                width/2, 
                height*counter/(1+classCount), 
                width/3,
                height/(4+classCount)
            );
            button.draw();
            counter++;
        }
    
        //draw text
        stroke('black');
        strokeWeight(3);
        fill(gameSettings.colors.white);
        textSize(40);
        text("Choose a Class:", width/2, height/12);
        pop();
    },

    clickClassMenu: function () {
        for (let className in this.classButtons) {
            if (this.classButtons[className].mouseOver()) {
                return className;
            }
        }
        return false;
    },

    // NO LIVES MENU
    ////////////////////////////////////////////////////////////

    drawNoLivesMenu: function () {
        push();
        textAlign(CENTER, CENTER);

        //draw text
        stroke('black');
        strokeWeight(3);
        fill(gameSettings.colors.red);
        textSize(60);
        text("No Lives Remaining", width/2, height/2);
        pop();
    },

    // RESPAWNING MENU
    ////////////////////////////////////////////////////////////

    drawRespawnMenu: function (player) {

        push();
    
        textAlign(CENTER, CENTER);
        fill(gameSettings.colors.red);
        stroke('black');
        strokeWeight(3);
        textSize(60);
        text("YOU ARE DEAD", width/2, height/2);
        this.drawBar({
            x: width/2,
            y: height - 40,
            w: width/2,
            h: 40,
            color: gameSettings.colors.red,
            prog: 1-player.respawnTimer/gameSettings.respawnTime,
        })
    
        pop();
    },

    // GAME OVER MENU
    ////////////////////////////////////////////////////////////

    restartButton: new Button (
        "NEW GAME",
        gameSettings.colors.darkgreen,
        gameSettings.colors.green
    ),

    drawGameOverMenu: function (gameState) {
        push();
        textAlign(CENTER, CENTER);
    
        //update and draw restart button
        this.restartButton.update(
            width/2,
            height*2/3,
            width/3,
            height/8,
        )
    
        this.restartButton.draw();
    
        //draw text
        stroke('black');
        strokeWeight(3);
        fill(gameSettings.colors.red);
        textSize(60);
        text("GAME OVER", width/2, height/3);
    
        fill(gameSettings.colors.white);
        text(`WAVE: ${gameState.roomInfo.waveCount}`, width/2, height/2);
        pop();
    },

    clickGameOverMenu: function () {
        return this.restartButton.mouseOver();
    },

    // Death Menu Functions
    ////////////////////////////////////////////////////////////

    //draw death menus
    drawDeathMenus: function (gameState) {

        let player = gameState.players.waiting[socket.id];

        //darken game screen
        background(0, 200);

        //if game is over
        if (gameState.roomInfo.gameOver) {
            this.drawGameOverMenu(gameState);
        }
        //if player is respawning
        else if (player.respawnTimer > 0) {
            this.drawRespawnMenu(player);
        }
        //if lives left, select new class
        else if (gameState.roomInfo.livesCount > 0) {
            this.drawClassMenu();
        }
        //if no lives left
        else {
            this.drawNoLivesMenu();
        }

        this.drawExitGameButton();
    },

    deathMenuMouseClicked: function (socket, gameState) {
        if(this.exitGameButton.mouseOver()) {
            Error.displayError('Left Game', 5000);
            endGame();
            return;
        }
        if (gameState.roomInfo.gameOver &&
            this.clickGameOverMenu()) {
                socket.emit('restart_game');
                return;
        }
        if (gameState.roomInfo.livesCount > 0 &&
            this.clickClassMenu()) {
                socket.emit('class_choice', this.clickClassMenu());
                return;
        }
    },
}

