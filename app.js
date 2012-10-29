"use strict";
var express = require('express')
  , http = require('http')
  , path = require('path')
  , util = require('util')
  , DB = require("./src/db.js")();

var MyApp = {
    cleanSessionDBIntervalID : 0,
    mapWidth : 100,
    mapHeight : 100,
    FPS : 15,
    DEBUG : false,
    maxEnemyCount : 10,
    maxStageUserCount : 30,
    maxCrystalCount : 30
};

//chachされなかった例外の処理
process.on('uncaughtException', function (err) {
    util.log('uncaughtException');
    util.error(err);
});

var app = express();
app.configure(function() {
    app.set('port', process.env.PORT || 8080);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.set('secretKey', 'intern');
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.cookieParser(app.get('secretKey')));
    app.use(express.session({
        secret : app.get('secretKey')
    }));
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
    app.use(express.errorHandler());
});

module.exports = {
    'DB' : DB,
    'MyApp' : MyApp,
    'express':app,
};


var loginRoutes = require('./routes/login');
var registRoutes = require('./routes/regist');
var gameRoutes = require('./routes/index');
var lobbyRoutes = require('./routes/lobby');

app.get('/', loginRoutes.index);
app.get('/login', loginRoutes.index);
app.post('/user/login', loginRoutes.login);
app.get('/user/logout', loginRoutes.logout);
app.get('/regist', registRoutes.index);
app.post('/regist/new', registRoutes.regist);
app.get('/lobby', lobbyRoutes.index);
app.get('/game', gameRoutes.index);
app.get('/game/:mode', gameRoutes.index);
app.get('/game/:mode/:mapID(\-*[0-9]+)', gameRoutes.index);

require('./src/connection.js')(app);