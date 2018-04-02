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
    components: [
      {
        type: 'legend-cat',
        dock: "right",
        scale: 'color'
      },
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
  }
})
pChart.brush("range-brush").on("update", function(added){
  selectedValues.push(added[0].values[0])
})
