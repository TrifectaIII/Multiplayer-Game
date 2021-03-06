//get sqlite library
const sqlite3 = require('sqlite3').verbose();

//create initial DB
function createDB (callback) {

    // open/create database
    let db = new sqlite3.Database('../highscore.db');

    //create table
    db.run(
        `CREATE TABLE highscores(
            name text,
            score int
        )`,
        (err) => {
            if (err) console.log('Failed to Create DB: Already Exists');
            if (callback) callback();
        }
    );

    //close database
    db.close();
}

//adds a new score to the table
function addScore (name, score, callback) {

    // open database
    let db = new sqlite3.Database('../highscore.db');

    db.run(
        "INSERT INTO highscores(name, score) VALUES(?, ?)",
        [name, score],
        function (err) {
            if (err) throw err;
            if (callback) callback();
        }
    );

    //close database
    db.close();
}

//returns array of objects representing each row in highscore table
function getAllScores (callback) {
    // open database
    let db = new sqlite3.Database('../highscore.db');

    db.all(
        'SELECT * FROM highscores ORDER BY score',
        [],
        (err, rows) => {
            if (err) throw err;
            if (callback) callback(rows);
        }
    );

    //close database
    db.close();
}

function getTopScores (amount, callback) {
    // open database
    let db = new sqlite3.Database('../highscore.db');

    db.all(
        'SELECT * FROM highscores ORDER BY score',
        [],
        (err, rows) => {
            if (err) throw err;
            const topRows = rows.reverse().slice(0,amount);
            if (callback) callback(topRows);
        }
    );

    //close database
    db.close();
}

function clearScores (callback) {
    // open database
    let db = new sqlite3.Database('../highscore.db');

    db.run(
        'DELETE FROM highscores',
        (err) => {
            if (err) throw err;
            if (callback) callback();
        }
    );

    //close database
    db.close();
}

module.exports = {
    createDB,
    addScore,
    getAllScores,
    getTopScores,
    clearScores,
}