function Subscription(){
    this.callbackList = [];
}
Subscription.prototype = Object.create(Object.prototype, {
    subscribe:{
        value: function(fn){
            this.callbackList.push(fn);
        }
    },
    deliver: {
        value: function(args){
            for (var i=0; i<this.callbackList.length;i++){
                this.callbackList[i].call(null, args);
            }
        }
    }
});
