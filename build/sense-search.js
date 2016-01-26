var SenseSearchInput = (function(){

  var inputTimeout;
  var ignoreKeys = [
    16,
    27
  ];
  var reservedKeys = [ //these keys should not execute another search, they are reserved for the suggestions mechanism or are navigationkeys (page up/page down)
    9,
    13,
    38,
    40,
    39,
    37,
    32,
    33,
    34
  ];

  var Key = {
      BACKSPACE: 8,
      ESCAPE: 27,
      TAB: 9,
      ENTER: 13,
      SHIFT: 16,
      UP: 38,
      DOWN: 40,
      RIGHT: 39,
      LEFT: 37,
      DELETE: 46,
      SPACE: 32
  };

  var templateHtml = "<div class='sense-search-input-main'><div id='{id}_ghost' class='sense-search-input-bg'></div><input id='{id}_input' autofocus placeholder='Please wait...' disabled='disabled' type='text' autocorrect='off' autocomplete='off' autocapitalize='off' spellcheck='false' /><div class='sense-search-lozenge-container'></div><button type='button' class='sense-search-input-clear'>x</button></div><div id='{id}_suggestions' class='sense-search-suggestion-container'><ul id='{id}_suggestionList'></ul></div><div id='{id}_associations' class='sense-search-association-container'><ul id='{id}_associationsList'></ul></div>";

  function SenseSearchInput(id, options){
    var element = document.createElement("div");
    element.id = id;
    element.classList.add("sense-search-input-container");
    var html = templateHtml.replace(/{id}/gim, id);
    element.innerHTML = html;
    options = options || {};
    for(var o in options){
      this[o] = options[o];
    }
    this.id = id;
    element.onkeyup = this.onKeyUp.bind(this);
    element.onkeydown = this.onKeyDown.bind(this);
    element.onclick = this.onClick.bind(this);
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
    if(this.searchFields && !Array.isArray(this.searchFields) && this.searchFields.length){
      this.searchFields = this.searchFields.split(",");
    }
    if(this.suggestFields && !Array.isArray(this.suggestFields) && this.suggestFields.length){
      this.suggestFields = this.suggestFields.split(",");
    }
    this.searchTimeout = this.searchTimeout || 300;
    this.suggestTimeout = this.suggestTimeout || 100;
    senseSearch.ready.subscribe(this.activate.bind(this));
    senseSearch.cleared.subscribe(this.onClear.bind(this));
    return {element: element, object: this};
  }

  SenseSearchInput.prototype = Object.create(Object.prototype, {
    id:{
      writable: true,
      value: null
    },
    attach:{
      value: function(options){
        if(options){
          for(var o in options){
            this[o] = options[o];
          }
        }
        if(senseSearch && senseSearch.exchange.connection){
          senseSearch.searchAssociations.subscribe(this.onSearchAssociations.bind(this));
          senseSearch.suggestResults.subscribe(this.onSuggestResults.bind(this));
          if(!senseSearch.inputs[this.id]){
            senseSearch.inputs[this.id] = this;
          }
        }
      }
    },
    searchText:{
      writable: true,
      value: null
    },
    searchFields:{
      writable: true,
      value: []
    },
    suggestFields:{
      writable: true,
      value: []
    },
    searchTimeout:{
      writable: true,
      value: null
    },
    suggestTimeout:{
      writable: true,
      value: null
    },
    searchTimeoutFn:{
      writable: true,
      value: null
    },
    suggestTimeoutFn:{
      writable: true,
      value: null
    },
    suggesting:{
      writable: true,
      value: false
    },
    suggestingTimeout:{
      writable: true,
      value: 3000
    },
    suggestingTimeoutFn:{
      writable: true,
      value: null
    },
    activeSuggestion:{
      writable: true,
      value: 0
    },
    ghostPart: {
      writable: true,
      value: null
    },
    ghostQuery:{
      writable: true,
      value: null
    },
    ghostDisplay: {
      writable: true,
      value: null
    },
    cursorPosition:{
      writable: true,
      value: 0
    },
    mode: {
      writable: true,
      value: "simple"
    },
    onClear: {
      value: function(){
        document.getElementById(this.id+'_input').value = "";
        this.searchText = "";
        this.hideSuggestions();
      }
    },
    onSearchResults:{
      value: function(){

      }
    },
    onSearchAssociations:{
      value: function(associations){
        console.log("associations");
        console.log(associations);
        this.associations = associations.qResults;
        this.showAssociations();
      }
    },
    onSuggestResults:{
      value: function(suggestions){
        this.suggestions = suggestions.qSuggestions;
        this.suggestions.splice(5, suggestions.qSuggestions.length - 4);
        if(this.suggestions.length > 0){
          this.activeSuggestion = 0;
        }
        this.showSuggestions();
      }
    },
    clear:{
      value: function(){
        senseSearch.clear();
      }
    },
    onClick:{
      value: function(event){
        console.log(event);
        if(event.target.classList.contains('sense-search-input-clear')){
          //the clear button was clicked
          event.stopPropagation();
          this.clear();
        }
        else if (event.target.classList.contains('sense-search-suggestion-item')) {
          //a suggestion was clicked
          event.stopPropagation();
          this.activeSuggestion = parseInt(event.target.attributes['data-index'].value);
          this.drawGhost(); //this gets the text ready for using as the new value
          this.acceptSuggestion();
        }
      }
    },
    onKeyDown: {
      value: function(event){
        if(event.keyCode == Key.ESCAPE){
            this.hideSuggestions();
            return;
          }
          else if(event.keyCode == Key.DOWN){
            //show the suggestions again
            this.showSuggestions();
          }
          else if(event.keyCode == Key.RIGHT){
            if(this.suggesting){
              //activate the next suggestion
              event.preventDefault();
              this.nextSuggestion();
            }
          }
          else if(event.keyCode == Key.LEFT){
            if(this.suggesting){
              //activate the previous suggestion
              event.preventDefault();
              this.prevSuggestion();
            }
          }
          else if(event.keyCode == Key.ENTER || event.keyCode == Key.TAB){
            if(this.suggesting){
              event.preventDefault();
              this.acceptSuggestion();
            }
          }
          else if(event.keyCode == Key.SPACE){
            //we'll check here to make sure the latest term is at least 2 characters
            if(this.searchText.split(" ").length==5){
              alert('Too many search terms');
              event.preventDefault();
              return false;
            }
            else if($scope.searchText.split(" ").pop().length==1){
              alert('cannot search for single character strings');
              event.preventDefault();
              return false;
            }
            else{
              this.hideSuggestions();
            }
          }
          else{
            this.hideSuggestions();
          }
      }
    },
    onKeyUp: {
      value: function(event){
        this.searchText = document.getElementById(this.id+'_input').value;
        this.cursorPosition = event.target.selectionStart;
          if(ignoreKeys.indexOf(event.keyCode) != -1){
            return;
          }
          if(reservedKeys.indexOf(event.keyCode) == -1){
            if(this.searchText && this.searchText.length > 0){
              //we'll check here to make sure the latest term is at least 2 characters before searching
              if(this.searchText.split(" ").pop().length>1){
                var that = this;
                if(this.searchTimeoutFn){
                  clearTimeout(this.searchTimeoutFn);
                }
                this.searchTimeoutFn = setTimeout(function(){
                  that.search();
                }, this.searchTimeout);

                if(this.searchText.length > 1 && this.cursorPosition==this.searchText.length){
                  if(this.suggestTimeoutFn){
                    clearTimeout(this.suggestTimeoutFn);
                  }
                  this.suggestTimeoutFn = setTimeout(function(){
                    that.suggest();
                  }, this.suggestTimeout);
                }
              }
            }
            else{
              //clear the search
              this.clear();
            }
          }
      }
    },
    showSuggestions:{
      value: function(){
        this.startSuggestionTimeout();

        if(this.searchText && this.searchText.length > 1 && this.cursorPosition==this.searchText.length && this.suggestions.length > 0){
          this.suggesting = true;
          //render the suggested completion
          this.drawGhost();
          //render the suggestions
          document.getElementById(this.id+"_suggestions").style.display = "block";
          this.drawSuggestions();
        }
        else{
          this.suggesting = false;
          this.removeGhost();
          this.hideSuggestions();
        }
      }
    },
    hideSuggestions:{
      value: function(){
        this.suggesting = false;
        this.activeSuggestion = 0;
        this.ghostPart = "";
        this.ghostQuery = "";
        this.ghostDisplay = "";
        this.removeGhost();
        document.getElementById(this.id+"_suggestions").style.display = "none";
      }
    },
    showAssociations: {
      value: function(){
        var html = "";
        for (var i=0;i<this.associations.qSearchTermsMatched.length;i++){ //loops through each search term match group
          var termsMatched = this.associations.qSearchTermsMatched[i];
          for (var j=0;j<termsMatched.length;j++){  //loops through each valid association
            html += "<li>";
            for(var k=0;k<termsMatched[j].qFieldMatches.length;k++){  //loops through each field in the association
              var fieldMatch = termsMatched[j].qFieldMatches[k];
              html += "<div>";
              html += this.associations.qFieldNames[fieldMatch.qField];
              html += "</div>";
            }
            html += j
            html += "</li>";
          }
        }
        document.getElementById(this.id+"_associationsList").innerHTML = html;
        document.getElementById(this.id+"_associations").style.display = "block";
      }
    },
    hideAssociations: {
      value: function(){

      }
    },
    startSuggestionTimeout:{
      value: function(){
        if(this.suggestingTimeoutFn){
          clearTimeout(this.suggestingTimeoutFn);
        }
        this.suggestingTimeoutFn = setTimeout(function(){
          //close the suggestions after inactivity for [suggestingTimeout] milliseconds
          this.hideSuggestions.call(this);
        }.bind(this), this.suggestingTimeout);
      }
    },
    nextSuggestion:{
      value: function(){
        this.startSuggestionTimeout();
        if(this.activeSuggestion==this.suggestions.length-1){
          this.activeSuggestion = 0;
        }
        else{
          this.activeSuggestion++;
        }
        this.drawGhost();
        this.highlightActiveSuggestion();
      }
    },
    prevSuggestion: {
      value: function(){
        this.startSuggestionTimeout();
        if(this.activeSuggestion==0){
          this.activeSuggestion = this.suggestions.length-1;
        }
        else{
          this.activeSuggestion--;
        }
        this.drawGhost();
        this.highlightActiveSuggestion();
      }
    },
    acceptSuggestion:{
      value: function(){
        this.searchText = this.ghostQuery;
        this.suggestions = [];
        this.hideSuggestions();
        document.getElementById(this.id+'_input').value = this.searchText;
        this.search();
      }
    },
    search:{
      value: function(){
        senseSearch.search(this.searchText, this.searchFields || [], this.mode);
      }
    },
    suggest:{
      value: function(){
        senseSearch.suggest(this.searchText, this.suggestFields || []);
      }
    },
    drawGhost:{
      value: function(){
        this.ghostPart = getGhostString(this.searchText, this.suggestions[this.activeSuggestion].qValue);
        this.ghostQuery = this.searchText + this.ghostPart;
        var ghostDisplay = "<span style='color: transparent;'>"+this.searchText+"</span>"+this.ghostPart;
        document.getElementById(this.id+"_ghost").innerHTML = ghostDisplay;
      }
    },
    removeGhost:{
      value: function(){
        document.getElementById(this.id+"_ghost").innerHTML = "";
      }
    },
    drawSuggestions:{
      value: function(){
        var suggestionsHtml = "";
        for (var i=0;i<this.suggestions.length;i++){
          suggestionsHtml += "<li id='"+this.id+"_suggestion_"+i+"' class='sense-search-suggestion-item' data-index='"+i+"'>";
          suggestionsHtml += this.suggestions[i].qValue;
          suggestionsHtml += "</li>";
        }
        document.getElementById(this.id+"_suggestionList").innerHTML = suggestionsHtml;
        this.highlightActiveSuggestion();
      }
    },
    highlightActiveSuggestion:{
      value: function(){
        //remove all previous highlights
        var parent = document.getElementById(this.id+"_suggestionList");
        for (var c=0; c < parent.childElementCount;c++){
          parent.childNodes[c].classList.remove("active");
        }
        //add the 'active' class to the current suggestion
        document.getElementById(this.id+"_suggestion_"+this.activeSuggestion).classList.add("active");
      }
    },
    activate:{
      value: function(){
        this.attach();
        var el = document.getElementById(this.id+"_input");
        el.attributes["placeholder"].value = "Enter up to 5 search terms";
        el.disabled = false;
      }
    }
  });

  function getGhostString(query, suggestion){
    var suggestBase = query;
    if(suggestion.toLowerCase().indexOf(suggestBase.toLowerCase())!=-1){
      //the suggestion pertains to the whole query

    }
    else if(suggestion.length > suggestBase.length){
      //this must apply to a substring of the query
      while(suggestion.toLowerCase().indexOf(suggestBase.toLowerCase())==-1){
        suggestBase = suggestBase.split(" ");
        suggestBase.splice(0,1);
        suggestBase = suggestBase.join(" ");
      }
    }
    while(suggestBase.length >= suggestion.length && suggestBase.toLowerCase()!=suggestion.toLowerCase()){
      suggestBase = suggestBase.split(" ");
      suggestBase.splice(0,1);
      suggestBase = suggestBase.join(" ");
    }
    var re = new RegExp(suggestBase, "i")
    return suggestion.replace(re,"");
  }

  return SenseSearchInput;
}());

var SenseSearchResult = (function(){

  var templateHtml = "<div id='{id}_results' class='sense-search-results'></div>";

  function SenseSearchResult(id, options){
    var element = document.createElement("div");
    element.id = id;
    element.classList.add("sense-search-results-container");
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
      value: function(options, callbackFn){
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
            if(typeof(callbackFn)==="function"){
              callbackFn.call(null);
            }
          });
          senseSearch.searchResults.subscribe(this.onSearchResults.bind(this));
          senseSearch.noResults.subscribe(this.onNoResults.bind(this));
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
        this.data = []; //after each new search we clear out the previous results
        this.pageTop = 0;
        this.getHyperCubeData();
      }
    },
    onNoResults: {
      value:  function(){
        this.renderItems([]);
      }
    },
    getNextBatch:{
      value: function(){
        this.pageTop += this.pageSize;
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
            that.data = that.data.concat(items);
            that.renderItems(items);
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
    },
    renderItems:{
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
          document.getElementById(this.id+"_results").innerHTML = html;
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


var SenseSearch = (function(){

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
      else if(connectionType=="CapabilityAPI"){
        this.connection = options;
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
            default:

          }(this.connectionType=="Native")
        }
      },
      askNative:{
        value: function(handle, method, args, callbackFn){
          var that = this;
          this.seqId++;
          this.connection.ask(handle, method, args, this.seqId, function(response){
            if(response.error){

            }
            else{
              callbackFn.call(null, response);
            }
          });
        }
      },
      askQSocks:{
        value: function(handle, method, args, callbackFn){
          var that = this;
          this.seqId++;
          this.connection.ask(handle, method, args, this.seqId).then(function(response){
            if(response.error){

            }
            else{
              callbackFn.call(null, response);
            }
          });
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
          });
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


  function SenseSearch(){
    this.ready = new Subscription();
    this.searchResults = new Subscription();
    this.searchAssociations = new Subscription();
    this.noResults = new Subscription();
    this.suggestResults = new Subscription();
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
        this.exchange = new Exchange(app.global.session, "CapabilityAPI");
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
    search: {
      value: function(searchText, searchFields, mode, context){
        var that = this;
        mode = mode || "simple";
        context = context || this.context || "LockedFieldsOnly"
        this.pendingSearch = this.exchange.seqId+1;
        this.terms = searchText.split(" ");
        this.exchange.ask(this.appHandle, "SearchAssociations", [{qContext: context, qSearchFields: searchFields}, this.terms, {qOffset: 0, qCount: 5, qMaxNbrFieldMatches: 5}], function(response){
          if(response.id == that.pendingSearch){
            if(searchText== "" || response.result.qResults.qTotalSearchResults>0){
              if(mode=="simple"){
                that.selectAssociations(searchFields, context, 0);
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
        });
      }
    },
    selectAssociations: {
      value: function(searchFields, context, resultGroup){
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
    clear:{
      value: function(){
        this.terms = null;
        this.cleared.deliver();
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
    suggestResults:{
      writable: true,
      value: null
    }
  });

  return SenseSearch;
}());

var senseSearch = new SenseSearch();
senseSearch.init();
