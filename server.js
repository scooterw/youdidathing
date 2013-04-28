var config = {};

var express = require('express'),
    server = express.createServer(),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    io = require('socket.io').listen(server);

server.configure(function() {
  server.use(express.methodOverride());
  server.use(express.bodyParser());
  //server.use(express.cookieParser());
  //server.use(express.session({secret: 'this is a bad secret'}));
  server.use(server.router);
});

server.configure('development', function() {
  config.port = 3000;
  server.use(express.static(__dirname + '/public'));
});

server.configure('production', function() {
  config.port = 8080;
  server.use(express.static(__dirname + '/public'));
});

mongoose.connect('mongodb://localhost/pm_dev');

var playerSchema = new Schema({
  loc: {
    type: [Number],
    required: true,
    index: '2d'
  },
  name: String
});

var itemSchema = new Schema({
  loc: {
    type: [Number],
    required: true,
    index: '2d'
  },
  color: String
});

var Player = mongoose.model('Player', playerSchema);
var Item = mongoose.model('Item', itemSchema);

// routes for future account management

server.listen(config.port, function() {
  console.log('Server started on port: ' + config.port);
});

var players = {};

io.sockets.on('connection', function (socket) {
  socket.on('create player', function (player, fn) {
    if (!(player.name in players)) {
      var playerList = players;
      players[player.name] = player;
      socket.set('player', player, function () {
        socket.broadcast.emit('player connected', player);
      });
      fn({player: player, playerList: playerList});
    } else {
      fn({error: {type: 'name'}});
    }
  });

  socket.on('disconnect', function () {
    socket.get('player', function (err, player) {
      if (player && (player.name in players)) delete players[player.name];
      socket.broadcast.emit('player disconnected', player);
    }
  });

  socket.on('submit location', function (loc) {
    socket.get('player', function (err, player) {
      socket.broadcast.emit('share location', {user: user, loc: loc});
    });

    Item.find({
      loc: {
        $within: {
          $centerSphere: [[loc.lng, loc.lat], (6 / (6371 * 1000))]
        }
      }
    }, function (err, items) {
      if (items && items.length > 0) {
        socket.emit('pickup item', items[0]);
        socket.broadcast.emit('remove item', items[0]);
      }
    });
  });
});

