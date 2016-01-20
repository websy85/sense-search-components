var SenseSearchResult = (function(){
  function SenseSearchResult(id, options){
    var element = document.createElement("div");
    element.id = id;
    element.classList.add("sense-search-results-container");
    //var html = templateHtml.replace(/{id}/gim, id);
    //element.innerHTML = html;
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
    attach:{
      value: function(options){
        var that = this;
        if(options){
          for(var o in options){
            this[o] = options[o];
          }
        }
        if(senseSearch && senseSearch.exchange.connection){
          var hDef = this.buildHyperCubeDef();
          senseSearch.exchange.ask(senseSearch.appHandle, "CreateSessionObject", [hDef], function(response){
            that.handle = response.result.qReturn.qHandle;
          });
          senseSearch.searchResults.subscribe(this.onSearchResults.bind(this));
          senseSearch.results[this.id] = this;
        }
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
          	"qInterColumnSortOrder": this.getFieldIndex(this.defaultSort, false)
          }
        };
        return hDef;
      }
    },
    onSearchResults:{
      value: function(results){
        this.getHyperCubeData();
      }
    },
    getHyperCubeData:{
      value: function () {
        var that = this;
        senseSearch.exchange.getLayout(this.handle, function(response){
          var layout = response.result.qLayout;
          var qFields = layout.qHyperCube.qDimensionInfo.concat(layout.qHyperCube.qMeasureInfo);
          senseSearch.exchange.ask(that.handle, "GetHyperCubeData", ["/qHyperCubeDef", [{qTop: that.pageTop, qLeft:0, qHeight: that.pageSize, qWidth: that.fields.length }]], function(response){
            var data = response.result.qDataPages;
            var items = [];
            for(var i=0;i<data[0].qMatrix.length;i++){
              var item = {}
              //if the nullSuppressor field is null then we throw out the row
              if(this.nullSuppressor && this.nullSuppressor!=null && data[0].qMatrix[i][$scope.config.nullSuppressor].qText=="-"){
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
            this.data = items;
            var html = "";
            for (var i=0;i<this.data.length;i++){
              html += "<div class='sense-search-result'>";
              for(var f in this.data[i]){
                html += "<div>";
                html += "<strong>";
                html += f;
                html += ":</strong>";
                html += this.data[i][f].html;
                html += "</div>";
              }
              html += "</div>";
            }
            document.getElementById(that.id).innerHTML = html;
          });
        });
      }
    },
    getFieldIndex: {
      value: function(field, asString){
          for (var i=0;i<this.fields.length;i++){
            if(this.fields[i].dimension && this.fields[i].dimension==field){
              if(asString!=undefined && asString==false){
                return [i];
              }
              else {
                return "["+i+"]";
              }
            }
            else if (this.fields[i].label && this.fields[i].label==field) {
              if(asString!=undefined && asString==false){
                return [i];
              }
              else {
                return "["+i+"]";
              }
            }
          }
          return 0;
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
          sort[sorting[fields[i].dimension].sortType] = sorting[fields[i].dimension].order;
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
          def["qSortBy"][fields[i].sortType] = fields[i].order;
        }
        defs.push(def);
      }
    };
    return defs;
  }

  return SenseSearchResult;
}());
