'use strict';
var Config = Config || {};
var MyApp = {
    windowManeger : {},
    scale : 20,
    mapWidth : 0,
    mapHeight : 0,
    mapData : CliantMap(),
    playerDataList : PlayerList(),
    weaponDataList : WeaponList(),
    enemyDataList : EnemyList(),
    ownData : Player(),
    canvasObject : null,
    ownPosition : {
        x : 25,
        y : 25
    },
    ownUserID : -1,
    isEndInitialize : false
};

/**
 * Canvasなどのビューを管理する
 * @param {object} spec プロパティオブジェクト
 * @param {Number} spec.canvasWidth canvasの幅
 * @param {Number} spec.canvasHeight canvasの高さ
 */
var WindowManeger = function(spec) {
    var that = {};
    var my = {};

    my.canvasWidth = spec.canvasWidth;
    my.canvasHeight = spec.canvasHeight;

    that.getOffset = function(centerX, centerY, scale) {
        return {
            x : centerX * scale - my.canvasWidth / 2,
            y : centerY * scale - my.canvasHeight / 2
        };
    };

    return that;
};

var connection = io.connect("/game");

connection.on('connect', function() {
    console.log("cliant-connect");
    //初期化終了を伝える
    //Configは{mode:quest}/{mode:battle,battleMapID:*}/undefinedがexpressの変数展開によってindex.ejsに埋め込まれている。
    connection.emit("client-endinit", Config);
});

connection.on('disconnect', function() {
    console.log("cliant-disconnect");
});
// connection.on('sendStageInfo',function(data){
// data= data||{};
// console.log(data);
// });
//初期化情報をサーバから受信する
connection.on('initialize', function(data) {
    console.log('initialize');
    //自身のユーザーID取得
    MyApp.ownUserID = data.ownUserID;

    //マップデータ初期化
    MyApp.mapData.init({
        width : data.width,
        height : data.height
    });
    MyApp.mapData.setMapData(data.mapData);

    MyApp.playerDataList = PlayerList();
    MyApp.playerDataList.importDiff(data.playerList);
    //ウィンドウマネージャー初期化
    MyApp.windowManeger = WindowManeger({
        scale : MyApp.scale,
        canvasWidth : MyApp.canvasObject.width,
        canvasHeight : MyApp.canvasObject.height
    });
    MyApp.isEndInitialize = true;

    MyApp.weaponDataList = WeaponList();
    MyApp.enemyDataList = EnemyList();

});

connection.on('sync', function(data) {
    if (!MyApp.isEndInitialize) {
        return;
    }

    MyApp.mapData.importDiff(data.mapData);
    MyApp.playerDataList.importDiff(data.playerList);
    MyApp.weaponDataList.importDiff(data.weaponList);
    MyApp.enemyDataList.importDiff(data.enemyList);
    //自身の位置をセットする
    MyApp.ownData = MyApp.playerDataList.get(MyApp.ownUserID);
    MyApp.ownPosition = MyApp.ownData.position;

    //描写する
    draw();
});

//チャットメッセージを受け取った時
connection.on('chatMessage', function(data) {
    console.dir(data);
    chatWindow.addLog(data);
});

var ctx;
var draw = function() {

    //自身の位置を中心にする
    var offset = MyApp.windowManeger.getOffset(MyApp.ownPosition.x, MyApp.ownPosition.y, MyApp.scale);

    //マップの描写を行う
    MyApp.mapData.draw(ctx, offset, MyApp.scale);

    //敵の描写を行う
    var enemyList = MyApp.enemyDataList.getObjectList();
    for (var i in enemyList) {
        if (enemyList.hasOwnProperty(i)) {
            shader.enemyShader.draw(ctx, offset, MyApp.scale, enemyList[i]);
        }
    }

    //弾の描写を行う
    var weaponList = MyApp.weaponDataList.getObjectList();
    for (var i in weaponList) {
        if (weaponList.hasOwnProperty(i)) {
            shader.weaponShader.draw(ctx, offset, MyApp.scale, weaponList[i]);
        }
    }

    //プレイヤーの描写を行う
    var playerList = MyApp.playerDataList.getObjectList();
    for (var i in playerList) {
        if (playerList.hasOwnProperty(i)) {
            shader.playerShader.draw(ctx, offset, MyApp.scale, playerList[i]);
        }
    }

    //ステータスの描写を行う
    shader.windowShader.draw(ctx, MyApp.scale, {
        playerData : MyApp.ownData
    });
};

var sendChatMessage = function(message) {
    connection.emit('chatMessage', message);
};

//初期化処理
$(function() {
    MyApp.canvasObject = $("#main-canvas")[0];
    MyApp.canvasObject.focus();
    
    //ブラウザの高さを取得                                                                                                                                                                                  
    function getBrowserHeight(){
        if(window.innerHeight){
            return window.innerHeight;
        }else if(document.documentElement && document.documentElement.clientHeight != 0 ){
            return document.documentElement.clientHeight;
        }else if(document.body){
            return document.body.clientHeight;
        }
        return 0;
    }
    //ブラウザの幅を取得                                                                                                                                                                                    
    function getBrowserWidth(){
        if(window.innerWidth){
            return window.innerWidth;
        }else if(document.documentElement && document.documentElement.clientWidth != 0 ){
            return document.documentElement.clientWidth;
        }else if(document.body){
            return document.body.clientWidth;
        }
        return 0;
    }
    $("#main-canvas")[0].height = getBrowserHeight()*2/3;
    $("#main-canvas")[0].width = getBrowserWidth()*7/10;
    $("#rightArea").css('height',getBrowserHeight()*560/800);
    $("#logArea").css('height',getBrowserHeight()*440/800);
    $("#logArea").css('width',getBrowserWidth()*2/10);

//$('body').height(parseInt($(window).height()*0.95,10));    

    var pushudKey = 0;
    $(window).keydown(function(e) {
        //left:37 up:38 right:39 down:40 space:32
        var code = e.keyCode;
        console.log(code);

        if (code === 37) {
            pushudKey |= 8;
        }
        else if (code === 38) {
            pushudKey |= 2;
        }
        else if (code === 39) {
            pushudKey |= 4;
        }
        else if (code === 40) {
            pushudKey |= 1;
        }
        else if (code === 32) {
            pushudKey |= 16;
        }

        if (37 <= code && code <= 40 || code == 32) {
            // connection.emit("keydown", pushudKey);
            return true;
        }

        return true;
    });
    $(window).keyup(function(e) {
        //left:37 up:38 right:39 down:40 space:32
        var code = e.keyCode;
        console.log("keyup" + code);
        if (code === 37) {
            pushudKey &= 23;
        }
        else if (code === 38) {
            pushudKey &= 29;
        }
        else if (code === 39) {
            pushudKey &= 27;
        }
        else if (code === 40) {
            pushudKey &= 30;
        }
        else if (code === 32) {
            pushudKey &= 15;
        }
        else if(code ===90){
            //SOS
            connection.emit("keydown", 90);
        }
        else if(code===88){
            //restart
            connection.emit("keydown", 88);
        }
        return true;
    });
    
    $("#chatPostButton").click(function(){
        var message = $("#chatInputBox").attr('value').replace('\n', '').replace('\r', '');
        if (message && message.length > 0) {
           sendChatMessage(message);
           $("#chatInputBox").attr('value', '');
        }
    })

    $("#chatInputBox").bind("keydown", function(e) {
        var code = (e.keyCode ? e.keyCode : e.which);
        if (code == 13) {
            var message = $(this).attr('value').replace('\n', '').replace('\r', '');
            if (message && message.length > 0) {
                sendChatMessage(message);
                $("#chatInputBox").attr('value', '');
            }
        }
    });

    MyApp.canvasObject.focus();
    var windowHeight = $(window).height();
    //TODO:汚い
    var mainHeight = $("#gameArea").height();
    //MyApp.canvasObject.height = mainHeight;
    //MyApp.canvasObject.width = 1000;

    ctx = MyApp.canvasObject.getContext("2d");

    setInterval(function() {
        if (pushudKey > 0) {
            connection.emit("keydown", pushudKey);
        }
    }, 100);
});

//とりあえず
var chatWindow = {
    makeLogHtml : function(postData) {
        return "".Format('<p><span class="logName">{0}</span><span class="logMessage">{1}</span><span style="float:right;"><span class="logDate">{2}</span></span></p>', postData.userID, postData.message, moment(postData.postDate).format("YY/MM/DD HH:MM"));
    },
    addLog : function(postData) {
        var html = chatWindow.makeLogHtml(postData);

        $('div#logArea').append(html);
        $("#logArea").scrollTop($("#logArea")[0].scrollHeight);
    },
    makeMenbersAreaLineHtml : function(menberData) {
        return "".Format('<p class = "membername" data-name="{0}"><span class="menberAreaName">{1}</span></p>', menberData.userID, menberData.name);
    },
    addMember : function(member) {
        var html = chatWindow.makeMenbersAreaLineHtml(member);
        if ($("".Format('div#menbersArea p[data-name="{0}"]', member.userID)).length == 0) {
            $("div#menbersArea").append(html);
        }
    },
    deleteMember : function(member) {
        $("".Format('div#menbersArea p[data-name="{0}"]', member.userID)).remove();
    },
    clearMamber : function() {
        $("div#menbersArea p.membername").remove();
    }
};

