## Sense Search Components
A collection of HTML/JavaScript APIs that allow you to leverage the power of the Qlik Sense QIX engine to embed search in to a Web application.

The components can be used with the Qlik Sense Capability API, a QSocks implementation or on own their own.

Below is a quick start guide, for more details please see the Wiki.

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
There are 2 available modes for searching, "associations" and "simple". The default mode is "associations".
##### Assocations
In this mode the Search Box will behave like the Search Box in the Qlik Sense client. The engine will return the valid associations that were found using the specified search terms. This allows you to make selections in the desired fields to display the results that you want.
##### Simple
In this mode the Sense Search Components will automatically select the first valid association returned by the engine and automatically display the results for it. When using this mode it's best to create a field specifically for searching and concatinate various fields together.
