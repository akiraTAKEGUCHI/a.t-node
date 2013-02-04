"use strict";
module.exports = function(app) {
    var http = require('http')
      , httpServer = http.createServer(app).listen(app.get('port'))
      , appjs = require("../app.js")
      , connect = require('connect')
      , util = require('util')
      , url = require('url')
      , DB = appjs.DB
      , io = require('socket.io').listen(httpServer)
      , Stage = require("./stage.js")
      , MyApp = appjs.MyApp;
      
    console.log("Express server listening on port " + app.get('port'));

    MyApp.stageList = Stage.StageList();

    io.set('log level', 1);
    io.configure('production', function() {
        io.enable('browser client minification');
        io.enable('browser client etag');
        io.set('log level', 1);
        // 全てのtransportを有効にする
        io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']);
    });

    /**
     * Scoket.ioの接続確立前にログインしているか確認する
     */
    io.set('authorization', function(handshakeData, callback) {
        util.debug("authorization");
        if (handshakeData.headers.cookie || MyApp.DEBUG) {
            //cookieを取得
            var cookie = handshakeData.headers.cookie;
            var parseCookie = require('cookie').parse;
            var sessionID = connect.utils.parseSignedCookies(parseCookie(decodeURIComponent(cookie)),app.get('secretKey'))['connect.sid'];

            // 必要なデータを格納
            handshakeData.cookie = cookie;
            handshakeData.sessionID = sessionID;

            //デバッグ時は/game?id=*****でuserIDを指定可能
            if (MyApp.DEBUG) {
                var query;
                var userID = handshakeData.sessionID;
                if ( typeof handshakeData.headers.referer !== 'undefined' && ( query = url.parse(handshakeData.headers.referer, true).query) && typeof query !== 'undefined' && typeof query.id !== 'undefined') {
                    userID = query.id;
                }
                else {
                    userID = handshakeData.issued;
                }

                util.debug(util.format("authorization success:%s", userID));
                handshakeData.userID = userID;
                return callback(null, true);
            }

            // セッションをDBから取得
            DB.isLogined(sessionID, function(session) {
                util.debug(util.format("authorization success:%s", session.userID));
                handshakeData.userID = session.userID;
                callback(null, true);
            }, function(err) {
                if (err) {
                    //セッションが取得できなかったら
                    util.log("authorization failed");
                    console.dir(err);
                    callback(err.message, false);
                }
                else {
                    util.debug("authorization failed:not logined");
                    callback("not logined", false);
                }
            });
        }
        else {
            //cookieが見つからなかった時
            return callback('cookie not found', false);
        }
    });

    /**
     * socket.io接続確立
     */
    //ゲームのメインコネクション
    var game = io.of('/game').on('connection', function(socket) {
        console.log("connection:" + io.of('/game').clients().length);

        //1分ごとにセッションを更新するループ
        var sessionReloadIntervalID = setInterval(function() {
            DB.sessionUpdate({
                sessionID : socket.handshake.sessionID,
                userID : socket.handshake.userID
            }, function(res) {
            }, function(err) {
            });
        }, 1000 * 60);

        //クライアントがクエストページorバトルページを開いた時
        //TODO:ロジックは中にStageListの中にいれる
        socket.on("client-endinit", function(data) {
            console.log("client-endinit");

            if ( typeof data === 'undefined') {
                util.error("data is undefined");
                data = {
                    mode : 'quest'
                };
            }

            if (data.mode === 'battle') {
                if ( typeof data.battleMapID === 'undefined') {
                    data.battleMapID = -1;
                }

                //TODO:バトルのステージIDをクライアントから受け取ってそのまま使っているが、
                //onConnection中のどこかで接続中の人数とか調べて適切に処理する
                MyApp.stageList.onConnection({
                    userID : socket.handshake.userID,
                    sessionID : socket.handshake.sessionID,
                    socketID : socket.id,
                    socket : socket,
                    mode : "battle",
                    battleMapID : data.battleMapID
                });
            }
            else {
                MyApp.stageList.onConnection({
                    userID : socket.handshake.userID,
                    sessionID : socket.handshake.sessionID,
                    socketID : socket.id,
                    socket : socket,
                    mode : "quest",
                });
            }
        });

        //クライアントがキーを押した時
        socket.on('keydown', function(code) {
            console.log("keydown");

            MyApp.stageList.onKeyDown({
                userID : socket.handshake.userID,
                code : code,
                io : game
            });
        });
        socket.on('disconnect', function() {
            console.log("disconnect");

            MyApp.stageList.onDisconnect({
                userID : socket.handshake.userID,
            });
            // セッションの更新を停止
            clearInterval(sessionReloadIntervalID);
        });

        //チャットメッセージ
        socket.on('chatMessage', function(message) {
            message = message || {};
            //日付も付加する
            MyApp.stageList.onChatMessage({
                userID : socket.handshake.userID,
                message : message,
                postDate:new Date().getTime(),
                io : game
            });
        });
    });

    //待機ページ用の接続ネームスペース
    var waiting = io.of('/lobby').on('connection', function(socket) {
        console.log("lobby connect");

        //1分ごとにセッションを更新するループ
        var sessionReloadIntervalID = setInterval(function() {
            DB.sessionUpdate({
                sessionID : socket.handshake.sessionID,
                userID : socket.handshake.userID
            }, function(res) {
            }, function(err) {
            });
        }, 1000 * 60);

        socket.on('requestBattleData', function(params) {
            //各ページにログインしているユーザー数を返す
            waiting.emit('latestinfo', MyApp.stageList.getBattleUserCount());
        });
        socket.on('disconnect', function() {
            console.log("socket disconnect");

            // セッションの更新を停止
            clearInterval(sessionReloadIntervalID);
        });
    });

    //アクセスのないユーザーのセッション情報をDBから削除する
    MyApp.cleanSessionDBIntervalID = setInterval(function() {
        DB.dropSession(function(res) {
        }, function(err) {
        });
    }, 60 * 1000);

    //クライアントと同期する
    var sync = function() {
        MyApp.stageList.sync({
            io : game
        });
    };

    //ゲームメインループ
    var update = function() {
        MyApp.stageList.update();
    };

    //初期化
    ( function() {
        //ゲームメインループの開始
        setInterval(function() {
            update();
            sync();
        }, 1000.0 / MyApp.FPS);
    }());
};
