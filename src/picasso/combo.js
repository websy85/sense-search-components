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
