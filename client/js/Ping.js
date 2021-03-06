// Ping checking system

var Ping = {

    interval: null,

    waiting: false,

    time: 0,

    value: 0,

    //begin checking ping
    start: function (socket) {

        //recieve pong from server
        socket.on('ponging', function () {
            this.waiting = false;
            this.value = Date.now() - this.time;
        }.bind(this));

        //clear old interval
        clearInterval(this.interval);

        //first ping
        this.waiting = true,
        this.time = Date.now();
        socket.emit('pinging');

        //start interval
        this.interval = setInterval(function () {
            if (!this.waiting) {
                this.waiting = true;
                this.time = Date.now();
                socket.emit('pinging');
            }
        //get rate from settings
        }.bind(this), gameSettings.pingRate);
    },

    //stop checking ping
    stop: function () {
        clearInterval(this.interval);
        this.interval = null;
    },
}