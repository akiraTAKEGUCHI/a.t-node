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

//初期化処理
$(function() {
    MyApp.canvasObject = $("#main-canvas")[0];
    MyApp.canvasObject.focus();
    
    var pushudKey = 0;
	
	//touchmoveイベントなどの初期化を行う関数                                                                                                                                                               
    //スクロールによる画面外の表示などを防ぐ                                                                                                                                                                
    function stopDefault(event) {
        if (event.touches[0].target.tagName.toLowerCase() == "li") {return;}
        if (event.touches[0].target.tagName.toLowerCase() == "input") {return;}
        event.preventDefault();
    }
    // タッチイベントの初期化                                                                                                                                                                               
    document.addEventListener("touchstart", stopDefault, false);
    document.addEventListener("touchmove", stopDefault, false);
    document.addEventListener("touchend", stopDefault, false);
    // ジェスチャーイベントの初期化                                                                                                                                                                         
    document.addEventListener("gesturestart", stopDefault, false);
    document.addEventListener("gesturechange", stopDefault, false);
    document.addEventListener("gestureend", stopDefault, false);
	
	//SmartPhone向けタッチイベント登録                                                                                                                                                                      
    document.addEventListener("touchstart", touchHandler, false);
    document.addEventListener("touchend", touchHandler, false);
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

    $("#main-canvas")[0].width = getBrowserWidth();
    $("#main-canvas")[0].height = getBrowserHeight()*7/8;

    function touchHandler(e){
    	if(e.type == "touchend"){
			pushudKey = -1;
		} else if(event.touches[0].pageY<=getBrowserHeight()*7/8){
            if((event.touches[0].pageX>getBrowserWidth()*4/5) || (event.touches[0].pageX<getBrowserWidth()*1/5)){
                if(event.touches[0].pageX>getBrowserWidth()*3/5){
                	//右
                    pushudKey = 4;
                }else if(event.touches[0].pageX<getBrowserWidth()*3/5){
                	//左
                    pushudKey =  8;
                }
            }else if(event.touches[0].pageY>getBrowserHeight()*4/8){
            	//下
                pushudKey = 1;
            }else if(event.touches[0].pageY<getBrowserHeight()*4/8){
            	//上
                pushudKey = 2;
            }
        }
    }
    
    // retryボタンのサイズ設定                                                                                                                                                                              
    $("#retry_button")[0].style.width = (getBrowserWidth()*90/300) + "px";
    $("#retry_button")[0].style.height = getBrowserHeight()*1/8 + "px";
    // retryボタンの動作                                                                                                                                                                                    
    $("#retry_button").click(function () {
        connection.emit("keydown", 88);
    });
    
    // sosボタンのサイズ設定                                                                                                                                                                              
    $("#sos_button")[0].style.width = (getBrowserWidth()*90/300) + "px";
    $("#sos_button")[0].style.height = getBrowserHeight()*1/8 + "px";
    // sosボタンの動作                                                                                                                                                                                    
    $("#sos_button").click(function () {
        connection.emit("keydown", 90);
    });
    
    // shootボタンのサイズ設定                                                                                                                                                                              
    $("#shoot_button")[0].style.width = (getBrowserWidth()*90/300) + "px";
    $("#shoot_button")[0].style.height = getBrowserHeight()*1/8 + "px";
    // shootボタンの動作                                                                                                                                                                                    
    $("#shoot_button").click(function () {
        pushudKey = 16;
    });
    
    ctx = MyApp.canvasObject.getContext("2d");
    
    setInterval(function() {
        if (pushudKey > 0) {
            connection.emit("keydown", pushudKey);
        }
    }, 100);
});
