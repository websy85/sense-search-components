var SenseSearchResult = (function(){

  var templateHtml = "<div id='{id}_results_loading' class='sense-search-results_loading on'><div class='sense-search-results_loading-spinner'>Loading...</div></div><div id='{id}_results' class='sense-search-results'></div>";

  function SenseSearchResult(id, options){
    var element = document.createElement("div");
    element.id = id;
    element.classList.add("sense-search-results-container");
    this.resultsElement = id + "_results";
    this.loadingElement = id + "_results_loading";
    var html = templateHtml.replace(/{id}/gim, id);
    element.innerHTML = html;
    options = options || {};
    for(var o in options){
      this[o] = options[o];
    }
    this.id = id;
    var oldElement = document.getElementById(id);
    if (oldElement) {
        if (oldElement.insertAdjacentElement) {
            oldElement.insertAdjacentElement("afterEnd", element);
        } else {
            oldElement.insertAdjacentHTML("afterEnd", element.outerHTML);
        }

        for (var i = 0; i < oldElement.attributes.length; i++) {
            this[oldElement.attributes[i].name] = oldElement.attributes[i].value;
        }
        oldElement.parentNode.removeChild(oldElement);
    }
    senseSearch.ready.subscribe(this.activate.bind(this));
    return {element: element, object: this};
  }

  SenseSearchResult.prototype = Object.create(Object.prototype, {
    id:{
      writable:  true,
      value: false
    },
    handle:{
      writable:  true,
      value: false
    },
    activate:{
      value: function(){
        this.attach();
      }
    },
    attached:{
      writable:  true,
      value: false
    },
    attach:{
      value: function(options, callbackFn){
        var that = this;
        if(options){
          for(var o in options){
            this[o] = options[o];
          }
        }
        this.currentSort = this.defaultSort;
        if(senseSearch && senseSearch.exchange.connection){
          if(options && options.fields){
            var hDef = this.buildHyperCubeDef();
            if(senseSearch.exchange.connectionType=="CapabilityAPI"){
              senseSearch.exchange.app.createCube(hDef.qHyperCubeDef, this.onSearchResults.bind(this)).then(function(response){
                console.log(response);
                that.handle = response.handle;
                if(typeof(callbackFn)==="function"){
                  callbackFn.call(null);
                }
              }, logError);
            }
            else {
              senseSearch.exchange.ask(senseSearch.appHandle, "CreateSessionObject", [hDef], function(response){
                that.handle = response.result.qReturn.qHandle;
                if(typeof(callbackFn)==="function"){
                  callbackFn.call(null);
                }
              });
            }
          }
          if(!this.attached){
            senseSearch.searchStarted.subscribe(this.onSearchStarted.bind(this));
            senseSearch.searchResults.subscribe(this.onSearchResults.bind(this));
            senseSearch.noResults.subscribe(this.onNoResults.bind(this));
            senseSearch.chartResults.subscribe(this.onChartResults.bind(this));
            senseSearch.cleared.subscribe(this.onClear.bind(this));
            this.attached = true;
          }
          senseSearch.results[this.id] = this;
        }
        this.hideLoading();
      }
    },
    fields:{
      writable: true,
      value: []
    },
    data:{
      writable: true,
      value: []
    },
    sortOptions:{
      writable: true,
      value: {}
    },
    defaultSort: {
      writable: true,
      value: null
    },
    currentSort: {
      writable: true,
      value: null
    },
    enableHighlighting:{
      writable: true,
      value: true
    },
    pageTop:{
      writable: true,
      value: 0
    },
    pageSize:{
      writable: true,
      value: 20
    },
    pagesLoaded:{
      writable: true,
      value: []
    },
    buildHyperCubeDef: {
      value: function(){
        var hDef = {
          "qInfo" : {
              "qType" : "table"
          },
          "qHyperCubeDef": {
            "qDimensions" : buildFieldDefs(this.fields, this.sortOptions),
            "qMeasures": buildMeasureDefs(this.fields),
          	"qSuppressZero": false,
          	"qSuppressMissing": false,
          	"qInterColumnSortOrder": this.getInterColumnSortOrder(this.getFieldIndex(this.defaultSort).index)
          }
        };
        return hDef;
      }
    },
    resultsElement: {
      writable: true,
      value: null
    },
    latestLayout:{
      writable: true,
      value: null
    },
    showLoading:{
      value: function(){
        var loadingElem = document.getElementById(this.loadingElement);
        if(loadingElem){
          loadingElem.classList.add('on');
        }
      }
    },
    hideLoading:{
      value: function(){
        var loadingElem = document.getElementById(this.loadingElement);
        if(loadingElem){
          loadingElem.classList.remove('on');
        }
      }
    },
    onSearchStarted:{
      value: function(){
        this.showLoading();
      }
    },
    onSearchResults:{
      value: function(results){
        this.hideLoading();
        this.data = []; //after each new search we clear out the previous results
        this.pageTop = 0;
        this.pagesLoaded = [];
        if(this.handle){
          this.getHyperCubeData();
        }
      }
    },
    onChartResults:{
      value: function(genericObject){
        console.log("Chart created");
        // console.log(genericObject);
        senseSearch.vizIdList.push(genericObject.id)
        this.hideLoading();
        var chartElem = document.createElement('div');
        chartElem.classList.add('chart-result');
        var parentElem = document.getElementById(this.resultsElement);
        parentElem.innerHTML = "";
        if(parentElem){
          parentElem.appendChild(chartElem);
        }
        if(senseSearch.exchange.connectionType=="CapabilityAPI"){
          genericObject.show(chartElem);
        }
      }
    },
    onNoResults: {
      writable: true,
      value:  function(){
        this.hideLoading();
        this.renderItems([]);
      }
    },
    onClear:{
      writable: true,
      value: function(){
        this.hideLoading();
        document.getElementById(this.id+"_results").innerHTML = "";
      }
    },
    getNextBatch:{
      value: function(){
        this.pageTop += this.pageSize;
        this.getHyperCubeData();
      }
    },
    getHyperCubeData:{
      value: function (callbackFn) {
        var that = this;
        senseSearch.exchange.getLayout(this.handle, function(response){
          var layout = response.result.qLayout;
          that.latestLayout = layout;
          console.trace();
          var qFields = layout.qHyperCube.qDimensionInfo.concat(layout.qHyperCube.qMeasureInfo);
          senseSearch.exchange.ask(that.handle, "GetHyperCubeData", ["/qHyperCubeDef", [{qTop: that.pageTop, qLeft:0, qHeight: that.pageSize, qWidth: that.fields.length }]], function(response){
            if(senseSearch.exchange.seqId==response.id){
              if(callbackFn && typeof(callbackFn)==="function"){
                callbackFn.call(this, response);
              }
              else {
                var data = response.result.qDataPages;
                var items = [];
                for(var i=0;i<data[0].qMatrix.length;i++){
                  var item = {}
                  //if the nullSuppressor field is null then we throw out the row
                  if(that.nullSuppressor && that.nullSuppressor!=null && data[0].qMatrix[i][that.nullSuppressor].qText=="-"){
                    continue;
                  }
                  for (var j=0; j < data[0].qMatrix[i].length; j++){
                    item[qFields[j].qFallbackTitle] = {
                      value: data[0].qMatrix[i][j].qText,
                      html: that.highlightText(data[0].qMatrix[i][j].qText)
                    }
                  }
                  items.push(item);
                }
                var pageIndex = (that.pageTop / that.pageSize);
                if(that.pagesLoaded.indexOf(pageIndex)==-1){
                  that.pagesLoaded.push(pageIndex);
                  that.data = that.data.concat(items);
                }
                that.renderItems(items);
              }
            }
          });
        });
      }
    },
    getFieldIndex: {
      value: function(field){
          for (var i=0;i<this.fields.length;i++){
            if(this.fields[i].dimension && this.fields[i].dimension==field){
              return {index: i, type: "dimension"};
            }
            else if (this.fields[i].label && this.fields[i].label==field) {
              return {index: i, type: "measure"};
            }
          }
          return 0;
        }
    },
    getInterColumnSortOrder: {
      value: function(sortIndex){
        var icso = [sortIndex];
        for (var i=0;i<this.fields.length;i++){
          if(i!=sortIndex){
            icso.push(i);
          }
        }
        return icso;
      }
    },
    highlightText:{
      value: function(text){
        if(senseSearch.terms && this.enableHighlighting){
          var terms = senseSearch.terms;
          for (var i=0;i<terms.length;i++){
            text = text.replace(new RegExp(terms[i], "i"), "<span class='highlight"+i+"'>"+terms[i]+"</span>")
          }
          return text;
        }
        else{
          return text;
        }
      }
    },
    renderItems:{
      writable: true,
      value: function(newItems){
        if(this.data.length > 0){
          var rList = document.getElementById(this.id+"_ul");
          if(!rList){
            rList = document.createElement("ul");
            rList.id = this.id+"_ul";
            document.getElementById(this.id+"_results").appendChild(rList);
          }
          var html = "";
          var columnCount = 0;
          for(var c in newItems[0]){
            columnCount++;
          }
          var columnWidth = Math.floor(100 / columnCount);
          //draw header row
          html += "<li>";
          for(var f in newItems[0]){
            html += "<div class='sense-search-result-cell' style='width: "+columnWidth+"%'>";
            html += "<strong>"+f+"</strong>"
            html += "</div>";
          }
          html += "</li>";
          for (var i=0;i<newItems.length;i++){
            html += "<li>";
            for(var f in newItems[i]){
              html += "<div class='sense-search-result-cell' style='width: "+columnWidth+"%'>";
              html += newItems[i][f].html;
              html += "</div>";
            }
            html += "</li>";
          }
          document.getElementById(this.id+"_ul").innerHTML = html;
        }
        else{
          html = "<h1>No Results</h1>";
          document.getElementById(this.resultsElement).innerHTML = html;
        }
      }
    },
    applySort:{
      value: function(sortId, startAtZero, reRender){
        var that = this;
        this.currentSort = sortId;
        startAtZero = startAtZero || false;
        reRender = reRender || false;
        senseSearch.exchange.ask(this.handle, "ApplyPatches", [[{
          qPath: "/qHyperCubeDef/qInterColumnSortOrder",
          qOp: "replace",
          qValue: JSON.stringify(that.getInterColumnSortOrder(that.getFieldIndex(sortId).index))
        }], true], function(){
          if(startAtZero){
            that.pageTop = 0;
            that.pagesLoaded = [];
          }
          if(reRender && reRender==true){
            that.getHyperCubeData();
          }
        });
      }
    },
    invertSort:{
      value: function(sortId, startAtZero, reRender){
        var that = this;
        var fieldIndex = this.getFieldIndex(sortId);
        var path;
        if(fieldIndex.type=="dimension"){
          path = "/qHyperCubeDef/qDimensions/"+fieldIndex.index+"/qDef/qReverseSort";
        }
        else{
          path = "/qHyperCubeDef/qMeasures/"+fieldIndex.index+"/qDef/qReverseSort";
        }
        var that = this;
        startAtZero = startAtZero || false;
        reRender = reRender || false;
        senseSearch.exchange.ask(this.handle, "ApplyPatches", [[
          {
            qPath: "/qHyperCubeDef/qInterColumnSortOrder",
            qOp: "replace",
            qValue: JSON.stringify(that.getInterColumnSortOrder(fieldIndex.index))
          },
          {
          qPath: path,
          qOp: "replace",
          qValue: "true"
        }], true], function(){
          if(startAtZero){
            that.pageTop = 0;
            that.pagesLoaded = [];
          }
          if(reRender && reRender==true){
            that.getHyperCubeData();
          }
        });
      }
    }
  });

  function buildFieldDefs(fields, sorting){
    var defs = [];
    for (var i=0;i<fields.length;i++){
      if(fields[i].dimension){
        var def = {
    			"qDef": {
    				"qFieldDefs": [fields[i].dimension]
          },
          qNullSuppression: fields[i].suppressNull
    		}
        if(sorting[fields[i].dimension]){
          var sort = {};
          if(typeof sorting[fields[i].dimension].sortType == "array"){
            for(var j=0;j<sorting[fields[i].dimension].sortType.length;j++){
              sort[sorting[fields[i].dimension].sortType[j]] = sorting[fields[i].dimension].order[j];
            }
          }
          else {
            sort[sorting[fields[i].dimension].sortType] = sorting[fields[i].dimension].order;
          }
          if(sorting[fields[i].dimension].sortExpression){
            sort.qExpression = sorting[fields[i].dimension].sortExpression;
          }
          def["qDef"]["qSortCriterias"] = [sort];
        }
        defs.push(def);
      }
    }
    return defs;
  }

  function buildMeasureDefs(fields){
    var defs = [];
    for (var i=0;i<fields.length;i++){
      if(fields[i].measure){
        var def = {
          "qDef": {
  					"qLabel": fields[i].label,
  					"qDescription": "",
  					"qDef": fields[i].measure
  				}
        }
        if(fields[i].sortType){
          def["qSortBy"] = {};
          if(typeof fields[i].sortType == "array"){
            for(var j=0;j<fields[i].sortType.length;j++){
              def["qSortBy"][fields[i].sortType[j]] = fields[i].order[j];
            }
          }
          else{
            def["qSortBy"][fields[i].sortType] = fields[i].order;
          }
        }
        defs.push(def);
      }
    };
    return defs;
  }

  return SenseSearchResult;
}());

function logError(err){
  console.log(err);
}
