var SenseSearchSpeech = (function(){
  var templateHtml = "<button class='sense-search-mic' id='{id}_micButton'></button>";

  function SenseSearchSpeech(id, options){
    if(typeof senseSearch==="undefined" && options.senseSearch){
      senseSearch = options.senseSearch;
    }
    if(typeof document!=="undefined"){
      var element = document.createElement("div");
      element.id = id;
      element.classList.add("sense-search-speech-container");
      var html = templateHtml.replace(/{id}/gim, id);
      element.innerHTML = html;
    }
    if(typeof SpeechRecognition !== "undefined"){
      this.SpeechRecognition = SpeechRecognition
      this.SpeechGrammarList = SpeechGrammarList
    }
    else if (typeof webkitSpeechRecognition !== "undefined") {
      this.SpeechRecognition = webkitSpeechRecognition
      this.SpeechGrammarList = webkitSpeechGrammarList
    }
    options = options || {};
    for(var o in options){
      this[o] = options[o];
    }
    this.id = id;
    if(typeof document!=="undefined"){
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
      if(!this.SpeechRecognition){
        element.classList.add("sense-search-no-support")
      }
      else {
        this.enabled = true
        this.recognition = new this.SpeechRecognition();
        this.synth = window.speechSynthesis;
        this.voices = this.synth.getVoices();
        this.recognition.lang = this.recognitionLanguage;
        this.recognition.continuous = this.continuousRecognition;
        this.recognition.interimResults = this.interimResults;

        this.recognition.onstart = this.recognitionStart.bind(this)

        this.recognition.onstop = this.recognitionStop.bind(this)

        this.recognition.onaudioend = this.recognitionAudioEnd.bind(this)

        this.recognition.onerror = this.recognitionError.bind(this)

        this.recognition.onresult = this.recognitionResult.bind(this)

        this.recognition.onend = this.recognitionEnd.bind(this)

        if(!this.inputId){
          this.inputId = Object.keys(senseSearch.inputs)[0]
        }

        this.ready = new Subscription();
        senseSearch.ready.subscribe(this.activate.bind(this));
        senseSearch.inputs[this.inputId].onAmbiguity.subscribe(this.onSearchAmbiguity.bind(this))
        senseSearch.cleared.subscribe(this.onClear.bind(this));
      }
    }
    return {element: element, object: this};
  }
  SenseSearchSpeech.prototype = Object.create(Object.prototype, {
    enabled: {
      writable: true,
      value: false
    },
    awaitingResolve: {
      writable: true,
      value: false
    },
    recognitionLanguage:{
      writable: true,
      value: "en-GB"
    },
    listenOnActivate: {
      writable: true,
      value: false
    },
    listening: {
      writable: true,
      value: false
    },
    continuousRecognition: {
      writable: true,
      value: true
    },
    interimResults: {
      writable: true,
      value: false
    },
    clearWords: {
      writable: true,
      value: ["clear"]
    },
    replaceWords:{
      writable: true,
      value: ["replace"]
    },
    replaceWithWords: {
      writable: true,
      value: ["with"]
    },
    safeWords: {
      writable: true,
      value: []
    },  // used to only update the search input when one of the words listed is said
    safeWordFirst: {
      writable: true,
      value: false
    }, // used in conjunction with the safe words to determine if the word should be the first thing said or if it can appear anywhere
    onClick: {
      value: function(event){
        if (event.target.classList.contains("sense-search-mic")) {
          this.recognise()
        }
      }
    },
    ready: {
      writable: true
    },
    activate: {
      value: function(){
        this.setClass(true, "sense-search-ready")
        if(this.listenOnActivate===true){
          this.recognise()
        }
      }
    },
    recognise: {
      value: function(){
        this.listening = true
        this.recognition.start()
      }
    },
    onSearchAmbiguity: {
      value: function(ambiguity){
        var that = this
        if (this.listening !== true){
          return
        }
        if(!this.awaitingResolve){
          this.recognition.stop();
          currentAmbiguity = ambiguity;
          this.awaitingResolve = true;
          this.speak("what do you mean by "+ambiguity.term.text+"?.")
          setTimeout(function(){
            try{
              that.recognition.start();
            }
            catch(ex){
              console.log(ex);
            }
            senseSearch.inputs[that.inputId].showAmbiguityOptions(ambiguity.termIndex)
          },2000);
        }
      }
    },
    onClear: {
      value: function(){
        this.awaitingResolve = false
      }
    },
    setClass: {
      value: function(add, className){
        if(typeof document!=="undefined"){
          var micEl = document.getElementById(this.id);
          if(micEl && add===true){
            micEl.classList.add(className)
          }
          else if (micEl && add===false){
            micEl.classList.remove(className)
          }
        }
      }
    },
    recognitionStart: {
      value: function (event) {
        console.log('recognition started');
        this.setClass(true, "sense-search-listening")
      }
    },
    recognitionStop: {
      value: function (event) {
        console.log('recognition stopped');
        this.setClass(false, "sense-search-listening")
      }
    },
    recognitionAudioEnd: {
      value: function () {
        console.log('audio end');
        try {
          this.recognition.start();
        } catch (ex) {}
      }
    },
    recognitionError: {
      value: function (event) {
        console.log("recognition error");
        console.log(event);
        this.recognition.stop();
      }
    },
    recognitionEnd: {
      value: function () {
        console.log('recognition end');
        console.log(this.recognition);
        try{
          this.recognition.start();
        }
        catch(ex){
          console.log(ex);
          this.listening = false
          this.setClass(false, "sense-search-listening")
        }
      }
    },
    recognitionResult: {
      value: function (event) {
        console.log("recognition result");
        console.log(event);
        console.log(this.recognition);
        for (var i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            var searchText = senseSearch.inputs[this.inputId].searchText || "";
            searchText = searchText.trim();
            var text = event.results[i][0].transcript.trim();
            if(text===""){
              return
            }
            console.log(text);
            var isFinal = event.results[i].isFinal;
            // Check if we're clearing the search
            if (text.split(" ").length===1) {
              if(this.clearWords.indexOf(text.toLowerCase().trim())!==-1){
                senseSearch.clear();
                return
              }
            }
            // Check if we're replacing a word
            for (var w = 0; w < this.replaceWords.length; w++) {
              if (text.toLowerCase().indexOf(this.replaceWords[w]) !== -1) {
                var replaceText = text.replace(this.replaceWords[w], "");
                var parts = this.getReplaceParts(replaceText);
                if(Array.isArray(parts)){
                  if (searchText.indexOf(parts[0].trim()) === -1) {
                    this.speak("I'm not sure what you want me to replace.");
                  }
                  else if (parts[1].trim() === "") {
                    this.speak("I'm not sure what you want me to replace.");
                  }
                  else {
                    searchText = searchText.replace(parts[0].trim(), parts[1].trim());
                    senseSearch.inputs[this.inputId].setSearchText(searchText, !isFinal);
                  }
                }
                else {
                  this.speak("I'm not sure what you want me to replace.");
                }
              }
            }
            // Check to see if we're awating a resolve
            if (this.awaitingResolve===true){
              for (var i = 0; i < currentAmbiguity.fields.length; i++) {
                if (text.indexOf(currentAmbiguity.fields[i]) !== -1) {
                  this.awaitingResolve = false;
                  senseSearch.inputs[this.inputId].resolveAmbiguity(currentAmbiguity.termIndex, currentAmbiguity.fields[i]);
                  break;
                }
              }
              if (this.awaitingResolve) {
                this.speak("I didn't catch that.");
              }
            }
            // Check if any safe words should be detected
            if (this.safeWords.length > 0) {
              for (var i = 0; i < this.safeWords.length; i++) {
                var safeWordIndex = (searchText + " " + text).indexOf(this.safeWords[i])
                if((safeWordIndex===-1 || (safeWordFirst && safeWordIndex > 0))){
                  return // Safe word does not appear or appears in the wrong place
                }
              }
            }
            // Add the text to the search and execute
            searchText += " " + text;
            senseSearch.inputs[this.inputId].setSearchText(searchText, !isFinal);
          }
        }
      }
    },
    speak: {
      value: function(text){
        if (this.listening !== true) {
          return
        }
        var that = this
        this.recognition.stop();
        this.speaking = true
        var utterThis = new SpeechSynthesisUtterance(text);
        utterThis.voice = this.voices[0];
        utterThis.addEventListener('end', function (event) {
          that.speaking = false
          console.log('utterance ended');
          try{
            that.recognition.start();
          }
          catch(ex){
            console.log(ex);
          }
          if (typeof callbackFn !== "undefined") {
            callbackFn();
          }
        });
        utterThis.onerror = function (event) {
          console.log('utterance error');
        };
        utterThis.onpause = function (event) {
          console.log('utterance pause');
        };
        this.synth.speak(utterThis);
      }
    },
    getReplaceParts: {
      value: function (text) {
        var separator;
        for (var i = 0; i < this.replaceWithWords.length; i++) {
          if (text.indexOf(this.replaceWithWords[i]) !== -1) {
            separator = this.replaceWithWords[i];
          }
          return text.split(separator);
        }
      }
    }
  })
  return SenseSearchSpeech
}())
