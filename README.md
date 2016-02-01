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

###Adding the Search Box to your Web page
This is as simple as including the custom tag <sense-search-input>. Make sure you give the element an Id.
``` html
<body style="width: 80%; margin: 20px auto; font-family: arial;">
    <sense-search-input id="myInput"></sense-search-input>
  </body>
```
