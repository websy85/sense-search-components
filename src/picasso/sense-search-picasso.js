var SenseSearchPicasso = (function(){
  var supportedTypes = ["barchart","linechart","piechart","combochart","scatterplot","kpi"]
  function SenseSearchPicasso(){
    picasso.use(picassoQ)
    this.config()
  }
  SenseSearchPicasso.prototype = Object.create(Object.prototype, {
    defaults: {
      writable: true,
      value: {
        renderer: "canvas",
        valueFontSize: 60,
        valueFontColor: "#404040",
        titleFontSize: 20,
        titleFontColor: "#BBBBBB"
      }
    },
    options: {
      writable: true,
      value: {}
    },
    config: {
      value: function(options){
        options = options || {};
        for(var d in this.defaults){
          this.options[d] = this.defaults[d];
        }
        for(var o in options){
          this.options[o] = options[o];
        }
        picasso.renderer.default(this.options.renderer)
        if (this.options.renderer=="canvas") {
          this.options.titleFontSize+="px"
          this.options.valueFontSize+="px"
        }        
      }
    },
    isSupported: {
      value: function(type){
        return (supportedTypes.indexOf(type)!==-1)
      }
    },
    render: {
      value: function(element, qlikObject){
        var that = this
        var functionToCall = "render" + qlikObject.model.genericType
        qlikObject.model.addListener("changed", function(){
          qlikObject.model.getLayout().then(function(layout){
            that[functionToCall](element, qlikObject.model, layout)
          })
        })
        qlikObject.model.getLayout().then(function(layout){
          that[functionToCall](element, qlikObject.model, layout)
        })
      }
    },
    renderbarchart: {
      value: function(element, model, layout){
        include "./bar.js"
      }
    },
    renderStackedBar: {
      value: function(element, model, layout){
        include "./stackedbar.js"
      }
    },
    renderpiechart: {
      value: function(element, model, layout){
        include "./pie.js"
      }
    },
    renderlinechart: {
      value: function(element, model, layout){
        include "./line.js"
      }
    },
    rendercombochart: {
      value: function(element, model, layout){
        include "./combo.js"
      }
    },
    renderscatterplot: {
      value: function(element, model, layout){
        include "./scatter.js"
      }
    },
    renderkpi: {
      value: function(element, model, layout){
        include "./kpi.js"
      }
    }
  })
  return SenseSearchPicasso
}())

window.senseSearchPicasso = new SenseSearchPicasso()
