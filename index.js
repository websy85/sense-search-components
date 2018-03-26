var express = require('express'),
    app = express();

app.use('/', express.static(__dirname + '/client/build'));
app.use('/:html', function(req, res){
  res.sendFile(__dirname + '/examples/'+req.params.html)
})

app.get('*', function(req, res){
  res.sendFile(__dirname+'/client/build/index.html');
});

app.listen(process.env.PORT || 4000, function(){
  console.log('listening on port 4000');
});
