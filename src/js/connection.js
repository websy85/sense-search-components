var Connection = (function(){
  function Connection(options, readyCallback){
    //ensure we have some defaults
    if(!options.app){
      return false; //must specify an app to use the search
    }
    options = options || {};
    if(!options.host){
      options.port = "4848";
    }
    else{
      options.port = options.port || "";
    }
    options.host = options.host || "localhost";
    options.prefix = options.prefix || "";
    options.isSecure = options.isSecure || window.location.protocol == "https:"
    options.ticket = options.ticket || false;
    var url = "ws";
    url += options.isSecure?"s://":"://";
    url += options.host;
    url += options.port?":"+options.port:"";
    url += options.prefix;
    url += "/app/";
    url += options.app;
    url += options.ticket?"qlikTicket="+options.ticket:"";
    this.connection = new Session();
    this.connection.connect(url, readyCallback);
  }

  Connection.prototype = Object.create(Object.prototype, {
    connection:{
      writable: true,
      value: null
    },
    ask: {
      value: function(handle, method, params, seqId, callbackFn){
        var json = {
            id: seqId,
            handle: handle,
            method: method,
            params: params
        };
        this.connection.sendMessage(json, callbackFn);
      }
    }
  });

  return Connection;
}());
