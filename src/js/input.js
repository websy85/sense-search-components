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

  var templateHtml = "<div class='sense-search-input-main'><div id='{id}_ghost' class='sense-search-input-bg'></div><input id='{id}_input' autofocus placeholder='Please wait...' disabled='disabled' type='text' autocorrect='off' autocomplete='off' autocapitalize='off' spellcheck='false'/><div id='{id}_lozenges' class='sense-search-lozenge-container'></div><div id='{id}_ambiguities' class='sense-search-ambiguity-container'></div><button type='button' class='sense-search-input-clear'>x</button></div><div id='{id}_suggestions' class='sense-search-suggestion-container'><ul id='{id}_suggestionList'></ul></div><div id='{id}_associations' class='sense-search-association-container'><ul id='{id}_associationsList'></ul></div>";

  function SenseSearchInput(id, options){
    if(typeof senseSearch==="undefined" && options.senseSearch){
      senseSearch = options.senseSearch;
    }
    if(typeof document!=="undefined"){
      var element = document.createElement("div");
      element.id = id;
      element.classList.add("sense-search-input-container");
      var html = templateHtml.replace(/{id}/gim, id);
      element.innerHTML = html;
    }
    options = options || {};
    for(var o in options){
      this[o] = options[o];
    }
    this.id = id;
    if(typeof document!=="undefined"){
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
    this.ready = new Subscription();
    this.onAmbiguity = new Subscription();
    this.blockingTerms = {};
    this.blockingTermKeys = [];
    senseSearch.ready.subscribe(this.activate.bind(this));
    senseSearch.fieldsFetched.subscribe(this.fieldsFetched.bind(this));
    senseSearch.onSelectionsApplied.subscribe(this.refresh.bind(this));
    senseSearch.onLockedUnlocked.subscribe(this.refresh.bind(this));
    senseSearch.searchAssociations.subscribe(this.onSearchAssociations.bind(this));
    senseSearch.suggestResults.subscribe(this.onSuggestResults.bind(this));
    senseSearch.cleared.subscribe(this.onClear.bind(this));
    senseSearch.searchStarted.subscribe(this.onSearchStarted.bind(this))
    return {element: element, object: this};
  }

  SenseSearchInput.prototype = Object.create(Object.prototype, {
    id:{
      writable: true,
      value: null
    },
    MAX_SEARCH_TERMS:{
      writable: true,
      value: 20
    },
    ready:{
      writable: true,
      value: null
    },
    onAmbiguity:{
      writable: true,
      value: null
    },
    blockingTerms: {
      writable: true
    },
    blockingTermKeys: {
      writable: true
    },
    includeMasterMeasures: {
      writable: true,
      value: false
    },
    usingMasterMeasures: {
      writable: true,
      value: false
    },
    showTimeSeriesAsLine: {
      writable: true,
      value: true
    },
    groupingStyle: {
      writable: true,
      value: "stacked"
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
          senseSearch.getAppFields(this.nlpModel.cardinalityLimit, this.includeMasterMeasures);
        }
        else{
          this.activateInput();
        }
        if(senseSearch && senseSearch.exchange.connection){
          // senseSearch.searchAssociations.subscribe(this.onSearchAssociations.bind(this));
          // senseSearch.suggestResults.subscribe(this.onSuggestResults.bind(this));
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
    associating:{
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
    nlpSilentTerms:{
      writable: true,
      value: {}
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
        fieldTagMap: {},
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
        functionLabelMap:{
          "sum" : "Total",
          "avg" : "Average",
          "count": "Count",
          "min" : "Minimum",
          "max" : "Maximum"
        },
        distinctMap: {
          "distinct": "DISTINCT",
          "unique": "DISTINCT"
        },
        negationMap: [
          "not",
          "ignore",
          "ignoring",
          "exclude",
          "excluding",
          "without"
        ],
        defaultFunction: "sum",
        currencySymbol: "£",
        misc:[
          "by",
          "as",
          "is",
          "was",
          "were",
          "me",
          "not",
          "ignore",
          "the",
          "in",
          "of",
          "a",
          "and",
          "what",
          "show"
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
          "lowest": 1,
          "least": 1,
          "desc": -1,
          "descending": -1,
          "highest": -1,
          "most": -1
        },
        vizTypeMap:{
          "kpi": "kpi",
          "barchart": "barchart",
          "bar chart": "barchart",
          "linechart": "linechart",
          "piechart": "piechart",
          "combochart": "combochart",
          "table": "table",
          "treemap": "treemap",
          "scatter": "scatterplot",
          "scatterplot": "scatterplot",
          "scatter chart": "scatterplot",
          "boxplot": "boxplot",
          "distributionplot": "distributionplot",
          "histogram": "histogram"
        },
        cardinalityLimit: 1000
      }
    },
    fieldsFetched: {
      value: function(fields){
        this.activateInput();
      }
    },
    lastSelectedGroup:{
      writable: true,
      value: null
    },
    lastAssociationSummary: {
      writable: true,
      value: null
    },
    lastSelectedAssociation:{
      writable: true,
      value: null
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
      value: []
    },
    mode: {
      writable: true,
      value: "associations"
    },
    addFieldNoun:{
      value: function(field, noun){
        field = parseText(field)
        if(!this.nlpModel.fieldNounMap[field]){
          this.nlpModel.fieldNounMap[field] = [];
        }
        if(this.nlpModel.fieldNounMap[field].indexOf(noun)===-1){
          this.nlpModel.fieldNounMap[field].push(noun);
        }
      }
    },
    addFieldTag:{
      value: function(field, tags){
        var parsedField = normalizeText(field);
        if(!this.nlpModel.fieldTagMap[parsedField]){
          this.nlpModel.fieldTagMap[parsedField] = [];
        }
        if(typeof tags==="object" && tags.length){
          for (var i = 0; i < tags.length; i++) {
            if(this.nlpModel.fieldTagMap[parsedField].indexOf(tags[i])===-1){
              this.nlpModel.fieldTagMap[parsedField].push(tags[i])
            }
          }
        }
        else {
          if(this.nlpModel.fieldTagMap[parsedField].indexOf(tags)===-1){
            this.nlpModel.fieldTagMap[parsedField].push(tags)
          }
        }
      }
    },
    onClear: {
      value: function(){
        if(typeof document!=="undefined"){
          var inputEl = document.getElementById(this.id+'_input');
          if(inputEl){
            inputEl.value = "";
          }
        }
        this.searchText = "";
        this.nlpTerms = [];
        this.nlpResolvedTerms = {};
        this.nlpTermsPositions = [];
        this.currentTerm = null;
        this.lastSelectedGroup = null;
        this.usingMasterMeasures = false;
        this.hideSuggestions();
        this.hideAssociations();
        this.clearLozenges();
      }
    },
    onSearchResults:{
      value: function(){

      }
    },
    searching: {
      writable: true,
      value: false
    },
    onSearchStarted: {
      value: function(){

      }
    },
    onSearchAssociations: {
      value: function(associations){
        console.log('associations are');
        console.log(associations);
        this.searching = false
        if(this.mode=="associations"){
          this.associations = associations.qResults;
          this.showAssociations();
        }
        else{
          console.log(associations);
          this.associations = associations;
          for (var a = 0; a < this.associations.length; a++) {
            console.log('ambiguities');
            console.log(this.associations[a]);
            var tempTermsList = []
            var transTerms = this.transformAssociations(this.associations[a])
            var term = this.getTermByText(this.associations[a].qSearchTerms[this.associations[a].qSearchTerms.length-1]);
            if (term && term.length > 0) {
              term = term[0]
            }
            else {
              // we should always have one term??
              return
            }
            var termIndex = this.getTermIndexByText(this.associations[a].qSearchTerms[this.associations[a].qSearchTerms.length-1]);
            if (termIndex && termIndex.length > 0) {
              termIndex = termIndex[0]
            }
            else {
              // we should always have one term??
              return
            }
            console.log(term);
            console.log(termIndex);
            if(transTerms.length==0){
              term.queryTag = "!!";
            }
            else {
              for (var i = 0; i < transTerms.length; i++) {
                var parsedText = parseText(transTerms[i].id)
                console.log(parsedText);
                console.log(normalizeText(transTerms[i].id));
                var tIndex = term.text.indexOf(parsedText)
                if (tIndex!==-1) {
                  var newTerm = cloneObject(term)
                  newTerm.text = parsedText
                  newTerm.parsedText = parsedText
                  newTerm.name = parsedText
                  newTerm.length = parsedText.length
                  newTerm.tempPosition = tIndex
                  newTerm.extra = {
                    fields: transTerms[i].fields
                  }
                  if(transTerms[i].fields.length > 1){
                    newTerm.senseType = "?";
                  }
                  else {
                    newTerm.queryTag = transTerms[i].fields[0];
                    newTerm.senseTag = "value";
                    newTerm.senseType = "value";
                    newTerm.senseInfo = {
                      field: senseSearch.appFields[normalizeText(transTerms[i].fields[0])],
                      fieldSelection: "="
                    };
                  }
                  tempTermsList.push(newTerm)
                }
                else {
                  // this shouldn't happen
                }
              }
              this.nlpTerms.splice(termIndex, 1)
              tempTermsList = tempTermsList.sort(function(a,b){
                return a.tempPosition - b.tempPosition
              })
              for (var i=tempTermsList.length;i>0;i--){
                tempTermsList[i-1].position = termIndex + (i-1)
                this.nlpTerms.splice(termIndex, 0, tempTermsList[i-1])
                if (tempTermsList[i-1].extra.fields.length>1) {
                  this.addAmbiguity(tempTermsList[i-1].text, {
                    termIndex: tempTermsList[i-1].position,
                    term: tempTermsList[i-1],
                    fields: tempTermsList[i-1].extra.fields
                  });
                }
              }
            }
            console.log(this.nlpTerms);
            this.buildLozenges()
            this.nlpViz()
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
    transformAssociations: {
      value: function(associations){
        var transformation = {}
        var transformation2 = []
        var termsAccountedFor = []
        var term = this.getTermByText(associations.qSearchTerms[associations.qSearchTerms.length-1]);

        if (term && term.length > 0){
          term = term[0]
        }
        else {
          return []
        }
        var termList = term.text.split(" ")
        var termCount = term.text.split(" ").length
        if (associations.qSearchTermsMatched[0]){ // should only be a single term matched
          for (var stm = 0; stm < associations.qSearchTermsMatched[0].length; stm++) {
            for (var fm = 0; fm < associations.qSearchTermsMatched[0][stm].qFieldMatches.length; fm++) {
              var fieldIndex = associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qField
              for (var v = 0; v < associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qValues.length; v++) {
                var fieldValueIndex = associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qValues[v]
                var valueMatched = associations.qFieldDictionaries[fieldIndex].qResult[fieldValueIndex].qText
                // if (valueMatched.split(" ").length==associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms.length) {
                  if (!transformation[associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms.length]) {
                    transformation[associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms.length] = []
                  }
                  transformation[associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms.length].push({
                    terms: associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms,
                    field: associations.qFieldNames[fieldIndex]
                  })
                  transformation2.push({
                    terms: associations.qSearchTermsMatched[0][stm].qFieldMatches[fm].qTerms,
                    field: associations.qFieldNames[fieldIndex]
                  })
                // }
              }
            }
          }
        }
        var transformation3 = []
        var transformation3Keys = []
        for (var i = 0; i < transformation2.length; i++) {
          var tempTerms = []
          for (var t = 0; t < transformation2[i].terms.length; t++) {
            tempTerms.push(termList[transformation2[i].terms[t]])
          }
          var itemIndex = transformation3Keys.indexOf(tempTerms.join("_"))
          if (itemIndex===-1) {
            transformation3Keys.push(tempTerms.join("_"))
            itemIndex = transformation3Keys.length-1
            transformation3.push({ id: tempTerms.join("_"), terms: transformation2[i].terms, fields: []})
          }
          if (transformation3[itemIndex].fields.indexOf(transformation2[i].field)==-1) {
            transformation3[itemIndex].fields.push(transformation2[i].field)
          }
        }
        // final clean up
        transformationsToDelete = []
        for (var i=0; i < transformation3.length; i++){
          var canAdd = true
          for (var t = 0; t < transformation3[i].terms.length; t++) {
            if (termsAccountedFor.indexOf(transformation3[i].terms[t])!==-1) {
              canAdd = false
              break
            }
          }
          if (canAdd===false) {
            // transformation3.splice(i, 1)
            transformationsToDelete.push(i)
          }
          else {
            termsAccountedFor = termsAccountedFor.concat(transformation3[i].terms)
          }
        }
        // remove the transformationsToDelete
        for (var i=transformationsToDelete.length-1; i>-1; i--){
          transformation3.splice(transformationsToDelete[i], 1)
        }
        console.log(transformation);
        console.log(transformation2);
        console.log(transformation3);
        return transformation3
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
        console.log("setting back to false");
        this.usingMasterMeasures = false;
        text = text.toLowerCase();
        var processedTextA = text;
        var processedTextB = text;
        var terms = [];
        var matchedFields = []
        //loop through all fields to see if there is a match
        //first we check measures
        for (var f in senseSearch.appFields){
          var fieldName, fieldType;
          if(senseSearch.appFields[f].qInfo){
            fieldName = senseSearch.appFields[f].qData.title;
            var senseGroup
            if(senseSearch.appFields[f].qInfo.qType==="measure"){
              senseGroup = "exp"
              fieldType = "measure";
            }
            else if(senseSearch.appFields[f].qInfo.qType==="dimension"){
              senseGroup = "dim"
              fieldType = "dimension";
            }
            else{
              senseGroup = "dim"
              fieldType = "field";
            }
          }
          else{
            fieldName = senseSearch.appFields[f].qName;
            if(senseSearch.appFields[f].isMasterItem){
              // this.usingMasterMeasures = true
            }
            if(senseSearch.appFieldsByTag.$measure && senseSearch.appFieldsByTag.$measure[f]){
              // fieldType = "exp";
              senseGroup = "exp"
              fieldType = "measure";
            }
            else{
              //check the field tag map
              if(this.nlpModel.fieldTagMap[f] && this.nlpModel.fieldTagMap[f].indexOf("$measure")!==-1){
                // fieldType = "exp";
                senseGroup = "exp"
                fieldType = "field";
              }
              else {
                // fieldType = "dim";
                senseGroup = "dim"
                fieldType = "field";
              }
            }
          }
          var normalizedName = normalizeText(fieldName);
          var parsedName = parseText(normalizedName);
          var fieldPos = text.indexOf(parsedName);
          var aliasFieldPos = -1;
          if(fieldPos == -1 && this.nlpModel.fieldNounMap[parsedName]){
            var aliasMapPos = -1;
            for (var i = 0; i < this.nlpModel.fieldNounMap[parsedName].length; i++) {
              if(text.indexOf(this.nlpModel.fieldNounMap[parsedName][i].toLowerCase())!==-1){
                aliasFieldPos = text.indexOf(this.nlpModel.fieldNounMap[parsedName][i].toLowerCase());
                fieldName = this.nlpModel.fieldNounMap[parsedName][i];
                parsedName = this.nlpModel.fieldNounMap[parsedName][i].toLowerCase();
                break;
              }
            }
          }
          if(fieldPos!==-1 || aliasFieldPos!==-1){
            var pos = fieldPos===-1?aliasFieldPos:fieldPos;
            if(pos > 0 && text.split("")[pos-1]!==" "){
              continue; //we've matched a substring not a whole word
            }
            if(text.split("")[pos+parsedName.length] && text.split("")[pos+parsedName.length]!==" "){
              continue; //we've matched a substring not a whole word
            }
            if(matchedFields.indexOf(parsedName)==-1 && processedTextB.indexOf(parsedName) !==-1){
              processedTextA = processedTextA.replace(parsedName, ";||"+parsedName+";");
              processedTextB = processedTextB.replace(parsedName, "");
              console.log(processedTextA);
              console.log(processedTextB);
              var newTerm = {
                name: f,
                text: fieldName,
                parsedText: parsedName,
                position: pos,
                length: fieldName.length,
                senseType: fieldType,
                senseGroup: senseGroup,
                queryTag: fieldType,
                senseInfo: {
                  field: senseSearch.appFields[f]
                }
              };
              if(senseSearch.appFieldsByTag.$time && senseSearch.appFieldsByTag.$time[f]){
                newTerm.senseInfo.type = "time";
              }
              else if(senseSearch.appFieldsByTag.$timestamp && senseSearch.appFieldsByTag.$timestamp[f]){
                newTerm.senseInfo.type = "time";
              }
              else if(this.nlpModel.fieldTagMap[normalizeText(fieldName)] && this.nlpModel.fieldTagMap[normalizeText(fieldName)].indexOf("$time")!==-1){
                newTerm.senseInfo.type = "time";
              }
              matchedFields.push(parsedName)
              if(senseSearch.appFields[f].isMasterItem){
                this.usingMasterMeasures = true
                console.log("setting back to true");
              }
              terms.push(newTerm);
            }
          }
        }
        //now we need to fill in the blanks with the rest of the terms
        var wordGroups = processedTextA.split(";");
        console.log(wordGroups);
        // var wordGroups = matchedFields
        var wordGroupsCumulativeLengths = [];
        // console.log(wordGroups);
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
          // if(typeof wordGroups[g] !== "object" && wordGroups[g].length>0){
            var words = wordGroups[g].split(" ");
            var sentenceCumulativeLength = 0;
            for (var w=0;w<words.length;w++){
              if(w==0&&wordGroups[g].split()[0]==" "){
                sentenceCumulativeLength = 1;
              }
              else{
                sentenceCumulativeLength++;
              }
              if(words[w].length>0){
                terms.push({
                  name: words[w],
                  text: words[w],
                  parsedText: words[w],
                  position: cLength+sentenceCumulativeLength,
                  length: words[w].length
                });
              }
              sentenceCumulativeLength += words[w].length;
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
        this.nlpTerms = [];
        for (var t=0;t<terms.length;t++){
          if(this.nlpResolvedTerms[terms[t].name]){
            this.nlpTerms.push(this.nlpResolvedTerms[terms[t].name]);
          }
          else{
            var taggedTerm = this.tagTerm(terms[t]);
            if(!taggedTerm.queryTag){
              console.log('no tag');
              // console.log(taggedTerm);
            }
            this.nlpTerms.push(taggedTerm);
          }
        }
        for (var t=0;t<this.nlpTerms.length;t++){
          if(this.nlpTerms[t] && this.nlpTerms[t+1]){
            if(!this.nlpTerms[t].queryTag && !this.nlpTerms[t+1].queryTag){
              //join the terms back together in case they are part of the same value
              this.joinTerms(t, t+1);
              t--;
            }
          }
        }
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
        // console.log(this.nlpTermsPositions);
      }
    },
    joinTerms: {
      value: function(indexA, indexB){
        this.nlpTerms[indexA].length+=this.nlpTerms[indexB].length+1;
        this.nlpTerms[indexA].text += " " + this.nlpTerms[indexB].text;
        this.nlpTerms[indexA].name = parseText(this.nlpTerms[indexA].text);
        this.nlpTerms[indexA].parsedText = this.nlpTerms[indexA].name;
        this.nlpTerms.splice(indexB, 1);
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
          else if (this.nlpModel.distinctMap[termText]) {
            term.queryTag = "distinct";
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
        // console.log(event);
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
        else if (event.target.classList.contains('sense-search-association-item') || event.target.parentNode.classList.contains('sense-search-association-item')|| event.target.parentNode.parentNode.classList.contains('sense-search-association-item')) {
          //an association was clicked
          var assocationIndex;
          if(event.target.classList.contains('sense-search-association-item')){
            //the li element was clicked
            assocationIndex = parseInt(event.target.attributes['data-index'].value);
          }
          else if(event.target.parentNode.classList.contains('sense-search-association-item')){
            //a child was clicked
            assocationIndex = parseInt(event.target.parentNode.attributes['data-index'].value);
          }
          else{
            //a child of a child was clicked (messy, needs reqorking to be more dynamic)
            assocationIndex = parseInt(event.target.parentNode.parentNode.attributes['data-index'].value);
          }
          this.lastSelectedGroup = assocationIndex;
          if(this.lastAssociationSummary && this.lastAssociationSummary.length > 0){
            this.lastSelectedAssociation = this.lastAssociationSummary[assocationIndex];
          }
          senseSearch.selectAssociations(this.searchFields || [],  assocationIndex);
          this.hideAssociations();
          this.hideSuggestions();
        }
        else if (event.target.classList.contains('ambiguity')) {
          // console.log(event);
          var term = event.target.attributes['data-term'].value;
          this.showAmbiguityOptions(term);
        }
        else if (event.target.classList.contains('ambiguous_resolve')) {
          var term = event.target.attributes['data-term'].value;
          var field = event.target.innerText;
          this.resolveAmbiguity(term, field);
        }
      }
    },
    onKeyDown: {
      value: function(event){
        // console.log(event.keyCode);
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
          else if (this.associating && event.keyCode == Key.ENTER) {
            event.preventDefault();
            senseSearch.selectAssociations(this.searchFields || [],  0);
            this.hideAssociations();
          }
        }
        else if(event.keyCode == Key.SPACE){
          //we'll check here to make sure the latest term is at least 2 characters
          if(this.searchText.split(" ").length==this.MAX_SEARCH_TERMS){
            alert('Too many search terms');
            event.preventDefault();
            return false;
          }
          else if(this.searchText.split(" ").pop().length==1 && this.mode!=="visualizations"){
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
            this.preVizSearch();
          }
          else{
            this.preSearch();
          }
        }
      }
    },
    preSearch:{
      value: function(){
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
    },
    preVizSearch:{
      value: function(){
        senseSearch.cleanUpOldVizObjects()
        var searchingForSingle = false;
        if(this.searchText && this.searchText.trim().length>1){
          var that = this;
          if(this.searchTimeoutFn){
            clearTimeout(this.searchTimeoutFn);
          }
          this.searchTimeoutFn = setTimeout(function(){
            for(var t=0;t<that.nlpTerms.length;t++){
              if(!that.nlpTerms[t].senseType && !that.nlpTerms[t].queryTag){
                searchingForSingle = true;
                that.searchForSingleTerm(that.nlpTerms[t].text);
              }
            }
          }, this.searchTimeout);

            //we're not suggesting for now for UX based reasons
            if(this.searchText.length > 1 && this.cursorPosition==this.searchText.length){
              if(this.suggestTimeoutFn){
                clearTimeout(this.suggestTimeoutFn);
              }
              this.suggestTimeoutFn = setTimeout(function(){
                that.suggest();
              }, this.suggestTimeout);
            }
          if(this.chartTimeoutFn){
            clearTimeout(this.chartTimeoutFn);
          }
          this.chartTimeoutFn = setTimeout(function(){
            if(!this.blockingTermKeys || this.blockingTermKeys.length==0){
              if(!searchingForSingle){
                that.nlpViz();
              }
            }
          }, this.chartTimeout);
        }
        if(!this.searchText || this.searchText.length == 0){
          this.clear();
        }
      }
    },
    replaceSearchText:{
      value: function(oldValue, newValue, preventSearch){
        var currentSearchText = this.searchText + " ";
        if(currentSearchText.indexOf(oldValue)===-1){
          return false;
        }
        else{
          currentSearchText = currentSearchText.replace(parts[0], parts[1]);
          this.setSearchText(currentSearchText, preventSearch);
        }
      }
    },
    setSearchText:{
      value: function(text, preventSearch){
        preventSearch = preventSearch || false;
        this.searchText = text;
        this.isPaste = true;
        this.cursorPosition = text.length;
        if(typeof document!=="undefined"){
          var inputEl = document.getElementById(this.id+'_input');
          if(inputEl){
            inputEl.value = text;
          }
        }
        if(this.mode==="visualizations" && !preventSearch){
          this.processTerms(this.searchText, !this.isPaste);
          this.buildLozenges();
          this.preVizSearch();
        }
        else if(!preventSearch){
          this.preSearch();
        }
        this.isPaste = false;
      }
    },
    refresh:{
      value: function(){
        this.setSearchText(this.searchText);
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
          if(typeof document!=="undefined"){
            var suggestEl = document.getElementById(this.id+"_suggestions");
            if(suggestEl){
              suggestEl.style.display = "block";
            }
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
        if(typeof document!=="undefined"){
          var suggestEl = document.getElementById(this.id+"_suggestions");
          if(suggestEl){
            suggestEl.style.display = "none";
          }
        }
      }
    },
    showAssociations: {
      value: function(){
        var html = "";
        this.associating = true;
        this.lastAssociationSummary = [];
        for (var i=0;i<this.associations.qSearchTermsMatched.length;i++){ //loops through each search term match group
          var termsMatched = this.associations.qSearchTermsMatched[i];
          for (var j=0;j<termsMatched.length;j++){  //loops through each valid association
            html += "<li class='sense-search-association-item' data-index='"+j+"'>";
            var associationSummary = [];
            for(var k=0;k<termsMatched[j].qFieldMatches.length;k++){  //loops through each field in the association
              var extraStyle = "";
              if (termsMatched[j].qFieldMatches.length > 1) {
                extraStyle = 'width: '+Math.floor(100/termsMatched[j].qFieldMatches.length)+'%;';
              }
              var fieldMatch = termsMatched[j].qFieldMatches[k];
              var fieldName = this.associations.qFieldNames[fieldMatch.qField];
              var fieldValues = [];
              var rawFieldValues = [];
              var elemNumbers = [];
              for (var v in fieldMatch.qValues){
                var highlightedValue = highlightAssociationValue(this.associations.qFieldDictionaries[fieldMatch.qField].qResult[v], fieldMatch.qTerms);
                rawFieldValues.push(highlightedValue.matchValue);
                fieldValues.push(highlightedValue.text);
                elemNumbers.push(highlightedValue.elem);
              }
              html += "<div style='"+extraStyle+"'>";
              html += "<h1>"+fieldName+"</h1>";
              for (var v=0; v < fieldValues.length; v++){
                html += fieldValues[v];
                if(v < fieldValues.length-1){
                  html += ", ";
                }
              }
              html += "</div>";
              associationSummary.push({
                field: fieldName,
                values: rawFieldValues,
                elems: elemNumbers
              });
            }
            html += "</li>";
            this.lastAssociationSummary.push(associationSummary);
          }
        }
        if(typeof document!=="undefined"){
          var assListEl = document.getElementById(this.id+"_associationsList");
          if(assListEl){
            assListEl.innerHTML = html;
          }
          var assEl = document.getElementById(this.id+"_associations");
          if(assEl){
            assEl.style.display = "block";
          }
        }
      }
    },
    hideAssociations: {
      value: function(){
        if(typeof document!=="undefined"){
          var assEl = document.getElementById(this.id+"_associations");
          if(assEl){
            assEl.style.display = "none";
          }
          this.associating = false;
        }
      }
    },
    addAmbiguity: {
      value: function(id, ambiguity){
        this.ambiguities[id] = ambiguity;
        this.onAmbiguity.deliver(ambiguity);
      }
    },
    showAmbiguityOptions:{
      value: function(termIndex){
        if(typeof document!=="undefined"){
          var ambiguityElement = document.getElementById('ambiguous_'+termIndex);
          if(ambiguityElement){
            ambiguityElement.style.display = 'initial';
          }
        }
      }
    },
    resolveAmbiguity: {
      value: function(term, field){
        if(typeof senseSearch==="undefined" && this.senseSearch){
          senseSearch = this.senseSearch;
        }
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
        delete this.ambiguities[this.nlpTerms[term].name]
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
        if(typeof document!=="undefined"){
          var lozengeEl = document.getElementById(this.id+"_lozenges");
          if(lozengeEl){
            lozengeEl.innerHTML = lozengeHTML;
          }
          var ambiguityEl = document.getElementById(this.id+"_ambiguities");
          if(ambiguityEl){
            ambiguityEl.innerHTML = ambiguityHTML;
          }
        }
      }
    },
    clearLozenges: {
      value: function(){
        if(typeof document!=="undefined"){
          var lozengeEl = document.getElementById(this.id+"_lozenges");
          if(lozengeEl){
            lozengeEl.innerHTML = "";
          }
          var ambiguityEl = document.getElementById(this.id+"_ambiguities");
          if(ambiguityEl){
            ambiguityEl.innerHTML = "";
          }
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
          if(this.mode!=="associations"){
            this.hideSuggestions.call(this);
          }
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
        if(typeof document!=="undefined"){
          var inputEl = document.getElementById(this.id+'_input');
          if(inputEl){
            inputEl.value = this.searchText;
          }
        }
        if (this.mode==="visualizations") {
          this.processTerms(this.searchText)
          this.buildLozenges()
          this.preVizSearch()
        }
        this.search();
      }
    },
    search:{
      value: function(){
        if(typeof senseSearch==="undefined" && this.senseSearch){
          senseSearch = this.senseSearch;
        }
        senseSearch.search(this.searchText, this.searchFields || [], this.mode);
      }
    },
    searchForSingleTerm:{
      value: function(term){
        this.searching = true
        if(typeof senseSearch==="undefined" && this.senseSearch){
          senseSearch = this.senseSearch;
        }
        this.blockingTerms[normalizeText(term)] = true;
        this.blockingTermKeys = Object.keys(this.blockingTerms);
        console.log('blocking: '+term);
        senseSearch.search(term, this.searchFields || [], this.mode);
      }
    },
    suggest:{
      value: function(){
        if(typeof senseSearch==="undefined" && this.senseSearch){
          senseSearch = this.senseSearch;
        }
        senseSearch.suggest(this.searchText, this.suggestFields || []);
      }
    },
    nlpViz:{
      value: function(){
        if(typeof senseSearch==="undefined" && this.senseSearch){
          senseSearch = this.senseSearch;
        }
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
        var dimensions={},measures={},fields=[],aggregations={},sorting={},sets={},setCount=0,time=[],func=null,ambiguousSort=null;
        var dimensionIndexMap={},measureIndexMap={};
        var dimensionCount=0,measureCount=0;
        var columnWidths = [];
        var chartType;
        // process any silent terms
        if(!this.nlpSilentTerms){
          this.nlpSilentTerms = {}
        }
        if(this.nlpSilentTerms && this.nlpSilentTerms.viz){
          chartType = this.nlpModel.vizTypeMap[this.nlpSilentTerms.viz]
        }
        //first check to see if any of our dims should be treated as measures based on functions
        for(var t=0;t<this.nlpTerms.length;t++){
          if(this.nlpTerms[t].senseType == "measure"){
            measureCount++;
          }
          // if(this.nlpTerms[t].senseInfo && this.nlpTerms[t].senseInfo.field && this.nlpTerms[t].senseInfo.field.qInfo && this.nlpTerms[t].senseInfo.field.qInfo.qId){
          if (this.nlpTerms[t].senseType == "dimension") {
            dimensionCount++
          }
          else {
            if(this.nlpTerms[t].senseType == "field"){
              var adjacentTermIndex = -1
              if(this.nlpTerms[t-1] && this.nlpTerms[t-1].queryTag!="!"){
                adjacentTermIndex = t-1
              }
              else if (this.nlpTerms[t-1] && this.nlpTerms[t-1].queryTag=="!" && this.nlpTerms[t-2]) {
                adjacentTermIndex = t-2
              }
              else if (this.nlpTerms[t+1]) {
                adjacentTermIndex = t+1
              }

              if(adjacentTermIndex !== -1){
                if(this.nlpModel.distinctMap[this.nlpTerms[adjacentTermIndex].text]){
                  this.nlpTerms[t].senseGroup = "exp";
                  this.nlpTerms[t].senseInfo.countDistinct = true;
                  this.nlpTerms[t].senseInfo.func = "count";
                  measureCount++;
                }
                else if (this.nlpTerms[adjacentTermIndex].senseType=="function") {
                  this.nlpTerms[t].senseGroup = "exp";
                  this.nlpTerms[t].senseInfo.func = this.nlpTerms[adjacentTermIndex].senseInfo.func;
                  measureCount++;
                }
                else {
                  dimensionCount++
                }
              }
              else {
                dimensionCount++
              }
            }
          }
        }
        // for(var t=0;t<this.nlpTerms.length;t++){
        //   if(this.nlpTerms[t].senseType=="viz"){
        //     chartType = this.nlpTerms[t].senseInfo.viz;
        //   }
        // }
        if(measureCount==0){
          //we need a measure for something to render
          for(var t=0;t<this.nlpTerms.length;t++){
            if (senseSearch.appFieldsByTag.$measure[this.nlpTerms[t].name] || senseSearch.appFieldsByTag.$possibleMeasure[this.nlpTerms[t].name]) {
              this.nlpTerms[t].senseGroup = "exp"
              measureCount++
            }
            if(measureCount==0 && dimensionCount==1){
              if (this.nlpTerms[t].senseGroup == "dim" && senseSearch.appFieldsByTag.$numeric[this.nlpTerms[t].name] && !senseSearch.appFieldsByTag.$measure[this.nlpTerms[t].name] && !senseSearch.appFieldsByTag.$possibleMeasure[this.nlpTerms[t].name]) {
                chartType = "histogram"
              }
              else if (this.nlpTerms[t].senseType == "field" && (senseSearch.appFieldsByTag.$measure[this.nlpTerms[t].name] || senseSearch.appFieldsByTag.$possibleMeasure[this.nlpTerms[t].name])) {
                this.nlpTerms[t].senseGroup = "exp"
                chartType = "kpi"
              }
              else {
                chartType = "table"
              }
            }
            // else if (measureCount==0 && dimensionCount > 1 && !senseSearch.appFieldsByTag.$possibleMeasure[this.nlpTerms[t].name]) {
            //   chartType = "table"
            // }            
            else if (measureCount==0) {
              if(this.nlpTerms[t].senseType == "field" && chartType!="histogram" && (this.nlpTerms[t].senseInfo.field && !this.nlpTerms[t].senseInfo.field.qData)){
                if(senseSearch.appFieldsByTag.$possibleMeasure && senseSearch.appFieldsByTag.$possibleMeasure[this.nlpTerms[t].name]){
                  this.nlpTerms[t].senseGroup = "exp";
                  measureCount++;
                  if(senseSearch.appFieldsByTag.$numeric && senseSearch.appFieldsByTag.$numeric[this.nlpTerms[t].name]){
                    this.nlpTerms[t].senseInfo.func = this.nlpModel.defaultFunction;
                  }
                  else {
                    this.nlpTerms[t].senseInfo.func = "count";
                  }
                }
                else{
                  this.nlpTerms[t].senseGroup = "exp";
                  this.nlpTerms[t].senseInfo.countDistinct = true;
                  this.nlpTerms[t].senseInfo.func = "count";
                }
              }
            }
          }
        }
        dimensionCount=-1,measureCount=-1;
        //then organise the terms into their sense component parts
        for(var t=0;t<this.nlpTerms.length;t++){
          switch (this.nlpTerms[t].senseGroup) {
            case "exp":
              var measureInfo = this.nlpTerms[t];
              var measureName = measureInfo.name;
              //we have a field tagged with $measure
              var measureLabel = "";
              if(measureInfo.senseInfo.field.qInfo){
                measureName = measureInfo.senseInfo.field.qData.title.replace(/ /gi,"-");
              }
              else {
                measureName = this.nlpTerms[t].senseInfo.field.qName.replace(/ /gi,"-");
              }
              measures[measureName] = { field: this.nlpTerms[t].senseInfo.field };
              if(this.nlpTerms[t].senseInfo.countDistinct){
                measures[measureName].isCountDistinct = true;
                measureLabel += "Distinct ";
              }
              if(this.nlpTerms[t].senseInfo.func){
                measures[measureName].func = this.nlpTerms[t].senseInfo.func;
                measureLabel += this.nlpModel.functionLabelMap[this.nlpTerms[t].senseInfo.func] + (this.nlpTerms[t].senseInfo.func=="count"?" of ":" ");
              }
              else{
                measureLabel += "<<func>> ";
              }
              if (this.nlpTerms[t].senseInfo.field.qName) {
                measureLabel += this.nlpTerms[t].senseInfo.field.qName;
              }
              else if (this.nlpTerms[t].senseInfo.field.qData) {
                measureLabel += this.nlpTerms[t].senseInfo.field.qData.title;
              }
              measures[measureName].label = measureLabel;
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
              }
              if(!dimensions[dimensionName].qDef){
                dimensions[dimensionName].qDef = {}
              }
              dimensions[dimensionName].qDef.qSortCriterias = [{ qSortByAscii: 1}]  // for now we'll apply default sorting to the dimensions
              if(this.nlpTerms[t].senseInfo.type=="time"){
                time.push(dimensionName);
              }
              dimensionCount++;
              dimensionIndexMap[dimensionName]=dimensionCount;
              break;
          }
          switch (this.nlpTerms[t].senseType) {
            case "function":
              func = this.nlpTerms[t].senseInfo.func;
              break;
            case "value":
              var fieldName, fieldId, normalizedName;
              if(this.nlpTerms[t].senseInfo.field && this.nlpTerms[t].senseInfo.field.qInfo){
                normalizedName = normalizeText(this.nlpTerms[t].senseInfo.field.qData.title);
                fieldName = this.nlpTerms[t].senseInfo.field.qData.title;
                fieldId = this.nlpTerms[t].senseInfo.field.qInfo.qId
              }
              else {
                normalizedName = normalizeText(this.nlpTerms[t].senseInfo.field.qName);
                fieldName = this.nlpTerms[t].senseInfo.field.qName;
              }
              if(!sets[normalizedName]){
                sets[normalizedName] = {
                  field: {
                    name: fieldName,
                    id: fieldId
                  },
                  selector: this.nlpTerms[t].senseInfo.fieldSelection,
                  values: [],
                  selectValues: []
                };
              }
              var set = "";
              // set += "[" + fieldName + "]";
              // set += this.nlpTerms[t].senseInfo.fieldSelection;
              set += "'";
              set += this.nlpTerms[t].text;
              set += "*'";
              // set += "";
              sets[normalizedName].selectValues.push(this.nlpTerms[t].text)
              sets[normalizedName].values.push(set);
              setCount++;
              break;
            case "sortfield":
              var sortName = this.nlpTerms[t].senseInfo.field.qName.replace(/ /gi,"-");
              sorting[sortName] = this.nlpTerms[t].senseInfo;
              break;
            case "sortorder":
              ambiguousSort = this.nlpTerms[t].senseInfo.order;
              break;
            case "viz":
              chartType = this.nlpTerms[t].senseInfo.viz
              break;
            default:

          }
        }
        //now construct the hypercube
        for(var d in dimensions){
          var dDef = {
          };
          if(dimensions[d].qLibraryId){
            dDef = dimensions[d];
            dDef.qNullSuppression = true
          }
          else{
            dDef = {
              qDef: {
                qFieldDefs: [dimensions[d].qName]
              },
              qNullSuppression: true
            };
          }
          dDef.name = d
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
          if(measures[m].field.qInfo && measures[m].field.qInfo.qId && measures[m].field.qInfo.qType=="measure"){
            // mDef.qDef = { qLibraryId: measures[m].field.qInfo.qId }
            mDef.qLibraryId = measures[m].field.qInfo.qId
          }
          else{
            var measDef = "=num(";
            var measFunc = measures[m].func || func || this.nlpModel.defaultFunction;
            measures[m].label = measures[m].label.replace(/\<\<func\>\>/gim, this.nlpModel.functionLabelMap[measFunc]);
            if(measures[m].label.toLowerCase().indexOf("count")!==-1){
              if(measures[m].label.toLowerCase().indexOf("count of")===-1){
                measures[m].label =  measures[m].label.replace(/count/i, "Count of ")
              }
            }
            measDef += measFunc;
            measDef += "(";
            if(measures[m].isCountDistinct){
              measDef+= "DISTINCT ";
            }
            measDef += "{$";
            if(setCount > 0 && this.usingMasterMeasures===false){
              measDef += "<";
              setLabelsCount = 0;
              var conditions = []
              for(var s in sets){
                var conditionText = "";
                if (setLabelsCount==0 && sets[s].selector!="-=") {
                  measures[m].label += " for "
                }
                else if (sets[s].selector=="-=") {
                  measures[m].label += " excluding ";
                }
                measures[m].label += sets[s].values.join(", ");
                conditionText += "[" + sets[s].field.name + "]";
                conditionText += sets[s].selector;
                conditionText += "{";
                conditionText += sets[s].values.join(",");
                conditionText += "}";
                conditions.push(conditionText)
              }
              measDef += conditions.join(",");
              measDef += ">";
            }
            measDef += "}";
            if(measures[m].field.qInfo){
              measDef += "[" + measures[m].field.qData.title + "]";
            }
            else {
              measDef += "[" + measures[m].field.qName + "]";
            }
            measDef += "), '";
            var fieldKey
            if (measures[m].field.qName) {
              fieldKey = normalizeText(measures[m].field.qName)
            }
            else if (measures[m].field.qData) {
              fieldKey = normalizeText(measures[m].field.qData.title)
            }
            if(senseSearch.appFieldsByTag.$currency && senseSearch.appFieldsByTag.$currency[m] && func!=="count"){
              measDef += this.nlpModel.currencySymbol;
            }
            else if(this.nlpModel.fieldTagMap[fieldKey] && this.nlpModel.fieldTagMap[fieldKey].indexOf("$currency")!==-1 && func!=="count"){
              measDef += this.nlpModel.currencySymbol;
            }
            measDef += "#,##0')";
            var mDef = {
              qDef: {
                qDef: measDef,
                qLabel: measures[m].label,
                sortLabel: measures[m].field.qName
              }
            };
            fields.push(measures[m].field.qName);
            if(sorting[m]){
              var sortType = "qSortByNumeric";
              var sortOrder = sorting[m].order || 1;
              mDef.qSortBy = {};
              mDef.qSortBy[sortType] = sortOrder;
              hDef.qHyperCubeDef.qInterColumnSortOrder = [fields.indexOf(measures[m].field.qName)];
            }
          }
          hDef.qHyperCubeDef.qMeasures.push(mDef);
        }
        var sortCount = 0;
        for(var s in sorting){
          sortCount++;
        }
        var totalCols = hDef.qHyperCubeDef.qDimensions.length + hDef.qHyperCubeDef.qMeasures.length;
        if(sortCount==0 && hDef.qHyperCubeDef.qDimensions && hDef.qHyperCubeDef.qDimensions.length>0){ //no sorting has been applied
          if(time.length>0){  //we have a time dimension to sort by (asc)
            var dimIndex = dimensionIndexMap[time[0]];
            if(!hDef.qHyperCubeDef.qDimensions[dimIndex].qDef){
              hDef.qHyperCubeDef.qDimensions[dimIndex].qDef = {}
            }
            hDef.qHyperCubeDef.qDimensions[dimIndex].qDef.qSortCriterias = [{
              qSortByNumeric: ambiguousSort || 1
            }];
            hDef.qHyperCubeDef.qInterColumnSortOrder = (new Array(totalCols).fill())
            hDef.qHyperCubeDef.qInterColumnSortOrder = hDef.qHyperCubeDef.qInterColumnSortOrder.map(function(item, index){
              return index
            })
            console.log(hDef.qHyperCubeDef.qInterColumnSortOrder);
          }
          else{ //we sort by the first measure desc
            if(hDef.qHyperCubeDef.qMeasures.length>0){// && hDef.qHyperCubeDef.qMeasures[0].qSortBy){
              // if (!hDef.qHyperCubeDef.qMeasures[0].qSortBy) {
              //
              // }
              hDef.qHyperCubeDef.qMeasures[0].qSortBy = {
                qSortByNumeric: ambiguousSort || -1
              }
              // hDef.qHyperCubeDef.qInterColumnSortOrder = [fields.indexOf(hDef.qHyperCubeDef.qMeasures[0].qDef.sortLabel)];
              var colOrder = (new Array(hDef.qHyperCubeDef.qDimensions.length+hDef.qHyperCubeDef.qMeasures.length).fill().map(function(item, index){return index}))
              colOrder.splice(colOrder.indexOf(hDef.qHyperCubeDef.qDimensions.length), 1)
              colOrder.splice(0,0, hDef.qHyperCubeDef.qDimensions.length)
              hDef.qHyperCubeDef.qInterColumnSortOrder = colOrder
              // hDef.qHyperCubeDef.qInterColumnSortOrder = [hDef.qHyperCubeDef.qDimensions.length]
            }
            else if(hDef.qHyperCubeDef.qDimensions.length>0){

            }
          }
        }
        else{

        }

        if(!chartType){
          if(totalCols==1 && hDef.qHyperCubeDef.qMeasures.length > 0){
            chartType = this.nlpModel.vizTypeMap["kpi"];
          }
          else if(totalCols==1 && hDef.qHyperCubeDef.qDimensions.length > 0 && senseSearch.appFieldsByTag.$numeric[hDef.qHyperCubeDef.qDimensions[0].name]){
            chartType = this.nlpModel.vizTypeMap["histogram"];
          }
          else{
            if(hDef.qHyperCubeDef.qDimensions.length==2){
              // Set the qGrouping property
              hDef.barGrouping = { grouping: this.groupingStyle }
            }
            if(hDef.qHyperCubeDef.qMeasures.length > 0){
              if(hDef.qHyperCubeDef.qMeasures.length>2){
                chartType = this.nlpModel.vizTypeMap["table"];
              }
              else if(hDef.qHyperCubeDef.qMeasures.length==2 && chartType!="scatterplot"){
                chartType = this.nlpModel.vizTypeMap["combochart"];
                if(!hDef.qHyperCubeDef.qMeasures[0].qDef){
                  hDef.qHyperCubeDef.qMeasures[0].qDef = {}
                }
                if(!hDef.qHyperCubeDef.qMeasures[1].qDef){
                  hDef.qHyperCubeDef.qMeasures[1].qDef = {}
                }
                hDef.qHyperCubeDef.qMeasures[0].qDef.series = {
    							type: "bar",
    							axis: 0,
    							marker: "circle",
    							markerFill: true
    						}
                hDef.qHyperCubeDef.qMeasures[1].qDef.series = {
                  type: "line",
    							axis: 1,
    							marker: "line",
    							markerFill: true
                }
              }
              else if(time.length > 0 && this.showTimeSeriesAsLine===true){
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
        hDef.qInfo.qType = this.nlpModel.vizTypeMap[chartType] || chartType;
        if(hDef.qInfo.qType=="table"){
          // hDef.qHyperCubeDef.columnWidths = columnWidths;
        }
        if(hDef.qHyperCubeDef.qDimensions.length > 0 || hDef.qHyperCubeDef.qMeasures.length > 0){
          setCount = Object.keys(sets).length
          if(setCount > 0 && this.usingMasterMeasures===true){
            var that = this
            senseSearch.clear(false, true, function(){
              that.preVizSelect(0, setCount, sets, function(){
                senseSearch.createViz(hDef);
              })
            })
          }
          else {
            senseSearch.clear(false, true, function(){
              senseSearch.createViz(hDef);
            })
          }
        }
      }
    },
    preVizSelect: {
      value: function(index, total, sets, callbackFn){
        var that = this
        console.log('sets:', total);
        console.log(sets);
        var setKeys = Object.keys(sets)
        var key = setKeys[index]
        if (sets[key]) {
          senseSearch.lowLevelSelectTextInField(sets[key].field, sets[key].selectValues, false, function(){
            index++
            if (index<total) {
              that.preVizSelect(index, total, sets, callbackFn)
            }
            else {
              callbackFn()
            }
          })
        }
        else {
          callbackFn()
        }
      }
    },
    drawGhost:{
      value: function(){
        this.ghostPart = getGhostString(this.searchText, this.suggestions[this.activeSuggestion].qValue);
        console.log("ghost part");
        console.log(this.ghostPart);
        this.ghostQuery = this.searchText + this.ghostPart;
        if(typeof document!=="undefined"){
          var ghostDisplay = "<span style='color: transparent;'>"+this.searchText+"</span>"+this.ghostPart;
          var ghostEl = document.getElementById(this.id+"_ghost");
          if(ghostEl){
            ghostEl.innerHTML = ghostDisplay;
          }
        }
      }
    },
    removeGhost:{
      value: function(){
        if(typeof document!=="undefined"){
          var ghostEl = document.getElementById(this.id+"_ghost");
          if(ghostEl){
            ghostEl.innerHTML = "";
          }
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
        if(typeof document!=="undefined"){
          var suggListEl = document.getElementById(this.id+"_suggestionList");
          if(suggListEl){
            suggListEl.innerHTML = suggestionsHtml;
          }
        }
        this.highlightActiveSuggestion();
      }
    },
    highlightActiveSuggestion:{
      value: function(){
        //remove all previous highlights
        if(typeof document!=="undefined"){
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
      }
    },
    activate:{
      value: function(){
        this.attach();

      }
    },
    activateInput:{
      value: function(){
        if(typeof document!=="undefined"){
          var el = document.getElementById(this.id+"_input");
          if(el){
            el.attributes["placeholder"].value = this.placeholder || "Enter up to "+this.MAX_SEARCH_TERMS+" search terms";
            el.disabled = false;
            console.log('input activated');
            this.ready.deliver();
          }
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
    var elemNum = match.qElemNumber;
    text = text.split("");
    var matchValue;
    if(match.qRanges[0]!=null){
      matchValue = {qText: match.qText.substring(match.qRanges[0].qCharPos, match.qRanges[0].qCharPos + match.qRanges[0].qCharCount )};
    }
    for (var r = match.qRanges.length-1; r>-1;r--){
      text.splice((match.qRanges[r].qCharPos+match.qRanges[r].qCharCount), 0, "</span>")
      text.splice(match.qRanges[r].qCharPos, 0, "<span class='highlight"+match.qRanges[r].qTerm+"'>");
    }
    text = text.join("").replace(/<(?!\/?span(?=>|\s.*>))\/?.*?>/gim, '');  //we strip out any html tags other than <span>
    return {
      text: text,
      elem: elemNum,
      matchValue: matchValue
    }
  };

  function getGhostString(query, suggestion){
    var suggestBase = query.toLowerCase();
    console.log("suggest base 0");
    console.log(suggestBase);
    suggestion = suggestion.toLowerCase()
    console.log("suggestion");
    console.log(suggestion);
    // if(suggestion.indexOf(suggestBase)!=-1){
    //   //the suggestion pertains to the whole query
    // }
    // else if(suggestion.length > suggestBase.length){
    //   //this must apply to a substring of the query
    //   console.log("suggest base 1 tracking");
    //   console.log(suggestion.indexOf(suggestBase))
    //   while(suggestion.indexOf(suggestBase)==-1){
    //     suggestBase = suggestBase.split(" ");
    //     suggestBase.splice(0,1);
    //     suggestBase = suggestBase.join(" ");
    //   }
    // }
    // console.log("suggest base 1");
    // console.log(suggestBase);
    // while(suggestBase.length >= suggestion.length && suggestBase!=suggestion){
    //   suggestBase = suggestBase.split(" ");
    //   suggestBase.splice(0,1);
    //   suggestBase = suggestBase.join(" ");
    // }
    // console.log("suggest base 2");
    // console.log(suggestBase);
    while(suggestion.indexOf(suggestBase)==-1){
      suggestBase = suggestBase.split(" ");
      suggestBase.splice(0,1);
      suggestBase = suggestBase.join(" ");
    }
    var re = new RegExp(suggestBase, "i")
    return suggestion.replace(re,"");
  }
  function cloneObject(inObj){
    var outObj = {}
    for(var key in inObj){
      outObj[key] = inObj[key]
    }
    return outObj
  }
  return SenseSearchInput;
}());
