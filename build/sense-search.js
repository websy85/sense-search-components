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
      CONTROL: 17,
      COMMAND: 91,
      PASTE: 86,
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

  var templateHtml = "<div class='sense-search-input-main'><div id='{id}_ghost' class='sense-search-input-bg'></div><input id='{id}_input' autofocus placeholder='Please wait...' disabled='disabled' type='text' autocorrect='off' autocomplete='off' autocapitalize='off' spellcheck='false' /><div id='{id}_lozenges' class='sense-search-lozenge-container'></div><div id='{id}_ambiguities' class='sense-search-ambiguity-container'></div><button type='button' class='sense-search-input-clear'>x</button></div><div id='{id}_suggestions' class='sense-search-suggestion-container'><ul id='{id}_suggestionList'></ul></div><div id='{id}_associations' class='sense-search-association-container'><ul id='{id}_associationsList'></ul></div>";

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
    //check if nlp_compromise is being used and if not disallow the allowNLP option
    if(window.nlp_compromise && this.mode=="visualizations"){
      this.allowNLP = true;
    }
    else if(!window.nlp_compromise){
      this.allowNLP = false;
    }
    this.id = id;
    element.onkeyup = this.onKeyUp.bind(this);
    element.onkeydown = this.onKeyDown.bind(this);
    element.onclick = this.onClick.bind(this);
    var oldElement = document.getElementById(id);
    if (oldElement) {
        if(oldElement.attributes["mode"]){
          element.setAttribute("data-mode", oldElement.attributes["mode"].value);
        }
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
    this.chartTimeout = this.chartTimeout || 300;
    senseSearch.ready.subscribe(this.activate.bind(this));
    senseSearch.fieldsFetched.subscribe(this.fieldsFetched.bind(this));
    senseSearch.cleared.subscribe(this.onClear.bind(this));
    return {element: element, object: this};
  }

  SenseSearchInput.prototype = Object.create(Object.prototype, {
    id:{
      writable: true,
      value: null
    },
    MAX_SEARCH_TERMS:{
      writable: true,
      value: 10
    },
    attach:{
      value: function(options){
        if(options){
          for(var o in options){
            this[o] = options[o];
          }
        }
        if(this.mode=="visualizations"){
          //get the field list
          senseSearch.getAppFields();
        }
        else{
          this.activateInput();
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
    isCutCopyPaste:{
      writable: true,
      value: false
    },
    isPaste:{
      writable: true,
      value: false
    },
    searchText:{
      writable: true,
      value: null
    },
    currentTerm:{
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
    chartTimeout:{
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
    chartTimeoutFn: {
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
    allowNLP:{
      writable: true,
      value: false
    },
    nlpTerms:{
      writable: true,
      value: []
    },
    nlpResolvedTerms:{
      writable: true,
      value: {}
    },
    nlpDistinctTerms: {
      writable: true,
      value: {}
    },
    nlpTermsIndexes:{
      writable: true,
      value: []
    },
    nlpTermsPositions:{
      writable: true,
      value: []
    },
    nlpModel:{
      value: {
        fieldNounMap:{},
        functionMap:{
          "avg": "avg",
          "average": "avg",
          "count": "count",
          "how many": "count",
          "sum": "sum",
          "total": "sum",
          "how much": "sum",
          "min": "min",
          "max": "max"
        },
        defaultFunction: "sum",
        currencySymbol: "£",
        misc:[
          "by",
          "as",
          "me",
          "not"
        ],
        joining:[
          "and"
        ],
        comparatives:{
          "more": ">",
          "less": "<",
          "greater": ">",
          "above": ">",
          "below": "<",
          "cheaper": "<"
        },
        conditionals:[
          "where",
          "for",
          "is",
          "from"
        ],
        sorting:[
          "order",
          "ordered",
          "sort",
          "sorted"
        ],
        sortorder:{
          "asc": 1,
          "ascending": 1,
          "desc": -1,
          "descending": -1
        },
        vizTypeMap:{
          "kpi": "kpi",
          "barchart": "barchart",
          "linechart": "linechart",
          "piechart": "piechart",
          "table": "table",
          "treemap": "treemap",
          "scatter": "scatterplot"
        }
      }
    },
    fieldsFetched: {
      value: function(fields){
        console.log(senseSearch.appFieldsByTag);
        console.log(senseSearch.appFields);
        this.activateInput();
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
    suggestions:{
      writable: true,
      value: null
    },
    associations:{
      writable: true,
      value: null
    },
    ambiguities:{
      writable: true,
      value: null
    },
    mode: {
      writable: true,
      value: "associations"
    },
    onClear: {
      value: function(){
        var inputEl = document.getElementById(this.id+'_input');
        if(inputEl){
          inputEl.value = "";
        }
        this.searchText = "";
        this.nlpTerms = [];
        this.nlpResolvedTerms = {};
        this.nlpTermsPositions = [];
        this.currentTerm = null;
        this.hideSuggestions();
        this.clearLozenges();
      }
    },
    onSearchResults:{
      value: function(){

      }
    },
    onSearchAssociations:{
      value: function(associations){
        this.associations = associations.qResults;
        if(this.mode=="associations"){
          this.showAssociations();
        }
        else{
          console.log('ambiguities');
          console.log(this.associations);
          var terms = this.getTermByText(this.associations.qSearchTerms[this.associations.qSearchTerms.length-1]);
          var termIndexes = this.getTermIndexByText(this.associations.qSearchTerms[this.associations.qSearchTerms.length-1]);
          //build the lozenges that separate the terms
          for(var t=0;t<terms.length;t++){
            if(this.associations.qFieldNames.length==0){
              //we have no use for this terms
              terms[t].queryTag = "!!";
              this.buildLozenges();
            }
            else if(this.associations.qFieldNames.length==1){
              terms[t].senseTag = this.associations.qFieldNames[0];
              terms[t].senseType = "value";
              terms[t].senseInfo = {
                field: senseSearch.appFields[this.associations.qFieldNames[0]],
                fieldSelection: "="
              };
              var cti = termIndexes[t];
              if(this.nlpTerms[cti-1] && this.nlpTerms[cti-1].text && this.nlpTerms[cti-1].text.toLowerCase()==="not"){
                terms[t].senseInfo.fieldSelection = "-="
              }
              this.buildLozenges();
              this.nlpViz();
            }
            else{
              terms[t].senseType = "?";
              terms[t].extra = {
                fields: this.associations.qFieldNames
              }
              this.buildLozenges();
            }
          }
        }
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
    getTerm: {
      value: function(text){
        return this.nlpTerms[text.replace(/ /gi, "_")];
      }
    },
    setCurrentTerm: {
      value: function(terms){
        this.currentTerm = terms[this.getCurrentTermIndex()];
      }
    },
    getTermByText: {
      value: function(text){
        var terms = []; //we could have multiple terms with the same text so we return an Array
        for (var t=0;t<this.nlpTerms.length;t++){
          if(this.nlpTerms[t].text == text && (!this.nlpTerms[t].senseType || this.nlpTerms[t].senseType=="")){
            terms.push(this.nlpTerms[t]);
          }
        }
        return terms;
      }
    },
    getTermIndexByText: {
      value: function(text){
        var terms = []; //we could have multiple terms with the same text so we return an Array
        for (var t=0;t<this.nlpTerms.length;t++){
          if(this.nlpTerms[t].text == text && (!this.nlpTerms[t].senseType || this.nlpTerms[t].senseType=="")){
            terms.push(t);
          }
        }
        return terms;
      }
    },
    getCurrentTermIndex: {
      value: function(){
        return this.nlpTermsPositions[this.cursorPosition-1];
      }
    },
    processTerms:{
      value: function(text, currentTermOnly){
        text = text.toLowerCase();
        var processedText = text;
        var terms = [];
        //loop through all fields to see if there is a match
        //first we check measures
        for (var f in senseSearch.appFields){
          var fieldName, fieldType;
          if(senseSearch.appFields[f].qInfo){
            fieldName = senseSearch.appFields[f].qData.title;
            if(senseSearch.appFields[f].qInfo.qType==="measure"){
              fieldType = "exp";
            }
            else{
              fieldType = "dim";
            }
          }
          else{
            fieldName = senseSearch.appFields[f].qName;
            if(senseSearch.appFieldsByTag.$measure && senseSearch.appFieldsByTag.$measure[f]){
              fieldType = "exp";
            }
            else{
              fieldType = "dim";
            }
          }
          var normalizedName = normalizeText(fieldName);
          var parsedName = parseText(normalizedName);
          var fieldPos = text.indexOf(parsedName);
          var aliasFieldPos = -1;
          if(fieldPos == -1 && this.nlpModel.fieldNounMap[parsedName]){
            aliasFieldPos = text.indexOf(this.nlpModel.fieldNounMap[parsedName].toLowerCase());
            fieldName = this.nlpModel.fieldNounMap[parsedName];
            parsedName = this.nlpModel.fieldNounMap[parsedName].toLowerCase();
          }
          if(fieldPos!==-1 || aliasFieldPos!==-1){
            var pos = fieldPos===-1?aliasFieldPos:fieldPos;
            processedText = processedText.replace(parsedName, ";||"+parsedName+";");
            var newTerm = {
              name: f,
              text: fieldName,
              parsedText: parsedName,
              position: pos,
              length: fieldName.length,
              senseType: fieldType,
              queryTag: fieldType,
              senseInfo: {
                field: senseSearch.appFields[f]
              }
            };
            if(senseSearch.appFieldsByTag.$time && senseSearch.appFieldsByTag.$time[f]){
              newTerm.senseInfo.type = "time";
            }
            terms.push(newTerm);
          }
        }
        //now we need to fill in the blanks with the rest of the terms
        var wordGroups = processedText.split(";");
        var wordGroupsCumulativeLengths = [];
        console.log(wordGroups);
        for(var g=0;g<wordGroups.length;g++){
          var cLength = 0;
          if(g==0){
            cLength = 0;
          }
          else{
            cLength = (wordGroupsCumulativeLengths[g-1]+wordGroups[g-1].replace("||","").length);
          }
          wordGroupsCumulativeLengths.push(cLength);
          if(wordGroups[g].indexOf("||")==-1 && wordGroups[g].length>0){
            //we have unprocessed info
            var words = wordGroups[g].split(" ");
            for (var w=0;w<words.length;w++){
              if(words[w].length>0){
                terms.push({
                  name: words[w],
                  text: words[w],
                  parsedText: words[w],
                  position: cLength,
                  length: words[w].length
                });
              }
            }
          }
        }
        terms.sort(function(a,b){
          if(a.position < b.position){
            return -1;
          }
          if(a.position > b.position){
            return 1;
          }
          return 0;
        });
        this.createTermPosArray(terms);
        // if(currentTermOnly===true){
        //   this.setCurrentTerm(terms);
        //   var currentTermIndex = this.getCurrentTermIndex();
        //   var term = this.tagTerm(this.currentTerm);
        //   this.nlpTerms.splice(currentTermIndex, 1, term);
        // }
        // else {
          this.nlpTerms = [];
          for (var t=0;t<terms.length;t++){
            if(this.nlpResolvedTerms[terms[t].name]){
              this.nlpTerms.push(this.nlpResolvedTerms[terms[t].name]);
            }
            else{
              var taggedTerm = this.tagTerm(terms[t]);
              this.nlpTerms.push(taggedTerm);
            }
          }
        // }
        console.log(this.nlpTerms);
      }
    },
    createTermPosArray: {
      value: function(terms){
        this.nlpTermsPositions = [];
        for (var t=0;t<terms.length;t++){
          var termCharacters = terms[t].text.split("");
          for(var c=0;c<termCharacters.length;c++){
            this.nlpTermsPositions.push(t);
          }
          if(t<terms.length-1){
            this.nlpTermsPositions.push(-1);
          }
          else if(t==terms.length-1){
            if(this.searchText.split("").pop==" "){
              this.nlpTermsPositions.push(-1);
            }
          }
        }
        console.log(this.nlpTermsPositions);
      }
    },
    tagTerm: {
      value: function(term){
        var termText = term.text.toLowerCase();
        var currentTermIndex = this.getCurrentTermIndex();
        // term.senseTag = "";
        // term.queryTag = "";

        if(!term.queryTag){
          if (this.nlpModel.functionMap[termText]) {
            term.senseType = "function";
            term.senseInfo = {
              func: this.nlpModel.functionMap[termText]
            };
            term.queryTag = "function";
          }
          else if (this.nlpModel.sorting.indexOf(termText)!=-1) {
            term.queryTag = "sorting";
          }
          else if (this.nlpModel.sortorder[termText]) {
            term.queryTag = "sortorder";
            if(this.nlpTerms[currentTermIndex-1] && this.nlpTerms[currentTermIndex-1].queryTag==="sort by"){
              this.nlpTerms[currentTermIndex-1].senseInfo.order = this.nlpModel.sortorder[termText];
            }
            else {
              term.senseType = "sortorder";
              term.senseInfo = {order: this.nlpModel.sortorder[termText]};
            }
          }
          else if (this.nlpModel.vizTypeMap[termText]) {
            term.queryTag = "viz";
            term.senseType = "viz";
            term.senseInfo = {
              viz: this.nlpModel.vizTypeMap[termText]
            };
          }
          else if (this.nlpModel.comparatives[termText]) {
            // term.queryTag = "comparative";
            term.queryTag = "!";
          }
          else if (this.nlpModel.conditionals.indexOf(termText)!=-1) {
            // term.queryTag = "condition";
            term.queryTag = "!";
          }
          else if (this.nlpModel.misc.indexOf(termText)!=-1) {
            term.queryTag = "!";
          }
          else{
            // do nothing
          }
        }

        return term;
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
          this.clear();
        }
        else if (event.target.classList.contains('sense-search-suggestion-item')) {
          //a suggestion was clicked
          this.activeSuggestion = parseInt(event.target.attributes['data-index'].value);
          this.drawGhost(); //this gets the text ready for using as the new value
          this.acceptSuggestion();
        }
        else if (event.target.classList.contains('sense-search-association-item') || event.target.parentNode.classList.contains('sense-search-association-item')) {
          //an association was clicked
          var assocationIndex;
          if(event.target.classList.contains('sense-search-association-item')){
            //the li element was clicked
            assocationIndex = parseInt(event.target.attributes['data-index'].value);
          }
          else{
            //a child was clicked
            assocationIndex = parseInt(event.target.parentNode.attributes['data-index'].value);
          }
          senseSearch.selectAssociations(this.searchFields || [],  assocationIndex);
          this.hideAssociations();
          this.hideSuggestions();
        }
        else if (event.target.classList.contains('ambiguity')) {
          console.log(event);
          var term = event.target.attributes['data-term'].value;
          var ambiguityElement = document.getElementById('ambiguous_'+term.replace(/ /gi, "_"));
          if(ambiguityElement){
            ambiguityElement.style.display = 'initial';
          }
        }
        else if (event.target.classList.contains('ambiguous_resolve')) {
          var term = event.target.attributes['data-term'].value;
          var field = event.target.innerText;
          this.nlpTerms[term].senseType = "value";
          this.nlpTerms[term].queryTag = field;
          this.nlpTerms[term].senseInfo = {
            field: senseSearch.appFields[normalizeText(field)],
            fieldSelection: "="
          };
          if(this.nlpTerms[term-1] && this.nlpTerms[term-1].text && this.nlpTerms[term-1].text.toLowerCase()==="not"){
            this.nlpTerms[term].senseInfo.fieldSelection = "-="
          }
          this.nlpResolvedTerms[this.nlpTerms[term].name] = this.nlpTerms[term];
          this.buildLozenges();
          this.nlpViz();
        }
      }
    },
    onKeyDown: {
      value: function(event){
        console.log(event.keyCode);
        if(event.keyCode == Key.ESCAPE){
          this.hideSuggestions();
          return;
        }
        else if(event.keyCode == Key.CONTROL || event.keyCode == Key.COMMAND){
          //show the suggestions again
          this.isCutCopyPaste = true;
          return;
        }
        else if(event.keyCode == Key.PASTE && this.isCutCopyPaste){
          //show the suggestions again
          this.isPaste = true;
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
          if(this.searchText.split(" ").length==this.MAX_SEARCH_TERMS){
            alert('Too many search terms');
            event.preventDefault();
            return false;
          }
          else if(this.searchText.split(" ").pop().length==1){
            alert('cannot search for single character strings');
            event.preventDefault();
            return false;
          }
          else{
            this.hideSuggestions();
            this.hideAssociations();
          }
        }
        else{
          this.hideSuggestions();
          this.hideAssociations();
        }
      }
    },
    onKeyUp: {
      value: function(event){
        if(event.keyCode == Key.Control){
          this.isCutCopyPaste = false;
        }
        var inputEl = document.getElementById(this.id+'_input');
        if(inputEl){
          this.searchText = inputEl.value;
        }
        else{
          return;
        }
        this.cursorPosition = event.target.selectionStart;
        if(this.mode==="visualizations"){
          this.processTerms(this.searchText, !this.isPaste);
          this.buildLozenges();
          this.isPaste = false;
        }
        if(ignoreKeys.indexOf(event.keyCode) != -1){
          return;
        }
        if(reservedKeys.indexOf(event.keyCode) == -1){
          if(this.mode==="visualizations"){
            if(this.searchText && this.searchText.trim().length>1){
              var that = this;
              if(this.searchTimeoutFn){
                clearTimeout(this.searchTimeoutFn);
              }
              this.searchTimeoutFn = setTimeout(function(){
                for(var t=0;t<that.nlpTerms.length;t++){
                  if(!that.nlpTerms[t].senseType && !that.nlpTerms[t].queryTag){
                    that.searchForSingleTerm(that.nlpTerms[t].text);
                  }
                }
              }, this.searchTimeout);

                ////we're not suggesting for now for UX based reasons
                // if(this.searchText.length > 1 && this.cursorPosition==this.searchText.length){
                //   if(this.suggestTimeoutFn){
                //     clearTimeout(this.suggestTimeoutFn);
                //   }
                //   this.suggestTimeoutFn = setTimeout(function(){
                //     that.suggest();
                //   }, this.suggestTimeout);
                // }
              if(this.chartTimeoutFn){
                clearTimeout(this.chartTimeoutFn);
              }
              this.chartTimeoutFn = setTimeout(function(){
                that.nlpViz();
              }, this.chartTimeout);
            }
            if(!this.searchText || this.searchText.length == 0){
              this.clear();
            }
          }
          else{
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
      }
    },
    onPaste:{
      value: function(event){
        console.log('value pasted');
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
          var suggestEl = document.getElementById(this.id+"_suggestions");
          if(suggestEl){
            suggestEl.style.display = "block";
          }
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
        var suggestEl = document.getElementById(this.id+"_suggestions");
        if(suggestEl){
          suggestEl.style.display = "none";
        }
      }
    },
    showAssociations: {
      value: function(){
        var html = "";
        for (var i=0;i<this.associations.qSearchTermsMatched.length;i++){ //loops through each search term match group
          var termsMatched = this.associations.qSearchTermsMatched[i];
          for (var j=0;j<termsMatched.length;j++){  //loops through each valid association
            html += "<li class='sense-search-association-item' data-index='"+j+"'>";
            for(var k=0;k<termsMatched[j].qFieldMatches.length;k++){  //loops through each field in the association
              var extraClass = termsMatched[j].qFieldMatches.length>1?"small":"";
              var fieldMatch = termsMatched[j].qFieldMatches[k];
              var fieldName = this.associations.qFieldNames[fieldMatch.qField];
              var fieldValues = [];
              for (var v in fieldMatch.qValues){
                var highlightedValue = highlightAssociationValue(this.associations.qFieldDictionaries[fieldMatch.qField].qResult[v], fieldMatch.qTerms);
                fieldValues.push(highlightedValue);
              }
              html += "<div class='"+extraClass+"'>";
              html += "<h1>"+fieldName+"</h1>";
              for (var v=0; v < fieldValues.length; v++){
                html += fieldValues[v];
                if(v < fieldValues.length-1){
                  html += ", ";
                }
              }
              html += "</div>";
            }
            html += "</li>";
          }
        }
        var assListEl = document.getElementById(this.id+"_associationsList");
        if(assListEl){
          assListEl.innerHTML = html;
        }
        var assEl = document.getElementById(this.id+"_associations");
        if(assEl){
          assEl.style.display = "block";
        }
      }
    },
    hideAssociations: {
      value: function(){
        var assEl = document.getElementById(this.id+"_associations");
        if(assEl){
          assEl.style.display = "none";
        }
      }
    },
    buildLozenges: {
      value: function(){
        //for now we're doing all of this each time the event is fired. in future we may want to improve the logic here if performance is an issue
        var lozengeHTML = "";
        var ambiguityHTML = "";
        for(var t in this.nlpTerms){
          //lozengeHTML
          lozengeHTML += "<div class='lozenge' ";
          if(this.nlpTerms[t].queryTag && this.nlpTerms[t].queryTag!==""){
            lozengeHTML += " data-querytag='"+this.nlpTerms[t].queryTag+"'";
          }
          if(this.nlpTerms[t].senseType && this.nlpTerms[t].senseType!==""){
            lozengeHTML += " data-sensetag='"+this.nlpTerms[t].senseType+"'";
          }
          lozengeHTML += ">";
          lozengeHTML += this.nlpTerms[t].parsedText;
          lozengeHTML += "</div>";
          //ambiguityHTML
          ambiguityHTML += "<div class='ambiguity-provision' data-querytag='"+this.nlpTerms[t].queryTag+"'>";
          ambiguityHTML += this.nlpTerms[t].parsedText;
          if(this.nlpTerms[t].senseType=="?"){
            ambiguityHTML += "<div class='ambiguity' data-term='"+t+"'>?</div>";
            ambiguityHTML += "<ul id='ambiguous_"+t.replace(/ /gi, "_")+"' style='display: none;'>";
            for(var a=0;a<this.nlpTerms[t].extra.fields.length;a++){
              ambiguityHTML += "<li class='ambiguous_resolve' data-term='"+t+"'>";
              ambiguityHTML += this.nlpTerms[t].extra.fields[a];
              ambiguityHTML += "</li>";
            }
          }
          ambiguityHTML += "</ul>";
          ambiguityHTML += "</div>";
        }
        var lozengeEl = document.getElementById(this.id+"_lozenges");
        if(lozengeEl){
          lozengeEl.innerHTML = lozengeHTML;
        }
        var ambiguityEl = document.getElementById(this.id+"_ambiguities");
        if(ambiguityEl){
          ambiguityEl.innerHTML = ambiguityHTML;
        }
      }
    },
    clearLozenges: {
      value: function(){
        var lozengeEl = document.getElementById(this.id+"_lozenges");
        if(lozengeEl){
          lozengeEl.innerHTML = "";
        }
        var ambiguityEl = document.getElementById(this.id+"_ambiguities");
        if(ambiguityEl){
          ambiguityEl.innerHTML = "";
        }
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
        var inputEl = document.getElementById(this.id+'_input');
        if(inputEl){
          inputEl.value = this.searchText;
        }
        this.search();
      }
    },
    search:{
      value: function(){
        senseSearch.search(this.searchText, this.searchFields || [], this.mode);
      }
    },
    searchForSingleTerm:{
      value: function(term){
        senseSearch.search(term, this.searchFields || [], this.mode);
      }
    },
    suggest:{
      value: function(){
        senseSearch.suggest(this.searchText, this.suggestFields || []);
      }
    },
    nlpViz:{
      value: function(){
        console.log('creating viz');
        var hDef = {
          qInfo:{

          },
          qHyperCubeDef:{
            qDimensions: [],
            qMeasures: [],
            qInitialDataFetch: [{
              qTop: 0,
              qLeft: 0,
              qHeight: 1000,
              qWidth: 10
            }]
          }
        };
        var dimensions={},measures={},fields=[],aggregations={},sorting={},sets=[],time=[],func=null,ambiguousSort=null;
        var dimensionIndexMap={},measureIndexMap={};
        var dimensionCount=-1,measureCount=-1;
        var columnWidths = [];
        var chartType;
        //first organise the terms into their sense component parts
        for(var t=0;t<this.nlpTerms.length;t++){
          switch (this.nlpTerms[t].senseType) {
            case "exp":
              var measureInfo = this.nlpTerms[t];
              var measureName = measureInfo.name;
              if(measureInfo.senseInfo.field.qInfo){
                //then we have a library measure
                measures[measureName] = {
                  qLibraryId: measureInfo.senseInfo.field.qInfo.qId,
                  qLabel: measureName
                }

              }
              else {
                //we have a field tagged with $measure
                measureName = this.nlpTerms[t].senseInfo.field.qName.replace(/ /gi,"-");
                measures[measureName] = this.nlpTerms[t].senseInfo.field;
              }
              measureCount++;
              measureIndexMap[measureName]=measureCount;
              break;
            case "dim":
              var dimensionInfo = this.nlpTerms[t];
              var dimensionName = this.nlpTerms[t].name;
              if(dimensionInfo.senseInfo.field.qInfo){
                //then we have a library measure
                dimensions[dimensionName] = {
                  qLibraryId: dimensionInfo.senseInfo.field.qInfo.qId
                }
              }
              else {
                dimensionName = this.nlpTerms[t].senseInfo.field.qName.replace(/ /gi,"-");
                dimensions[dimensionName] = this.nlpTerms[t].senseInfo.field;
                if(this.nlpTerms[t].senseInfo.type=="time"){
                  time.push(dimensionName);
                }
              }
              dimensionCount++;
              dimensionIndexMap[dimensionName]=dimensionCount;
              break;
            case "function":
              func = this.nlpTerms[t].senseInfo.func;
              break;
            case "viz":
              chartType = this.nlpTerms[t].senseInfo.viz;
              break;
            case "value": //currently only supports a single value
              var fieldName, normalizedName;
              if(this.nlpTerms[t].senseInfo.field.qInfo){
                // normalizedName = normalizeText(this.nlpTerms[t].senseInfo.field.qData.title);
                fieldName = this.nlpTerms[t].senseInfo.field.qData.title;
              }
              else {
                // normalizedName = normalizeText(this.nlpTerms[t].senseInfo.field.qName);
                fieldName = this.nlpTerms[t].senseInfo.field.qName;
              }
              var set = "";
              set += "[" + fieldName + "]";
              set += this.nlpTerms[t].senseInfo.fieldSelection;
              set += "{'";
              set += this.nlpTerms[t].text;
              set += "*'}";
              set += "";
              sets.push(set);
              break;
            case "sortfield":
              var sortName = this.nlpTerms[t].senseInfo.field.qName.replace(/ /gi,"-");
              sorting[sortName] = this.nlpTerms[t].senseInfo;
              break;
            case "sortorder":
              ambiguousSort = this.nlpTerms[t].senseInfo.order;
              break;
            default:

          }
        }
        //now construct the hypercube
        for(var d in dimensions){
          var dDef = {};
          if(dimensions[d].qLibraryId){
            dDef = dimensions[d];
          }
          else{
            dDef = {
              qDef: {
                qFieldDefs: [dimensions[d].qName]
              },
              qNullSuppression: true
            };
          }
          if(sorting[d]){
            var sortType = "qSortByAscii";
            var sortOrder = sorting[d].order || 1;
            if(senseSearch.appFieldsByTag.$numeric && senseSearch.appFieldsByTag.$numeric.indexOf(d)!=-1){
              sortType = "qSortByNumeric";
            }
            dDef.qDef.qSortCriterias = [{}];
            dDef.qDef.qSortCriterias[0][sortType] = sortOrder;
          }
          hDef.qHyperCubeDef.qDimensions.push(dDef);
          fields.push(dimensions[d].qName);
        }
        for(var m in measures){
          var mDef = {};
          if(measures[m].qLibraryId){
            mDef.qDef = measures[m];
          }
          else{
            var measDef = "=num(";
            measDef += func || this.nlpModel.defaultFunction;
            measDef += "({$";
            if(sets.length > 0){
              measDef += "<";
              measDef += sets.join(",");
              measDef += ">";
            }
            measDef += "}";
            measDef += "[" + measures[m].qName + "]";
            measDef += "), '";
            if(senseSearch.appFieldsByTag.$currency && senseSearch.appFieldsByTag.$currency[m] && func!=="count"){
                measDef += this.nlpModel.currencySymbol;
            }
            measDef += "#,##0')";
            var mDef = {
              qDef: {
                qDef: measDef,
                label: measures[m].qName
              }
            };
            fields.push(measures[m].qName);
            if(sorting[m]){
              var sortType = "qSortByNumeric";
              var sortOrder = sorting[m].order || 1;
              mDef.qSortBy = {};
              mDef.qSortBy[sortType] = sortOrder;
              hDef.qHyperCubeDef.qInterColumnSortOrder = [fields.indexOf(measures[m].qName)];
            }
          }
          hDef.qHyperCubeDef.qMeasures.push(mDef);
        }
        var sortCount = 0;
        for(var s in sorting){
          sortCount++;
        }
        if(sortCount==0){ //no sorting has been applied
          if(time.length>0){  //we have a time dimension to sort by (asc)
            var dimIndex = dimensionIndexMap[time[0]];
            hDef.qHyperCubeDef.qDimensions[dimIndex].qDef.qSortCriterias = [{
              qSortByNumeric: ambiguousSort || 1
            }];
            hDef.qHyperCubeDef.qInterColumnSortOrder = [fields.indexOf(time[0])];
          }
          else{ //we sort by the first measure desc
            if(hDef.qHyperCubeDef.qMeasures.length>0){
              hDef.qHyperCubeDef.qMeasures[0].qSortBy = {
                qSortByNumeric: ambiguousSort || -1
              }
              hDef.qHyperCubeDef.qInterColumnSortOrder = [fields.indexOf(hDef.qHyperCubeDef.qMeasures[0].qDef.label)];
            }
            else if(hDef.qHyperCubeDef.qDimensions.length>0){

            }
          }
        }
        else{

        }
        var totalCols = hDef.qHyperCubeDef.qDimensions.length + hDef.qHyperCubeDef.qMeasures.length;
        if(!chartType){
          if(totalCols==1){
            chartType = this.nlpModel.vizTypeMap["kpi"];
          }
          else{
            if(hDef.qHyperCubeDef.qMeasures.length > 0){
              if(time.length > 0){
                chartType = this.nlpModel.vizTypeMap["linechart"];
              }
              else{
                chartType = this.nlpModel.vizTypeMap["barchart"];
              }
            }
            else{
              chartType = this.nlpModel.vizTypeMap["table"];
            }
          }
        }
        hDef.qInfo.qType = chartType;
        if(hDef.qInfo.qType=="table"){
          // hDef.qHyperCubeDef.columnWidths = columnWidths;
        }
        if(hDef.qHyperCubeDef.qDimensions.length > 0 || hDef.qHyperCubeDef.qMeasures.length > 0){
          senseSearch.createViz(hDef);
        }
      }
    },
    drawGhost:{
      value: function(){
        this.ghostPart = getGhostString(this.searchText, this.suggestions[this.activeSuggestion].qValue);
        this.ghostQuery = this.searchText + this.ghostPart;
        var ghostDisplay = "<span style='color: transparent;'>"+this.searchText+"</span>"+this.ghostPart;
        var ghostEl = document.getElementById(this.id+"_ghost");
        if(ghostEl){
          ghostEl.innerHTML = ghostDisplay;
        }
      }
    },
    removeGhost:{
      value: function(){
        var ghostEl = document.getElementById(this.id+"_ghost");
        if(ghostEl){
          ghostEl.innerHTML = "";
        }
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
        var suggListEl = document.getElementById(this.id+"_suggestionList");
        if(suggListEl){
          suggListEl.innerHTML = suggestionsHtml;
        }
        this.highlightActiveSuggestion();
      }
    },
    highlightActiveSuggestion:{
      value: function(){
        //remove all previous highlights
        var parent = document.getElementById(this.id+"_suggestionList");
        if(parent){
          for (var c=0; c < parent.childElementCount;c++){
            parent.childNodes[c].classList.remove("active");
          }
        }
        //add the 'active' class to the current suggestion
        var activeSuggEl = document.getElementById(this.id+"_suggestion_"+this.activeSuggestion);
        if(activeSuggEl){
            activeSuggEl.classList.add("active");
        }
      }
    },
    activate:{
      value: function(){
        this.attach();

      }
    },
    activateInput:{
      value: function(){
        var el = document.getElementById(this.id+"_input");
        if(el){
          el.attributes["placeholder"].value = this.placeholder || "Enter up to "+this.MAX_SEARCH_TERMS+" search terms";
          el.disabled = false;
        }
      }
    }
  });

  function normalizeText(text){
    //this function make the text lower case and replaces any spaces with an _
    return text.toLowerCase().replace(/ /gi, "_");
  }
  function parseText(text){
    //this function replaces _ with a spaces
    return text.replace(/_/gi, " ");
  }

  function highlightAssociationValue(match){
    var text = match.qText;
    text = text.split("");
    for (var r = match.qRanges.length-1; r>-1;r--){
      text.splice((match.qRanges[r].qCharPos+match.qRanges[r].qCharCount), 0, "</span>")
      text.splice(match.qRanges[r].qCharPos, 0, "<span class='highlight"+match.qRanges[r].qTerm+"'>");
    }
    text = text.join("");
    return text;
  };

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
    this.resultsElement = id + "_results";
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
        if(senseSearch && senseSearch.exchange.connection){
          if(options && options.fields){
            var hDef = this.buildHyperCubeDef();
            senseSearch.exchange.ask(senseSearch.appHandle, "CreateSessionObject", [hDef], function(response){
              that.handle = response.result.qReturn.qHandle;
              if(typeof(callbackFn)==="function"){
                callbackFn.call(null);
              }
            });
          }
          if(!this.attached){
            senseSearch.searchResults.subscribe(this.onSearchResults.bind(this));
            senseSearch.noResults.subscribe(this.onNoResults.bind(this));
            senseSearch.chartResults.subscribe(this.onChartResults.bind(this));
            senseSearch.cleared.subscribe(this.onClear.bind(this));
            this.attached = true;
          }
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
          	"qInterColumnSortOrder": [this.getFieldIndex(this.defaultSort).index]
          }
        };
        return hDef;
      }
    },
    resultsElement: {
      writable: true,
      value: null
    },
    onSearchResults:{
      value: function(results){
        this.data = []; //after each new search we clear out the previous results
        this.pageTop = 0;
        this.getHyperCubeData();
      }
    },
    onChartResults:{
      value: function(genericObject){
        console.log("Chart created");
        console.log(genericObject);
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
      value:  function(){
        this.renderItems([]);
      }
    },
    onClear:{
      value: function(){
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
          var qFields = layout.qHyperCube.qDimensionInfo.concat(layout.qHyperCube.qMeasureInfo);
          senseSearch.exchange.ask(that.handle, "GetHyperCubeData", ["/qHyperCubeDef", [{qTop: that.pageTop, qLeft:0, qHeight: that.pageSize, qWidth: that.fields.length }]], function(response){
            if(callbackFn && typeof(callbackFn)==="function"){
              callbackFn.call(this, response);
            }
            else {
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
        startAtZero = startAtZero || false;
        reRender = reRender || false;
        senseSearch.exchange.ask(this.handle, "ApplyPatches", [[{
          qPath: "/qHyperCubeDef/qInterColumnSortOrder",
          qOp: "replace",
          qValue: [that.getFieldIndex(sortId).index]
        }], true], function(){
          if(startAtZero){
            that.pageTop = 0;
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
            qValue: "["+that.getFieldIndex(sortId).index+"]"
          },
          {
          qPath: path,
          qOp: "replace",
          qValue: "true"
        }], true], function(){
          if(startAtZero){
            that.pageTop = 0;
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
          sort[sorting[fields[i].dimension].sortType] = sorting[fields[i].dimension].order;
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
            // if(chart.model.layout.wsId == that.pendingChart){  //doesn't work in 2.2
              that.exchange.ask(chart.model.handle, "ApplyPatches", [[{qPath:"/qHyperCubeDef", qOp:"replace", qValue: JSON.stringify(defOptions.qHyperCubeDef)}], true], function(result){
                chart.model.getLayout().then(function(){
                  that.chartResults.deliver(chart);
                });
              });
            // }
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
