var service =  require('./service.js');
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
const bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
app.get('/isChannelExists',service.isChannelExists);
app.post('/create',service.createChannel);
app.post('/join',service.joinChannel);
app.ws('/channel/:userId/:channelName',service.establishSocketConnection);
app.get('/', function (req, res) {
    res.sendFile(__dirname + '\\index.html');
});
app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});