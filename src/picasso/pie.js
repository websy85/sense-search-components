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
