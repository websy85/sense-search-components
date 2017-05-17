var Exchange = (function(){
  function Exchange(options, connectionType, callbackFn){
    var that = this;
    this.connectionType = connectionType;
    if(connectionType=="Native"){
      //we're connecting here
      this.connection = new Connection(options, function(){
        that.connection.ask(-1, "OpenDoc", [options.app], 0, function(response){
          callbackFn.call(null, response);
        });
      })
    }
    else if(connectionType=="QSocks"){
      //we're connecting with a QSocks connection
      this.connection = options;
      this.seqId = this.connection.seqid;
    }
    else if(connectionType=="Enigma"){
      //we're connecting with a QSocks connection
      this.connection = options.session;
      this.seqId = this.connection.rpc.requestId;
    }
    else if(connectionType=="CapabilityAPI"){
      this.connection = options.global.session;
      this.app = options;
    }
  }

  Exchange.prototype = Object.create(Object.prototype, {
    connectionType: {
      writable: true,
      value: null
    },
    seqId:{
      writable: true,
      value: 0
    },
    pendingCallbacks:{
      writable: true,
      value: {}
    },
    connection: {
      writable: true,
      value: null
    },
    ask:{
      value: function(handle, method, args, callbackFn){
        switch (this.connectionType) {
          case "Native":
            this.askNative(handle, method, args, callbackFn);
            break;
          case "QSocks":
            this.askQSocks(handle, method, args, callbackFn);
            break;
          case "CapabilityAPI":
            this.askCapabilityAPI(handle, method, args, callbackFn);
            break;
          case "Enigma":
            this.askEnigma(handle, method, args, callbackFn);
            break;
          default:

        }(this.connectionType=="Native")
      }
    },
    createCapabilityViz: {
      value: function(){

      }
    },
    askNative:{
      value: function(handle, method, args, callbackFn){
        var that = this;
        this.seqId++;
        this.pendingCallbacks[this.seqId] = callbackFn;
        this.connection.ask(handle, method, args, this.seqId, function(response){
          if(response.error){

          }
          else{
            var callback = that.pendingCallbacks[response.id];
            if(callback){
              callback.call(null, response);
              delete that.pendingCallbacks[response.id];
            }
            // callbackFn.call(null, response);
          }
        });
      }
    },
    askQSocks:{
      value: function(handle, method, args, callbackFn){
        var that = this;
        // this.seqId++;
        this.connection.seqid++;
        this.seqId = this.connection.seqid;
        this.connection.ask(handle, method, args, this.connection.seqid).then(function(response){
          if(response.error){

          }
          else{
            callbackFn.call(null, response);
          }
        }, logError);
      }
    },
    askCapabilityAPI:{
      value: function(handle, method, args, callbackFn){
        var that = this;
        this.connection.rpc({handle: handle, method: method, params:args }).then(function(response){
          that.seqId = response.id;
          if(response.error){

          }
          else{
            callbackFn.call(null, response);
          }
        }, logError);
      }
    },
    askEnigma:{
      value: function(handle, method, args, callbackFn){
        var that = this;
        this.connection.rpc.send({handle: handle, method: method, params:args, outKey: -1, delta: false }).then(function(response){
          that.seqId = response.id;
          if(response.error){

          }
          else{
            callbackFn.call(null, response);
          }
        }, logError);
      }
    },
    getLayout:{
      value: function(handle, callbackFn){
        this.ask(handle, "GetLayout", [], callbackFn);
      }
    }
  });

  return Exchange;
}());

function logError(err){
  console.log(err);
}
