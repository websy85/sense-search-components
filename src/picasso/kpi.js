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
