function Session() {

    var retries = 0;
    var connection;
    var MAX_NUM_RETRIES = 10;
    var messageHandler;
    this.connect = function (wsUrl, callbackFn) {
        messageHandler = callbackFn;
        try {
            connection = new WebSocket(wsUrl);
        } catch (err) {

        }

        connection.onopen = function () {
            console.log('Socket connected! readyState = ' + connection.readyState);
            retries = 0;
            messageHandler.call(null, {method:"connected"});
        }

        connection.onmessage = function (evt) {
            var response;
            response = evt.data;
            messageHandler.call(null, JSON.parse(response));
        };

        connection.onerror = function (evt) {
            messageHandler.call(null, null);
        };

        connection.onclose = function (evt) {
            if (retries < MAX_NUM_RETRIES) {
                retries++;
                console.warn("Socket closed! --> Reconnect in 5 secs (retry " + retries + ")");
                setTimeout(function () {
                    if (connection.readyState === 3) {
                        messageHandler.call(null, {method:"socketClosed", "isConnecting":false});
                    }
                }, 5000);
            } else {
                console.warn("Sorry, can't reconnect socket aftet " + MAX_NUM_RETRIES + " retries");
                retries = 0;
            }
        };

    };

    this.sendMessage = function (msg, callbackFn) {
        messageHandler = callbackFn;

        try {

            connection.send(JSON.stringify(msg));

        } catch (e) {
            throw e;
        }
    };

};
