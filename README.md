## Sense Search Components
A collection of HTML/JavaScript components that allow you to leverage the power of the Qlik Sense QIX engine to embed search in to a Web application or use a more natural language to generate charts on the fly.

The components can be used with the Qlik Sense Capability API, a QSocks implementation or on own their own.

Below is a quick start guide, for more details please see the <a href='https://github.com/websy85/sense-search-components/wiki' target='_blank'>Wiki</a>. If you think there's anything missing please let me know.

####Getting Started
To include the Sense Search Components in your Web application you will need to include references to the JavaScript API and the CSS file for styling. Be sure to add the JavaScript file at the end of the HTML body
``` html
<link rel="stylesheet" href="https://rawgit.com/websy85/sense-search-components/master/build/sense-search.min.css"/>
<script type="text/javascript" src="https://rawgit.com/websy85/sense-search-components/master/build/sense-search.min.js"></script>
```
Once included, a new Global object called 'senseSearch' will be available
####Connecting to the Sense Engine
``` javascript
var config = {
      host: "<hostname>",
      port: "<portnumber",
      prefix: "<virtualproxy>",
      isSecure: true|false,
      app: "<appname or guid>"
    };
senseSearch.connect(config, function(){
    
});
```
####Adding the Search Box to your Web page
This is as simple as including the custom tag <sense-search-input>. Make sure you give the element an Id.
``` html
<body style="width: 80%; margin: 20px auto; font-family: arial;">
    <sense-search-input id="myInput"></sense-search-input>
</body>
```
####Adding a Results List to your Web page
1. Add an HTML container to your page (the API contains an example Results List but you can use any method to render the results i.e. AngularJS, Handlebars etc). Make sure you give the element an Id.
``` html
<sense-search-results id="myResults"></sense-search-results>
```
2. Define the Result List definition and attach it to the Results List. The information provided here will be used to build a Session Hypercube for getting the desired values from your Sense application.
``` javascript
senseSearch.connect(config, function(){
    var options = {
        "fields":[
          {
            "dimension": "<fieldname>",
            "suppressNull": true|false
          },
          ...
        ],
        "sortOptions": {
          "<fieldname>": {
            "id": "<fieldname>",
            "name": "<displayname>",
            "order": 1(asc)|-1(desc)|0(none),
            "field": "<fieldname>",
            "sortType": "qSortByAscii|qSortByNumeric|..."
          }
        },
        "defaultSort": "<fieldname>"
    }
    senseSearch.results["myResults"].attach(options);
});
```
####Search Behaviour
There are 3 available modes for searching, "associations", "simple" and "visualizations". The default mode is "associations".
##### Associations
In this mode the Search Box will behave like the Search Box in the Qlik Sense client. The engine will return the valid associations that were found using the specified search terms. This allows you to make selections in the desired fields to display the results that you want.

You can see an 'associations' search example [here](https://rawgit.com/websy85/sense-search-components/master/examples/coded.html)

##### Simple
In this mode the Sense Search Components will automatically select the first valid association returned by the engine and display the results for it. When using this mode it's best to create a field specifically for searching and concatinate various fields together.

You can see a 'simple' search example [here](https://rawgit.com/websy85/sense-search-components/master/examples/standard.html)

##### Visualizations
In this mode you can use a more natural language structure to generate visualizations on the fly. For example, if you type 'sales by rep for 2016', the QIX engine understands that 'sales' is a measure, 'rep' is a dimension and the value '2016' can be found in the year field. The search result in this instance will be a hypercube and if used with the Capability APIs will render a chart as well. You can read more about this mode in the Wiki.

You can see a 'visualizations' search example [here](https://rawgit.com/websy85/sense-search-components/master/examples/nlp.html)
