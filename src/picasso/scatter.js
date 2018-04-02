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
