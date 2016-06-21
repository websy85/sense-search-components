include "./input.js"
include "./results.js"

var SenseSearch = (function(){

  include "./connection.js"
  include "./socket-session.js"
  include "./subscription.js"
  include "./exchange.js"

  function SenseSearch(){
    this.ready = new Subscription();
    this.searchResults = new Subscription();
    this.searchAssociations = new Subscription();
    this.fieldsFetched = new Subscription();
    this.noResults = new Subscription();
    this.suggestResults = new Subscription();
    this.chartResults = new Subscription();
    this.cleared = new Subscription();
  }

  SenseSearch.prototype = Object.create(Object.prototype, {
    init:{
      value: function(){
        //see if there are any elements that need rendering
        var inputs = document.getElementsByTagName('sense-search-input');
        for (var i = 0; i < inputs.length;) {
            var id = inputs[i].id;
            var input = new SenseSearchInput(id);
            this.inputs[id] = input.object;
        }
        var results = document.getElementsByTagName('sense-search-results');
        for (var i = 0; i < results.length;) {
            var id = results[i].id;
            var result = new SenseSearchResult(id);
            this.results[id] = result.object;
        }
      }
    },
    inputs: {
      writable: true,
      value: {}
    },
    results:{
      writable: true,
      value: {}
    },
    pendingSearch:{
      writable: true,
      value: null
    },
    pendingSuggest:{
      writable: true,
      value: null
    },
    pendingChart:{
      writable: true,
      value: null
    },
    appHandle: {
      writable: true,
      value: null
    },
    exchange:{
      writable: true,
      value: null
    },
    connect:{
      value: function(config, callbackFn){
        var that = this;
        this.exchange = new Exchange(config, "Native", function(response){
          if(response.result && response.result.qReturn){
              that.appHandle = response.result.qReturn.qHandle;
              that.ready.subscribe(callbackFn);
              that.ready.deliver();
          }
        });
      }
    },
    connectWithQSocks: {
      value: function(app){
        this.appHandle = app.handle;
        this.exchange = new Exchange(app.connection, "QSocks");
        this.ready.deliver();
      }
    },
    connectWithCapabilityAPI: {
      value:  function(app){
        this.appHandle = app.global.session.connectedAppHandle;
        this.exchange = new Exchange(app, "CapabilityAPI");
        this.ready.deliver();

        console.log(app);
      }
    },
    readOptions:{
      value: function(options){
        for (var o in options){
          this[0] = options[o];
        }
      }
    },
    ready:{
      writable: true,
      value: null
    },
    newResultsDefinition:{
      value: function(options, channel, callbackFn){
        var result = new Result(options);
        this.results.push(result);
      }
    },
    fieldsFetched:{
      writable: true,
      value: null
    },
    search: {
      value: function(searchText, searchFields, mode, context){
        var that = this;
        mode = mode || "simple";
        context = context || this.context || "LockedFieldsOnly"
        this.pendingSearch = this.exchange.seqId+1;
        this.terms = searchText.split(" ");
        this.exchange.ask(this.appHandle, "SearchAssociations", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
          if(mode=="visualizations"){
            that.searchAssociations.deliver(response.result);
          }
          else{
            if(response.id == that.pendingSearch){
              if(searchText== "" || response.result.qResults.qTotalSearchResults>0){
                if(mode=="simple"){
                  that.selectAssociations(searchFields, 0, context);
                }
                else{
                  that.searchAssociations.deliver(response.result);
                }
              }
              else{
                //we send a no results instruction
                that.noResults.deliver();
              }
            }
          }
        });
      }
    },
    selectAssociations: {
      value: function(searchFields, resultGroup, context){
        context = context || this.context || "LockedFieldsOnly"
        var that = this;
        that.exchange.ask(that.appHandle, "SelectAssociations", [{qContext: context, qSearchFields: searchFields}, that.terms, resultGroup], function(response){
          that.searchResults.deliver(response.change);
        });
      }
    },
    suggest:{
      value: function(searchText, suggestFields, context){
        var that = this;
        that.pendingSuggest = this.exchange.seqId+1;
        this.exchange.ask(this.appHandle, "SearchSuggest", [{qContext: context || this.context || "LockedFieldsOnly", qSearchFields: suggestFields}, searchText.split(" ")], function(response){
          if(response.id == that.pendingSuggest){
            that.suggestResults.deliver(response.result.qResult);
          }
        });
      }
    },
    createViz: {
      value: function(def){
        var that = this;
        that.pendingChart = this.exchange.seqId+1;
        if(this.exchange.connectionType=="CapabilityAPI"){
          this.exchange.app.visualization.create(def.qInfo.qType, [], def).then(function(chart){
            console.log(chart);
            that.exchange.ask(chart.model.handle, "ApplyPatches", [[{qPath:"/qHyperCubeDef", qOp:"replace", qValue: JSON.stringify(def.qHyperCubeDef)}], true], function(result){
              chart.model.getLayout().then(function(){
                that.chartResults.deliver(chart);
              });
            });
          })
        }
        else{
          this.exchange.ask(this.appHandle, "CreateSessionObject", [def], function(response){
            if(response.id == that.pendingChart){
              that.chartResults.deliver(response.result.qReturn);
            }
          });
        }
      }
    },
    clear:{
      value: function(){
        this.terms = null;
        this.cleared.deliver();
      }
    },
    getAppFields:{
      value: function(){
        var that = this;
        that.exchange.ask(that.appHandle, "CreateSessionObject", [{ qInfo: { qType: "FieldList" }, qFieldListDef: { qShowSystem: true } }], function(response){
          var handle = response.result.qReturn.qHandle;
          that.exchange.ask(handle, "GetLayout", [], function(response){
            that.fieldsFetched.deliver(response.result.qLayout);
          });
        });
      }
    },
    searchResults:{
      writable: true,
      value: null
    },
    searchAssociations:{
      writable: true,
      value: null
    },
    noResults:{
      writable: true,
      value: null
    },
    chartResults:{
      writable: true,
      value: null
    },
    suggestResults:{
      writable: true,
      value: null
    }
  });

  return SenseSearch;
}());

var senseSearch = new SenseSearch();
senseSearch.init();
