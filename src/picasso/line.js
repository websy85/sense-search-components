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
