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
        var selectedValues = []
        var selectDimension = 0
        var collections = []
        var scales = {}
        var boxSettings = {}
        if (layout.qHyperCube.qDimensionInfo.length==2) {
          selectDimension = 1
          collections.push({
            key: 'main',
            data: {
              extract: {
                field: 'qDimensionInfo/1',
                props: {
                  series: { field: 'qDimensionInfo/0' },
                  end: { field: 'qMeasureInfo/0' }
                }
              },
              stack: {
                stackKey: function (d) {return d.value},
                value: function(d) {return d.end.value}
              }
            }
          })
          scales = {
            y: {
              data: {
                collection: {
                  key: 'main'
                }
              },
              invert: true,
              expand: 0.2
            },
            x: { data: { extract: { field: 'qDimensionInfo/1' } }, padding: 0.3 },
            color: { data: { extract: { field: 'qDimensionInfo/0' } }, type: 'color' }
          }
          boxSettings = {
            major: { scale: "x" },
            minor: { scale: "y", ref: 'end' },
            box: {
              fill: { scale: 'color', ref: 'series' }
            }
          }
        }
        else {
          collections.push({
            key: "main",
            data: {
              extract: {
                field: "qDimensionInfo/0",
                props: {
                  start: 0,
                  end: { field: "qMeasureInfo/0" }
                }
              }
            }
          })
          scales = {
            y: {
              data: { extract: {field: "qMeasureInfo/0" }},
              invert: true,
              include: [0, layout.qHyperCube.qMeasureInfo[0].qMax]
            },
            x: { data: { extract: {field: "qDimensionInfo/0" }}, padding: 0.2 }
          }
          boxSettings = {
            major: { scale: "x" },
            minor: { scale: "y" }
          }
        }
        var components = [
          {
            type: "axis",
            dock: "left",
            scale: "y",
            settings: {}
          },
          {
            key: "xaxis",
            type: "axis",
            dock: "bottom",
            scale: "x",
            settings: {}
          },
          {
            key: "bars",
            type: "box",
            data: {
              collection: "main"
            },
            settings: boxSettings,
            brush: {
              consume: [
              {
                context: "range-brush",
                 style: {
                   inactive: {
                       opacity: 0.3
                     }
                 }
               }
             ]
           }
          },
          {
            key: "rangeX",
            type: "brush-range",
            settings: {
                brush: "range-brush",
                direction: "horizontal",
                scale: "x",
                target: {
                  component: "xaxis"
                },
                bubbles: {
                  align: "end"
                }
              }
          }
        ]
        if (layout.qHyperCube.qDimensionInfo.length==2) {
          components.push({
            type: 'legend-cat',
            dock: "right",
            scale: 'color'
          })
        }
        var pChart = picasso.chart({
          element: element,
          data: {
            type: "q",
            data: layout.qHyperCube
          },
          settings: {
            collections: collections,
            interactions: [
            {
              type: "native",
              events: {
                mousedown: function(e) {
                  console.log("mouse down");
                  this.chart.component("rangeX").emit("rangeStart", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                },
                mousemove: function(e) {
                  this.chart.component("rangeX").emit("rangeMove", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                },
                mouseup: function(e) {
                  this.chart.component("rangeX").emit("rangeEnd", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                  model.selectHyperCubeValues("/qHyperCubeDef", selectDimension, selectedValues, true)
                }
              }
            }],
            scales: scales,
            components: components
          }
        })
        pChart.brush("range-brush").on("update", function(added){
          selectedValues.push(added[0].values[0])
        })

      }
    },
    renderStackedBar: {
      value: function(element, model, layout){
        var pchart = picasso.chart({
              element: element,
              data: {
                type: "q",
                data: layout.qHyperCube
              },
              settings: {
                collections: [{
                  key: 'stacked',
                  data: {
                    extract: {
                      field: 'qDimensionInfo/1',
                      props: {
                        series: { field: 'qDimensionInfo/0' },
                        end: { field: 'qMeasureInfo/0' }
                      }
                    },
                    stack: {
                    	stackKey: function (d) {return d.value},
                      value: function(d) {return d.end.value}
                    }
                  }
                }],
                scales: {
                  y: {
                    data: {
                      collection: {
                        key: 'stacked'
                      }
                    },
                    invert: true,
                    expand: 0.2
                  },
                  t: { data: { extract: { field: 'qDimensionInfo/1' } }, padding: 0.3 },
                  color: { data: { extract: { field: 'qDimensionInfo/0' } }, type: 'color' }
                },
                components: [{
                  type: 'axis',
                  dock: 'left',
                  scale: 'y'
                },
                {
                  type: 'axis',
                  dock: 'bottom',
                  scale: 't'
                },
                {
                  type: 'legend-cat',
                  scale: 'color',
                  dock: 'top'
                },
                {
                  key: 'bars',
                  type: 'box',
                  displayOrder: 1,
                  data: {
                    collection: 'stacked'
                  },
                  settings: {
                    major: { scale: 't' },
                    minor: { scale: 'y', ref: 'end' },
                    box: {
                      fill: { scale: 'color', ref: 'series' }
                    }
                  }
                }
              ]
            }
          })

      }
    },
    renderpiechart: {
      value: function(element, model, layout){
        var colors = []
        picasso.chart({
            element: element,
            data: {
              type: "q",
              data: layout.qHyperCube
            },
            settings: {
              scales: {
                c: {
                  data: { extract: { field: 'qDimensionInfo/0' } }, type: 'color'
                }
              },
              components: [
                {
                  type: 'legend-cat',
                  scale: 'c'
                },
                {
                  type: 'pie',
                  data: {
                    extract: {
                      field: 'qDimensionInfo/0',
                      props: {
                        num: { field: 'qMeasureInfo/0' }
                      }
                    }
                  },
                  settings: {
                    padAngle: 0.01,
                    slice: {
                      arc: { ref: 'num' },
                      outerRadius: 0.8,
                      innerRadius: 0.6,
                      cornerRadius: 2,
                      opacity: 1,
                      fill: { scale: 'c' },
                      strokeWidth: 1,
                      stroke: '#ffffff'
                    }
                  }
                }
              ]
            }
          });

      }
    },
    renderlinechart: {
      value: function(element, model, layout){
        var selectedValues = []
        var selectDimension = 0
        var collections = []
        var scales = {}
        var lineSettings = {}
        if (layout.qHyperCube.qDimensionInfo.length==2) {
          selectDimension = 1
          collections.push({
            key: 'main',
            data: {
              extract: {
                field: 'qDimensionInfo/1',
                props: {
                  line: { field: 'qDimensionInfo/0' },
                  end: { field: 'qMeasureInfo/0' }
                }
              },
              stack: {
                stackKey: function (d) {return d.value},
                value: function(d) {return d.end.value}
              }
            }
          })
          scales = {
            y: {
              data: {
                collection: {
                  key: 'main'
                }
              },
              invert: true,
              expand: 0.2
            },
            x: { data: { extract: { field: 'qDimensionInfo/1' } }, padding: 0.3 },
            color: { data: { extract: { field: 'qDimensionInfo/0' } }, type: 'color' }
          }
          lineSettings = {
            coordinates: {
              major: { scale: 'x' },
              minor0: { scale: 'y', ref: 'start' },
              minor: { scale: 'y', ref: 'end' },
              layerId: { ref: 'line' }
            },
            layers: {
              curve: 'monotone',
              line: {
                show: false
              },
              area: {
                fill: { scale: 'color', ref: 'line' }
              }
            }
          }
        }
        else {
          collections.push({
            key: "main",
            data: {
              extract: {
                field: "qDimensionInfo/0",
                props: {
                  num: { field: "qMeasureInfo/0" }
                }
              }
            }
          })
          scales = {
            y: {
              data: { extract: {field: "qMeasureInfo/0" }},
              invert: true,
              include: [0, layout.qHyperCube.qMeasureInfo[0].qMax]
            },
            x: { data: { extract: {field: "qDimensionInfo/0" }}, padding: 0.2 }
          }
          lineSettings = {
            coordinates: {
              major: { scale: 'x' },
              minor: { scale: 'y', ref: 'num' }
            },
            layers: {
              curve: 'monotone',
              line: {
                show: false
              },
              area: {}
            }
          }
        }
        var components = [
          {
            type: "axis",
            dock: "left",
            scale: "y",
            settings: {}
          },
          {
            key: "xaxis",
            type: "axis",
            dock: "bottom",
            scale: "x",
            settings: {}
          },
          {
            key: 'lines',
            type: 'line',
            data: {
              collection: "main"
            },
            settings: lineSettings
          },
          {
            key: "rangeX",
            type: "brush-range",
            settings: {
                brush: "range-brush",
                direction: "horizontal",
                scale: "x",
                target: {
                  component: "xaxis"
                },
                bubbles: {
                  align: "end"
                }
              }
          }
        ]
        if (layout.qHyperCube.qDimensionInfo.length==2) {
          components.push({
            type: 'legend-cat',
            dock: "right",
            scale: 'color'
          })
        }
        var pChart = picasso.chart({
          element: element,
          data: {
            type: "q",
            data: layout.qHyperCube
          },
          settings: {
            collections: collections,
            interactions: [
            {
              type: "native",
              events: {
                mousedown: function(e) {
                  console.log("mouse down");
                  this.chart.component("rangeX").emit("rangeStart", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                },
                mousemove: function(e) {
                  this.chart.component("rangeX").emit("rangeMove", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                },
                mouseup: function(e) {
                  this.chart.component("rangeX").emit("rangeEnd", { center: { x: e.clientX, y: e.clientY }, deltaX: e.movementX, deltaY: e.movementY });
                  model.selectHyperCubeValues("/qHyperCubeDef", selectDimension, selectedValues, true)
                }
              }
            }],
            scales: scales,
            components: components
          }
        })
        pChart.brush("range-brush").on("update", function(added){
          selectedValues.push(added[0].values[0])
        })

        // picasso.chart({
        //   element: element,
        //   data: {
        //     type: "q",
        //     data: layout.qHyperCube
        //   },
        //   settings: {
        //     scales: {
        //       y: {
        //         data: { extract: {field: "qMeasureInfo/0" }},
        //         invert: true,
        //         include: [0, layout.qHyperCube.qMeasureInfo[0].qMax]
        //       },
        //       x: { data: { extract: {field: "qDimensionInfo/0" }} },
        //     },
        //     components: [{
        //       type: 'axis',
        //       dock: 'left',
        //       scale: 'y',
        //       settings: {}
        //     },{
        //       type: 'axis',
        //       dock: 'bottom',
        //       scale: 'x',
        //       settings: {}
        //     },{
        //       key: 'line',
        //       type: 'line',
        //       data: {
        //         extract: {
        //           field: 'qDimensionInfo/0',
        //           props: {
        //             num: { field: 'qMeasureInfo/0' }
        //           }
        //         }
        //       },
        //       settings: {
        //         coordinates: {
        //           major: { scale: 'x' },
        //           minor: { scale: 'y', ref: 'num' }
        //         },
        //         layers: {
        //           curve: 'monotone',
        //           line: {
        //             show: false
        //           },
        //           area: {}
        //         }
        //       }
        //     }]
        //   }
        // })

      }
    },
    rendercombochart: {
      value: function(element, model, layout){
        picasso.chart({
          element: element,
          data: {
            type: "q",
            data: layout.qHyperCube
          },
          settings: {
            scales: {
              y: {
                data: { extract: {field: "qMeasureInfo/0" }},
                invert: true,
                include: [0, layout.qHyperCube.qMeasureInfo[0].qMax]
              },
              y2: {
                data: { extract: {field: "qMeasureInfo/1" }},
                invert: true,
                include: [0, layout.qHyperCube.qMeasureInfo[1].qMax]
              },
              x: { data: { extract: {field: "qDimensionInfo/0" }}, padding: 0.2 },
            },
            components: [{
              type: 'axis',
              dock: 'left',
              scale: 'y',
              settings: {}
            },
            {
              type: 'axis',
              dock: 'right',
              scale: 'y2',
              settings: {}
            },
            {
              type: 'axis',
              dock: 'bottom',
              scale: 'x',
              settings: {}
            },
            {
              key: 'bars',
              type: 'box',
              data: {
                extract: {
                  field: 'qDimensionInfo/0',
                  props: {
                    start: 0,
                    end: { field: 'qMeasureInfo/0' }
                  }
                }
              },
              settings: {
                major: { scale: 'x' },
                minor: { scale: 'y' }
              }
            },
            {
              key: 'line',
              type: 'line',
              data: {
                extract: {
                  field: 'qDimensionInfo/0',
                  props: {
                    num: { field: 'qMeasureInfo/1' }
                  }
                }
              },
              settings: {
                coordinates: {
                  major: { scale: 'x' },
                  minor: { scale: 'y2', ref: 'num' }
                },
                layers: {
                  curve: 'monotone',
                  line: {
                    stroke: "#b53f3f"
                  }
                }
              }
            }
          ]}
        })

      }
    },
    renderscatterplot: {
      value: function(element, model, layout){
        picasso.chart({
          element: element,
          data: {
            type: "q",
            data: layout.qHyperCube
          },
          settings: {
            scales: {
              s: {
                data: { extract: { field: 'qMeasureInfo/0' } },
                expand: 0.2,
                invert: true
              },
              m: {
                data: { extract: { field: 'qMeasureInfo/1' } },
                expand: 0.1
              },
              col: {
                data: { extract: { field: 'qDimensionInfo/0' } },
                type: 'color'
              }
            },
            components: [{
              key: 'y-axis',
              type: 'axis',
              scale: 's',
              dock: 'left'
            }, {
              type: 'legend-cat',
              dock: 'right',
              scale: 'col'
            }, {
              key: 'x-axis',
              type: 'axis',
              scale: 'm',
              dock: 'bottom'
            }, {
              key: 'p',
              type: 'point',
              data: {
                extract: {
                  field: 'qDimensionInfo/0',
                  props: {
                    y: { field: 'qMeasureInfo/0' },
                    x: { field: 'qMeasureInfo/1' }
                  }
                }
              },
              settings: {
                x: { scale: 'm' },
                y: { scale: 's' },
                shape: 'circle',
                size: 1,
                strokeWidth: 2,
                stroke: '#fff',
                opacity: 0.8
              }
            }]
          }
        })

      }
    },
    renderkpi: {
      value: function(element, model, layout){
        var colors = []
        var kpiTitle
        var kpiValue
        if (layout.qHyperCube.qMeasureInfo && layout.qHyperCube.qMeasureInfo[0]) {
          kpiTitle = layout.qHyperCube.qMeasureInfo[0].qFallbackTitle
          kpiValue = layout.qHyperCube.qDataPages[0].qMatrix[0][0].qText
        }
        else {
          return
        }
        picasso.chart({
            element: element,
            settings: {
              components: [
                {
                  type: "text",
                  text: kpiValue,
                  dock: "top",
                  style: {
                    text: {
                      fontSize: this.options.valueFontSize,
                      fill: this.options.valueFontColor
                    }
                  },
                  settings: {
                    anchor: "center",
                    paddingStart: 20,
                    paddingEnd: 50
                  }
                },
                {
                  type: "text",
                  text: kpiTitle,
                  dock: "top",
                  style: {
                    text: {
                      fontSize: this.options.titleFontSize,
                      fill: this.options.titleFontColor
                    }
                  },
                  settings: {
                    anchor: "center",
                    paddingStart: 20,
                    paddingEnd: 20
                  }
                }
              ]
            }
          });

      }
    }
  })
  return SenseSearchPicasso
}())

window.senseSearchPicasso = new SenseSearchPicasso()
