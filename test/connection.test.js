"use strict";
var appjs = require('../app.js');
var app = appjs.express;
var should = require('should');
var expect = require('expect.js');
var io = require('socket.io-client');
io.transports = ['websocket'];
var socketURL = 'http://localhost:' + app.get('port') + '/game';
var options = {
    transports : ['websocket'],
    'force new connection' : true,
};
var sleep = function(T) {
    var d1 = new Date().getTime();
    var d2 = new Date().getTime();
    while (d2 < d1 + T) {//Tミリ秒待つ
        d2 = new Date().getTime();
    }
    return;
}
describe('socket.io test', function() {
    before(function(done) {
        appjs.MyApp.DEBUG = true;
        done();
    });
    it('should get init data when client is end init', function(done) {
        this.timeout(600000);
        var client = io.connect(socketURL, options);
        client.on('connect', function(data) {
            client.emit('client-endinit');
        });

        client.on('initialize', function(usersName) {
            client.disconnect();
            done();
        });
    });
    //1000件接続出来るかどうか。ファイルディスクリプタの最大値を大きくしないと一度に接続できない
    it('should over 1000 connection and they can move(!!!need with:\'ulimit -n 65535\' in terminal!!!)', function(done) {
        this.timeout(600000);
        var i = 0;
        var maxCount = 1000;
        var endActionCount = 0;

        function processRow() {( function processRows() {
                for (var j = 0; i < maxCount && j < 10; ++i, ++j) {// 10件ずつ処理
                    var client = io.connect(socketURL, options);
                    client.on('connect', function(data) {
                        var clientActionCount = 0;
                        client.emit('client-endinit');
                        if ((++endActionCount) === maxCount-1) {
                            done();
                        }
                    });
                    client.on('initialize', function() {
                    });
                    client.on('sync', function() {
                    });
                }
                if (i < maxCount) {
                    process.nextTick(processRows);
                }
            }());
        }

        processRow();
    });

});

