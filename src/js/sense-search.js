include "./speech.js"
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
            // var id = inputs[i].id;
            // var input = new SenseSearchInput(id);
            // this.inputs[id] = input.object;
            this.inputs[inputs[i].id] = (new SenseSearchInput(inputs[i].id)).object
        }
        var speech = document.getElementsByTagName('sense-search-speech');
        for (var i = 0; i < speech.length;) {
            this.speech[speech[i].id] = (new SenseSearchSpeech(speech[i].id)).object
        }
        var results = document.getElementsByTagName('sense-search-results');
        for (var i = 0; i < results.length;) {
            // var id = results[i].id;
            // var result = new SenseSearchResult(id);
            // this.results[id] = result.object;
            this.results[results[i].id] = (new SenseSearchResult(results[i].id)).object
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
    usePicasso: {
      writable: true,
      value: false
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
    speech: {
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
    vizIdList: {
      writable: true,
      value: []
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
    searchingForVizValues: {
      writable: true,
      value: false
    },
    vizSearchQueue: {
      writable: true,
      value: []
    },
    vizAssociationResults: {
      writable: true,
      value: []
    },
    search: {
      value: function(searchText, searchFields, mode, context){
        this.searchStarted.deliver();
        var that = this;
        mode = mode || "simple";
        context = context || this.context || "LockedFieldsOnly"
        this.pendingSearch = this.exchange.seqId+1;
        if (mode=="visualizations" && this.searchingForVizValues==false) {
          this.searchingForVizValues = true
        }
        else if (mode=="visualizations") {
          this.vizSearchQueue.push([searchText, searchFields, mode, context])
          console.log("vis search queue length", this.vizSearchQueue.length);
          return
        }
        this.terms = searchText.split(" ");
        // this.exchange.ask(this.appHandle, "SearchAssociations", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
          this.exchange.ask(this.appHandle, "SearchResults", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
          if(mode=="visualizations"){
            that.searchingForVizValues = false
            that.vizAssociationResults.push(response.result.qResult)
            if (that.vizSearchQueue.length > 0) {
              console.log("adding to queue");
              that.search(that.vizSearchQueue[0][0], that.vizSearchQueue[0][1], that.vizSearchQueue[0][2], that.vizSearchQueue[0][3])
              that.vizSearchQueue.splice(0,1)
            }
            else {
              console.log("delivering queue");
              that.vizSearchQueue = []
              this.searchingForVizValues = false
              that.searchAssociations.deliver(that.vizAssociationResults);
              that.vizAssociationResults = []
            }
          }
          else{
            if(response.id == that.pendingSearch){
              if(searchText== "" || response.result.qResult.qTotalSearchResults>0){
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
        // this.exchange.ask(this.appHandle, "SearchAssociations", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
        this.exchange.ask(this.appHandle, "SearchResults", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
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
    lowLevelSelectTextInField: {
      value: function(field, values, toggle, callbackFn){
        var fDef
        if (!field.id) {
          fDef = { qFieldDefs: [field.name] }
        }
        var that = this
        var lDef = {
          qInfo: {
            qType: "LB"
          },
          qListObjectDef: {
            qDef: fDef,
            qLibraryId: field.id,
            qInitialDataFetch: [ { qTop: 0, qLeft: 0, qWidth: 1, qHeight: 10000 } ]
          }
        }
        var elemNumbers = []
        this.exchange.ask(this.appHandle, "CreateSessionObject", [lDef], function(response){
          if(response.result.qReturn.qHandle==null){
            that.onSelectionsError.deliver();
          }
          else {
            var fieldHandle = response.result.qReturn.qHandle

            // // This should work but it's not! It would be much quicker!
            // that.exchange.ask(fieldHandle, "SearchListObjectFor", ["/qListObjectDef", values[0]], function(response){  // should only be a single value here
            //   console.log(response);
            //   if (response.result.qSuccess && response.result.qSuccess===true) {
            //     that.exchange.ask(fieldHandle, "AcceptListObjectSearch", ["/qListObjectDef", true], function(){
            //       if (callbackFn && typeof callbackFn==="function") {
            //         callbackFn()
            //       }
            //     })
            //   }
            //   else {
            //     that.exchange.ask(fieldHandle, "AbortListObjectSearch", [])
            //   }
            // })
            // // This is slower than searching but searching doesn't appear to work
            that.exchange.ask(fieldHandle, "GetLayout", [], function(response){
              var layout = response.result.qLayout
              if (layout.qListObject.qDataPages[0]) {
                var matrix = layout.qListObject.qDataPages[0].qMatrix
                for (var i = 0; i < matrix.length; i++) {
                  for (var v = 0; v < values.length; v++) {
                    if (matrix[i][0].qText && matrix[i][0].qText.toLowerCase().indexOf(values[v].toLowerCase())!==-1) {
                      elemNumbers.push(matrix[i][0].qElemNumber)
                    }
                  }
                }
                that.exchange.ask(fieldHandle, "SelectListObjectValues", ["/qListObjectDef", elemNumbers, toggle], function(){
                  if (callbackFn && typeof callbackFn==="function") {
                    callbackFn()
                  }
                })
              }
            })
          }
        })
      }
    },
    selectTextInField: {
      value: function(fieldName, values, toggle, callbackFn){
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
                if (callbackFn){
                  callbackFn()
                }
                else {
                  that.onSelectionsApplied.deliver();
                }
              });
            }
          });
        }
        else {
          var handle = this.fieldHandles[this.fieldsForSelecting.indexOf(fieldName)];
          this.exchange.ask(handle, "SelectValues", [valueList, toggle], function(response){
            if (callbackFn){
              callbackFn()
            }
            else {
              that.onSelectionsApplied.deliver();
            }
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
        console.log(def);
        this.searchStarted.deliver();
        var that = this;
        that.pendingChart = this.exchange.seqId+1;
        if(this.exchange.connectionType=="CapabilityAPI"){
          var fieldArray = [], defOptions = def;
          defOptions.wsId = that.pendingChart;
          var hCubePath = "/qHyperCubeDef";
          var hCubeDef = defOptions.qHyperCubeDef;
          if(def.qInfo.qType=="kpi"){
            defOptions.color = {
        			useBaseColors: "measure"
        		};
            if (defOptions.qHyperCubeDef.qMeasures[0] && !defOptions.qHyperCubeDef.qMeasures[0].qDef){
              defOptions.qHyperCubeDef.qMeasures[0].qDef = {}
            }
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
          if(def.qInfo.qType=="boxplot"){
            hCubePath = "/boxplotDef/qHyperCubeDef";
            defOptions.boxplotDef = {qHyperCubeDef: defOptions.qHyperCubeDef};
            defOptions.boxplotDef.qHyperCubeDef.calculations = {
  						auto: true,
  						mode: "tukey",
  						parameters: {
  							tukey: 1.5,
  							fractiles: 0.01,
  							stdDev: 3
  						}
  					}
            defOptions.boxplotDef.qHyperCubeDef.elements = {
  						"firstWhisker": {
  							"name": "",
  							"expression": null
  						},
  						"boxStart": {
  							"name": "",
  							"expression": null
  						},
  						"boxMiddle": {
  							"name": "",
  							"expression": null
  						},
  						"boxEnd": {
  							"name": "",
  							"expression": null
  						},
  						"lastWhisker": {
  							"name": "",
  							"expression": null
  						},
  						"outliers": {
  							"include": true
  						}
  					}
            defOptions.boxplotDef.qHyperCubeDef.presentation = {
  						whiskers: {
  							show: true
  						}
  					}
            defOptions.boxplotDef.qHyperCubeDef.color = {
  						box: {
  							paletteColor: {
  								index: -1,
  								color: "#E6E6E6"
  							}
  						},
  						point: {
  							paletteColor: {
  								index: 6,
  								color: "#4477aa"
  							}
  						}
  					}
            delete defOptions.qHyperCubeDef;
            hCubeDef = defOptions.boxplotDef.qHyperCubeDef;
          }
          this.exchange.app.visualization.create(def.qInfo.qType, [], defOptions).then(function(chart){
            that.vizIdList.push(chart.id)
            // console.log(chart);
            // if(chart.model.layout.wsId == that.pendingChart){  //doesn't work in 2.2
              // that.exchange.ask(chart.model.handle, "ApplyPatches", [[{qPath:hCubePath, qOp:"replace", qValue: JSON.stringify(hCubeDef)}], true], function(result){
                // chart.model.getLayout().then(function(){
            if (def.qInfo.qType == "table") {
              var colOrder = (new Array(defOptions.qHyperCubeDef.qDimensions.length+defOptions.qHyperCubeDef.qMeasures.length).fill().map(function(item, index){return index}))
              var patchDefs = [
                {
                  qOp: "replace",
                  qPath: "/qHyperCubeDef/columnOrder",
                  qValue: JSON.stringify(colOrder)
                }
              ]
              that.exchange.ask(chart.model.handle, "ApplyPatches", [patchDefs, true], function(result){
                // chart.model.getLayout().then(function(){
                  that.chartResults.deliver(chart);
                // })
              })
            }
            else {
              that.chartResults.deliver(chart);
            }
                // });
              // });
            // }
          }, logError)
        }
        else {
          // calculate the number of dimensions and measures and get a list of alternative viz types
          // this is a bit primitive at the moment!!
          var altVizMap = {
            "10": ["table"],
            "01": ["kpi", "table"],
            "11": ["barchart", "piechart", "linechart"],
            "12": ["barchart", "linechart", "scatterplot"],
            "20": ["table"],
            "02": ["table"],
            "21": ["barchart", "linchart"],
            "22": ["scatterplot"],
            "30": ["table"]
          }
          var altVizIndex = def.qHyperCubeDef.qDimensions.length.toString() + def.qHyperCubeDef.qMeasures.length.toString()
          var altVizList = altVizMap[altVizIndex] || []
          console.log(altVizList);
          this.exchange.ask(this.appHandle, "CreateSessionObject", [def], function(response){
            that.vizIdList.push(response.result.qReturn.qGenericId)
            console.log("Chart response id is", response.id);
            console.log("pendingChart id is",that.pendingChart);
            if(response.id >= that.pendingChart){
              if (that.exchange.connectionType=="Enigma") {
                that.exchange.app.getObject(response.result.qReturn.qGenericId).then(function(model){
                  that.chartResults.deliver({model: model, layout: null, altVizList: altVizList});
                })
              }
              else {
                that.exchange.ask(response.result.qReturn.qHandle, "GetLayout", [], function(layoutResponse){
                  that.chartResults.deliver({model: response.result.qReturn, layout: layoutResponse.result.qLayout, altVizList: altVizList});
                })
              }
            }
          });
        }
      }
    },
    cleanUpOldVizObjects: {
      value: function(){
        for (var i = 0; i < this.vizIdList.length; i++) {
          if (this.vizIdList[i]) {
            this.destroyObject(this.vizIdList[i])
          }
        }
        this.vizIdList = []
      }
    },
    destroyObject: {
      value: function(id){
        this.exchange.ask(this.appHandle, "DestroySessionObject", [id], function(response){
        })
      }
    },
    clear:{
      value: function(unlock, selectionsOnly, callbackFn){
        // console.trace()
        var that = this;
        if(unlock===true){
          this.exchange.ask(this.appHandle, "UnlockAll", [], function(response){
            that.exchange.ask(that.appHandle, "ClearAll", [], function(response){
              if (!selectionsOnly) {
                that.terms = null;
                that.cleared.deliver();
              }
              if (callbackFn && typeof callbackFn=="function") {
                callbackFn()
              }
            });
          })
        }
        else{
          this.exchange.ask(this.appHandle, "ClearAll", [], function(response){
            if (!selectionsOnly) {
              that.terms = null;
              that.cleared.deliver();
            }
            if (callbackFn && typeof callbackFn=="function") {
              callbackFn()
            }
          });
        }
      }
    },
    getAppFields:{
      value: function(cardinalityLimit, includeMeasures){
        var that = this;
        var CALL_COUNT = 2;
        if(includeMeasures){
          CALL_COUNT++
        }
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
        if(includeMeasures){
          that.exchange.ask(that.appHandle, "CreateSessionObject", [{ qInfo: { qType: "MeasureList" }, qMeasureListDef: { qType: "measure", qData: {title: "/qMetaDef/title", tags: "/qMetaDef/tags"} } }], function(response){
            var handle = response.result.qReturn.qHandle;
            that.exchange.ask(handle, "GetLayout", [], function(response){
              responseData.measures = response.result.qLayout.qMeasureList.qItems;
              responseData.setCount++;
              if(responseData.setCount===CALL_COUNT){
                that.sortFieldsByTag(responseData, cardinalityLimit);
              }
            });
          });
        }
      }
    },
    sortFieldsByTag:{
      value: function(fieldData, cardinalityLimit){
        var tempFields = []
        var tempFieldNames = []
        this.appFields = {}
        this.appFieldsByTag = {
          $dimension: {},
          $measure: {},
          $possibleMeasure: {}
        }
        //organise the dimensions
        for (var i=0;i<fieldData.dimensions.length;i++){
          var fieldName = fieldData.dimensions[i].qData.title.toLowerCase().replace(/ /gi, "_");
          // this.appFields[fieldName] = fieldData.dimensions[i];
          if(tempFieldNames.indexOf(fieldName)!==-1){
            continue
          }
          else {
            tempFieldNames.push(fieldName)
          }
          fieldData.dimensions[i].fieldName = fieldName
          tempFields.push(fieldData.dimensions[i]);
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
        if(fieldData.measures && Array.isArray(fieldData.measures)){
          for (var i=0;i<fieldData.measures.length;i++){
            var fieldName = fieldData.measures[i].qData.title.toLowerCase().replace(/ /gi, "_");
            // this.appFields[fieldName] = fieldData.measures[i];
            // this.appFields[fieldName].isMasterItem = true
            if(tempFieldNames.indexOf(fieldName)!==-1){
              continue
            }
            else {
              tempFieldNames.push(fieldName)
            }
            fieldData.measures[i].fieldName = fieldName
            fieldData.measures[i].isMasterItem = true
            tempFields.push(fieldData.measures[i])
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
        }
        //organise the fields
        for (var i=0;i<fieldData.fields.length;i++){
          var fieldName = fieldData.fields[i].qName.toLowerCase().replace(/ /gi, "_");
          // this.appFields[fieldName] = fieldData.fields[i];
          if(tempFieldNames.indexOf(fieldName)!==-1){
            continue
          }
          else {
            tempFieldNames.push(fieldName)
          }
          fieldData.fields[i].fieldName = fieldName
          tempFields.push(fieldData.fields[i]);
          for (var t=0;t<fieldData.fields[i].qTags.length;t++){
            if(!this.appFieldsByTag[fieldData.fields[i].qTags[t]]){
              this.appFieldsByTag[fieldData.fields[i].qTags[t]] = {};
            }
            this.appFieldsByTag[fieldData.fields[i].qTags[t]][fieldName] = {
              fieldName: fieldData.fields[i].qName
            };
          }
          if(fieldData.fields[i].qCardinal > cardinalityLimit){
            if(!this.appFieldsByTag.$possibleMeasure){
              this.appFieldsByTag.$possibleMeasure = {}
            }
            this.appFieldsByTag.$possibleMeasure[fieldName] = {fieldName: fieldData.fields[i].qName};
          }
        }
        tempFields.sort(function(a,b){
          return b.fieldName.split("_").length - a.fieldName.split("_").length
        })
        for (var i = 0; i < tempFields.length; i++) {
          this.appFields[tempFields[i].fieldName] = tempFields[i]
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
