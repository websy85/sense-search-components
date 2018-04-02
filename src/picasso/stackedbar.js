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
