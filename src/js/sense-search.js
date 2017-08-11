include "./input.js"
include "./results.js"
include "./subscription.js"

var SenseSearch = (function(){

  include "./connection.js"
  include "./socket-session.js"
  include "./exchange.js"

  function SenseSearch(){
    this.reboot();
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
    reboot: {
      value: function(){
        this.ready = new Subscription();
        this.searchStarted = new Subscription();
        this.searchResults = new Subscription();
        this.searchAssociations = new Subscription();
        this.fieldsFetched = new Subscription();
        this.noResults = new Subscription();
        this.suggestResults = new Subscription();
        this.chartResults = new Subscription();
        this.onSelectionsApplied = new Subscription();
        this.onSelectionsError = new Subscription();
        this.onLockedUnlocked = new Subscription();
        this.cleared = new Subscription();
        this.inputs = [];
        this.results = [];
      }
    },
    appFields:{
      writable: true,
      value: {}
    },
    appFieldsByTag:{
      writable: true,
      value: {}
    },
    fieldsForSelecting: {
      value: []
    },
    fieldHandles: {
      value: []
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
    searchInput: {
      value: SenseSearchInput
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
        this.appHandle = app.global.session.connectedAppHandle || app.model.handle;
        this.exchange = new Exchange(app, "CapabilityAPI");
        this.ready.deliver();

        // console.log(app);
      }
    },
    connectWithEnigma: {
      value:  function(app){
        this.appHandle = app.session.apis.entries[1].api.handle;
        this.exchange = new Exchange(app, "Enigma");
        this.ready.deliver();

        // console.log(app);
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
        this.searchStarted.deliver();
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
    searchAndSelect: {
      value: function(searchText, searchFields, resultGroup, context){
        this.searchStarted.deliver();
        var that = this;
        context = context || this.context || "LockedFieldsOnly"
        this.pendingSearch = this.exchange.seqId+1;
        this.terms = searchText.split(" ");
        this.exchange.ask(this.appHandle, "SearchAssociations", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
          if(response.id == that.pendingSearch || response.id == that.exchange.seqId){
            if(searchText== "" || response.result.qResults.qTotalSearchResults>0){
              that.selectAssociations(searchFields, resultGroup, context);
            }
            else{
              //we send a no results instruction
              that.noResults.deliver();
            }
          }
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
    selectTextInField: {
      value: function(fieldName, values, toggle){
        toggle = (toggle==null?true:false);
        var that = this;
        var valueList = [];
        for (var i = 0; i < values.length; i++) {
          valueList.push({
            qText: values[i]
          });
        }
        if(this.fieldsForSelecting.indexOf(fieldName)===-1){
          this.exchange.ask(this.appHandle, "GetField", [fieldName], function(response){
            if(response.result.qReturn.qHandle==null){
              this.onSelectionsError.deliver();
            }
            else {
              var handle = response.result.qReturn.qHandle;
              that.fieldHandles.push(handle);
              that.fieldsForSelecting.push(fieldName);
              that.exchange.ask(handle, "SelectValues", [valueList, toggle], function(response){
                that.onSelectionsApplied.deliver();
              });
            }
          });
        }
        else {
          var handle = this.fieldHandles[this.fieldsForSelecting.indexOf(fieldName)];
          this.exchange.ask(handle, "SelectValues", [valueList, toggle], function(response){
            that.onSelectionsApplied.deliver();
          });
        }
      }
    },
    selectInField:{
      value: function(fieldName, values, toggle){
        toggle = (toggle==null?true:false);
        var that = this;
        if(this.fieldsForSelecting.indexOf(fieldName)===-1){
          this.exchange.ask(this.appHandle, "GetField", [fieldName], function(response){
            if(response.result.qReturn.qHandle==null){
              this.onSelectionsError.deliver();
            }
            else {
              var handle = response.result.qReturn.qHandle;
              that.fieldHandles.push(handle);
              that.fieldsForSelecting.push(fieldName);
              that.exchange.ask(handle, "LowLevelSelect", [values, toggle], function(response){
                that.onSelectionsApplied.deliver();
              });
            }
          });
        }
        else {
          var handle = this.fieldHandles[this.fieldsForSelecting.indexOf(fieldName)];
          this.exchange.ask(handle, "LowLevelSelect", [values, toggle], function(response){
            that.onSelectionsApplied.deliver();
          });
        }
      }
    },
    createViz: {
      value: function(def){
        this.searchStarted.deliver();
        var that = this;
        that.pendingChart = this.exchange.seqId+1;
        if(this.exchange.connectionType=="CapabilityAPI"){
          var fieldArray = [], defOptions = def;
          defOptions.wsId = that.pendingChart;
          if(def.qInfo.qType=="kpi"){
            defOptions.color = {
        			useBaseColors: "measure"
        		};
            defOptions.qHyperCubeDef.qMeasures[0].qDef.measureAxis = {
              min: 0,
              max: 100
            };
            defOptions.qHyperCubeDef.qMeasures[0].qDef.conditionalColoring = {
              useConditionalColoring: false,
              singleColor: 3,
              paletteSingleColor: {
  							index: 6
  						},
              segments: {
  							limits: [],
  							paletteColors: [{
  								index: 6
  							}]
  						}
            };
            defOptions.fontSize = "S";
          }
          this.exchange.app.visualization.create(def.qInfo.qType, fieldArray, defOptions).then(function(chart){
            // console.log(chart);
            // if(chart.model.layout.wsId == that.pendingChart){  //doesn't work in 2.2
              that.exchange.ask(chart.model.handle, "ApplyPatches", [[{qPath:"/qHyperCubeDef", qOp:"replace", qValue: JSON.stringify(defOptions.qHyperCubeDef)}], true], function(result){
                chart.model.getLayout().then(function(){
                  that.chartResults.deliver(chart);
                });
              });
            // }
          }, logError)
        }
        else{
          this.exchange.ask(this.appHandle, "CreateSessionObject", [def], function(response){
            if(response.id == that.pendingChart){
              that.exchange.ask(response.result.qReturn.qHandle, "GetLayout", [], function(layout){
                that.chartResults.deliver({model: response.result.qReturn, layout: layout});
              })
            }
          });
        }
      }
    },
    clear:{
      value: function(unlock){
        var that = this;
        if(unlock===true){
          this.exchange.ask(this.appHandle, "UnlockAll", [], function(response){
            that.exchange.ask(that.appHandle, "ClearAll", [], function(response){
              that.terms = null;
              that.cleared.deliver();
            });
          })
        }
        else{
          this.exchange.ask(this.appHandle, "ClearAll", [], function(response){
            that.terms = null;
            that.cleared.deliver();
          });
        }
      }
    },
    getAppFields:{
      value: function(cardinalityLimit){
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
              that.sortFieldsByTag(responseData, cardinalityLimit);
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
              that.sortFieldsByTag(responseData, cardinalityLimit);
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
      value: function(fieldData, cardinalityLimit){
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
            if(fieldData.fields[i].qCardinal > cardinalityLimit){
              if(!this.appFieldsByTag.$possibleMeasure){
                this.appFieldsByTag.$possibleMeasure = {}
              }
              this.appFieldsByTag.$possibleMeasure[fieldName] = {fieldName: fieldData.fields[i].qName};
            }
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
          if(fieldData.fields[i].qCardinal > cardinalityLimit){
            if(!this.appFieldsByTag.$possibleMeasure){
              this.appFieldsByTag.$possibleMeasure = {}
            }
            this.appFieldsByTag.$possibleMeasure[fieldName] = {fieldName: fieldData.fields[i].qName};
          }
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
        // console.log(this.appFieldsByTag);
        this.fieldsFetched.deliver();
      }
    },
    searchStarted:{
      writable: true,
      value: null
    },
    searchResults:{
      writable: true,
      value: null
    },
    searchAssociations:{
      writable: true,
      value: null
    },
    selectionsApplied:{
      writable: true,
      value: null
    },
    onSelectionsError:{
      writable: true,
      value: null
    },
    lockedUnlocked:{
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

if(typeof document!=="undefined"){
  var senseSearch = new SenseSearch();
  senseSearch.init();
}
else {
  module.exports = new SenseSearch();
}

function logError(err){
  console.log(err);
}
