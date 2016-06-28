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
    appFields:{
      writable: true,
      value: {
        // fields: {},
        // dimensions: {},
        // measures: {}
      }
    },
    appFieldsByTag:{
      writable: true,
      value: {}
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
          var fieldArray = [], defOptions = def;
          defOptions.wsId = that.pendingChart;
          if(def.qInfo.qType=="kpi"){
            defOptions.qHyperCubeDef.qMeasures[0].qDef.measureAxis = {
              min: 0,
              max: 100
            };
            defOptions.qHyperCubeDef.qMeasures[0].qDef.conditionalColoring = {
              useConditionalColoring: false,
              singleColor: 3,
              segments: {
                colors: {color:3},
                limits: []
              }
            };
            defOptions.fontSize = "S";
          }
          this.exchange.app.visualization.create(def.qInfo.qType, fieldArray, defOptions).then(function(chart){
            console.log(chart);
            if(chart.model.layout.wsId == that.pendingChart){
              that.exchange.ask(chart.model.handle, "ApplyPatches", [[{qPath:"/qHyperCubeDef", qOp:"replace", qValue: JSON.stringify(defOptions.qHyperCubeDef)}], true], function(result){
                chart.model.getLayout().then(function(){
                  that.chartResults.deliver(chart);
                });
              });
            }
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
        var CALL_COUNT = 2;
        var responseData = {
          fields: null,
          dimensions: null,
          measures: null,
          setCount: 0
        };
        //get app fields
        that.exchange.ask(that.appHandle, "CreateSessionObject", [{ qInfo: { qType: "FieldList" }, qFieldListDef: { qShowSystem: false } }], function(response){
          var handle = response.result.qReturn.qHandle;
          that.exchange.ask(handle, "GetLayout", [], function(response){
            responseData.fields = response.result.qLayout.qFieldList.qItems;
            responseData.setCount++;
            if(responseData.setCount===CALL_COUNT){
              that.sortFieldsByTag(responseData);
            }
          });
        });
        //get app dimensions
        that.exchange.ask(that.appHandle, "CreateSessionObject", [{ qInfo: { qType: "DimensionList" }, qDimensionListDef: { qType: "dimension", qData: {title: "/qMetaDef/title", tags: "/qMetaDef/tags", grouping: "/qDim/qGrouping", info: "/qDimInfos"} } }], function(response){
          var handle = response.result.qReturn.qHandle;
          that.exchange.ask(handle, "GetLayout", [], function(response){
            responseData.dimensions = response.result.qLayout.qDimensionList.qItems;
            responseData.setCount++;
            if(responseData.setCount===CALL_COUNT){
              that.sortFieldsByTag(responseData);
            }
          });
        });
        //get app measures
        //disabled for now - why? - because library measures are pre defined and most of our logic is designed to build up an expression with set analysis
        // that.exchange.ask(that.appHandle, "CreateSessionObject", [{ qInfo: { qType: "MeasureList" }, qMeasureListDef: { qType: "measure", qData: {title: "/qMetaDef/title", tags: "/qMetaDef/tags"} } }], function(response){
        //   var handle = response.result.qReturn.qHandle;
        //   that.exchange.ask(handle, "GetLayout", [], function(response){
        //     responseData.measures = response.result.qLayout.qMeasureList.qItems;
        //     responseData.setCount++;
        //     if(responseData.setCount===3){
        //       that.sortFieldsByTag(responseData);
        //     }
        //   });
        // });
        responseData.measures = [];
      }
    },
    sortFieldsByTag:{
      value: function(fieldData){
        //organise the fields
        for (var i=0;i<fieldData.fields.length;i++){
          var fieldName = fieldData.fields[i].qName.toLowerCase().replace(/ /gi, "_");
          this.appFields[fieldName] = fieldData.fields[i];
          for (var t=0;t<fieldData.fields[i].qTags.length;t++){
            if(!this.appFieldsByTag[fieldData.fields[i].qTags[t]]){
              this.appFieldsByTag[fieldData.fields[i].qTags[t]] = {};
            }
            this.appFieldsByTag[fieldData.fields[i].qTags[t]][fieldName] = {
              fieldName: fieldData.fields[i].qName
            };
          }
        }
        //organise the dimensions
        for (var i=0;i<fieldData.dimensions.length;i++){
          var fieldName = fieldData.dimensions[i].qData.title.toLowerCase().replace(/ /gi, "_");
          this.appFields[fieldName] = fieldData.dimensions[i];
          if(!this.appFieldsByTag.$dimension){
            this.appFieldsByTag.$dimension = {};
          }
          this.appFieldsByTag.$dimension[fieldName] = {
            fieldName: fieldData.dimensions[i].qData.title
          };
          for (var t=0;t<fieldData.dimensions[i].qMeta.tags.length;t++){
            var tag = fieldData.dimensions[i].qMeta.tags[t];
            if(tag.indexOf("$")==-1){
              tag = "$"+tag;
            }
            if(!this.appFieldsByTag[tag]){
              this.appFieldsByTag[tag] = {};
            }
            this.appFieldsByTag[tag][fieldName] = {
              fieldName: fieldData.dimensions[i].qData.title
            };
          }
        }
        //organise the measures
        for (var i=0;i<fieldData.measures.length;i++){
          var fieldName = fieldData.measures[i].qData.title.toLowerCase().replace(/ /gi, "_");
          this.appFields[fieldName] = fieldData.measures[i];
          if(!this.appFieldsByTag.$measure){
            this.appFieldsByTag.$measure = {};
          }
          this.appFieldsByTag.$measure[fieldName] = {
            fieldName: fieldData.measures[i].qData.title
          };
          for (var t=0;t<fieldData.measures[i].qMeta.tags.length;t++){
            var tag = fieldData.measures[i].qMeta.tags[t];
            if(tag.indexOf("$")==-1){
              tag = "$"+tag;
            }
            if(!this.appFieldsByTag[tag]){
              this.appFieldsByTag[tag] = {};
            }
            this.appFieldsByTag[tag][fieldName] = {
              fieldName: fieldData.measures[i].qData.title
            };
          }
        }
        console.log(fieldData);
        this.fieldsFetched.deliver();
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
