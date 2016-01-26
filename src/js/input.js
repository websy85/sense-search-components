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

  var templateHtml = "<div class='sense-search-input-main'><div id='{id}_ghost' class='sense-search-input-bg'></div><input id='{id}_input' autofocus placeholder='Please wait...' disabled='disabled' type='text' autocorrect='off' autocomplete='off' autocapitalize='off' spellcheck='false' /><div class='sense-search-lozenge-container'></div><button type='button' class='sense-search-input-clear'>x</button></div><div id='{id}_suggestions' class='sense-search-suggestion-container'><ul id='{id}_suggestionList'></ul></div>";

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
        senseSearch.search(this.searchText, this.searchFields || []);
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
