"use strict";
var Map = require('../public/javascripts/map.js').Map
  , ObjectBase = require('../public/javascripts/gameObject.js')
  , Player = ObjectBase.Player
  , PlayerList = ObjectBase.PlayerList
  , Crystal = ObjectBase.Crystal
  , util = require("util")
  , Weapon = ObjectBase.Weapon
  , GameObjectList = ObjectBase.GameObjectList
  , WeaponList = ObjectBase.WeaponList
  , Enemy = ObjectBase.Enemy
  , EnemyList = ObjectBase.EnemyList
  , MyUtil = require("../public/javascripts/lib/util.js").MyUtil
  , ActionClass = require("./action.js")
  , Action = ActionClass.Action
  , ActionQueue = ActionClass.ActionQueue;

var app = require("../app.js");
var DB = app.DB;
var MyApp = app.MyApp;

/**
 * 各階層を表すクラス <br>
 * ゲームメインループから呼び出されるupdateとsyncを持つ
 * @param {object} spec
 * @param {Map} spce.mapData 使用されるMap型のマップデータ
 */
var Stage = function(spec) {
    spec = spec || {};
    var that = {};
    var my = {};

    //DBから復帰時はmapID,mapData,playerList,weaponListは復元する
    my.mapID = spec.mapID || 0;
    my.layer = spec.layer || 1;

    //update->syncの順番で。
    my.isUpdateEnd = false;

    //ユーザーがこのステージを出た時に実行するコールバック関数
    my.onPlayerGoNextStage = spec.onPlayerGoNextStage ||
    function(params) {
        util.log("called onPlayerLeave");
    };

    my.onPlayerChangeLayer = spec.onPlayerChangeLayer ||
    function(player, nextLayer) {
        util.log("called onPlayerChangeLayer");
    };

    //引数でmapデータを受け取る
    my.mapData = spec.mapData;
    my.playerList = spec.playerList || PlayerList();
    my.weaponList = spec.weaponList || WeaponList();
    my.enemyList = spec.enemyList || EnemyList();

    my.prevMapData = {};
    my.prevPlayerList = {};
    my.prevWeaponList = {};
    my.prevEnemyList = {};

    my.playerActionQueue = ActionQueue();
    my.enemyActionQueue = ActionQueue();

    //一意な値(mapID)を返す
    that.getID = function() {
        return my.mapID;
    };
    that.getPlayerList = function() {
        return my.playerList;
    };
    that.getLayer = function() {
        return my.layer;
    };
    that.getMapID = function() {
        return my.mapID;
    };
    /**
     * この階層の状態・存在するオブジェクト・プレイヤーの状態を更新する
     */
    that.update = function(params) {
        //console.log("called update " + my.mapID);
        my.isUpdateEnd = false;

        that.dealingActionQueue();
        that.dealingEnemyActionQueue();

        that.updateWeaponsStatus();

        //敵をランダムに追加
        that.updateEnemyStatus();

        that.updatePlayersStatus();

        that.setCrystalRandomly();

        my.isUpdateEnd = true;
    };

    /**
     * 弾の発射Actionの処理を行う
     * @param {Action} Action.type = fireの弾を発射するアクション
     */
    that.dealFireAction = function(elem) {
        //弾の向いている方向はプレイヤーまたは敵の向いている方向とする

        //プレイヤーの発射した弾の時
        var currentPlayer = my.playerList.get(elem.id);

        //ユーザーが生きている状態(stete===0)以外の時は無効にする
        if (currentPlayer.getState() !== 0) {
            return false;
        }

        my.weaponList.add(Weapon({
            position : currentPlayer.position,
            parentID : currentPlayer.getID(),
            front : currentPlayer.getFront()
        }));
    };
    that.dealEnemyFireAction = function(elem) {
        //弾の向いている方向は敵の向いている方向とする
        var currentEnemy = my.enemyList.get(elem.id);

        //弾の発射位置は敵の中心とする
        var weaponPos = {
            x : parseInt(currentEnemy.position.x + currentEnemy.getSize() / 2, 10),
            y : parseInt(currentEnemy.position.y + currentEnemy.getSize() / 2, 10)
        };
        my.weaponList.add(Weapon({
            position : weaponPos,
            parentID : currentEnemy.getID(),
            front : currentEnemy.getFront()
        }));
    };
    that.dealBladeAction = function(elem) {
        var currentPlayer = my.playerList.get(elem.id);
        var currentPosition = currentPlayer.getPosition();
        var currentFront = currentPlayer.getFront();

        //前方3*2
        for (var i = -1; i < 2; i++) {
            for (var j = 1; j < 3; j++) {
                //壁・プレイヤーとの当たり判定を取る
                var checkPosition;
                if (Math.abs(currentFront.x) > Math.abs(currentFront.y)) {
                    checkPosition = {
                        x : currentPosition.x + j * currentFront.x,
                        y : currentPosition.y + i
                    };
                }
                else {
                    checkPosition = {
                        x : currentPosition.x + i,
                        y : currentPosition.y + j * currentFront.y
                    };
                }
                var mayBeCollidePlayer = my.playerList.getByPosition(checkPosition);
                var mayBeCollideEnemy = my.enemyList.getByPosition(checkPosition);

                //プレイヤーと衝突した時
                if (mayBeCollidePlayer !== null) {
                    //プレイヤーのHPを減らす
                    mayBeCollidePlayer.decreaseHP(1);
                }
                //敵と衝突した時
                else if (mayBeCollideEnemy !== null) {
                    //プレイヤーのHPを減らす
                    mayBeCollideEnemy.decreaseHP(1);
                }
            }
        }
    };
    /**
     * 移動Actionの処理を行う
     * @param {Action} Action.type = moveのプレイヤーを動作させるアクション
     */
    that.dealPlayerMoveAction = function(elem) {
        var mapData = my.mapData.getMapData();
        var currentGameObject, newPos;

        //プレイヤーの時
        currentGameObject = my.playerList.get(elem.id);
        newPos = {
            x : currentGameObject.position.x + elem.value.moveVector.x,
            y : currentGameObject.position.y + elem.value.moveVector.y
        };

        //ユーザーが生きている状態(stete===0)以外の時は無効にする
        if (currentGameObject.getState() !== 0) {
            return false;
        }

        var newPosObjType = -1;
        if ( typeof mapData[newPos.x] !== 'undefined') {
            newPosObjType = mapData[newPos.x][newPos.y];
        }

        //移動先が壁・プレイヤー・マップ外の時は移動不可
        var mayBeCollidPlayer = my.playerList.getByPosition(newPos);

        //衝突先のプレイヤーがSOS中の時はそのユーザーを生き返らせる
        if (mayBeCollidPlayer !== null && mayBeCollidPlayer.getState() === 2) {
            console.log("collid resporn");
            mayBeCollidPlayer.resporn({
                x : mayBeCollidPlayer.position.x,
                y : mayBeCollidPlayer.position.y
            });
        }

        if (newPos.x >= 0 && newPos.y > 0 && typeof newPosObjType !== 'undefiend' && newPosObjType !== my.mapData.objectTypeID.wall && mayBeCollidPlayer === null) {
            //フィールド情報書き換え　古い位置はNONEに、新しい位置はプレイヤーに
            my.mapData.setMapObject(currentGameObject.position.x, currentGameObject.position.y, my.mapData.objectTypeID.none);

            //プレイヤー情報書き換え
            currentGameObject.move(elem.value.moveVector.x, elem.value.moveVector.y);
            return true;
        }
        return false;
    };
    /**
     * 敵の移動Actionの処理を行う
     * @param {Action} Action.type = moveのプレイヤーを動作させるアクション
     */
    that.dealEnemyMoveAction = function(elem) {
        //console.log("dealEnemyMoveAction");
        var mapData = my.mapData.getMapData();
        var currentGameObject;

        currentGameObject = my.enemyList.getByUserID(elem.id);
        elem.value.moveVector.x = parseInt(elem.value.moveVector.x, 10);
        elem.value.moveVector.y = parseInt(elem.value.moveVector.y, 10);
        var size = currentGameObject.getSize();
        var id = currentGameObject.getID();

        var newPos = {
            x : currentGameObject.position.x + elem.value.moveVector.x,
            y : currentGameObject.position.y + elem.value.moveVector.y
        };
        var newPosObjType = -1;
        if ( typeof mapData[newPos.x] !== 'undefined') {
            newPosObjType = mapData[newPos.x][newPos.y];
        }
        //移動先が壁・プレイヤー・マップ外の時は移動不可
        if (!((newPosObjType === my.mapData.objectTypeID.none || newPosObjType === my.mapData.objectTypeID.enemy) && my.playerList.getByPosition(newPos, id) === null && my.enemyList.getByPosition(newPos, id) === null)) {
            return false;
        }
        var newPos1 = {
            x : newPos.x + size - 1,
            y : newPos.y
        };
        if (!((mapData[newPos1.x][newPos1.y] === my.mapData.objectTypeID.none || mapData[newPos1.x][newPos1.y] === my.mapData.objectTypeID.enemy) && my.playerList.getByPosition(newPos1, id) === null && my.enemyList.getByPosition(newPos1, id) === null)) {
            return false;
        }

        var newPos2 = {
            x : newPos.x,
            y : newPos.y + size - 1
        };
        if (!((mapData[newPos2.x][newPos2.y] === my.mapData.objectTypeID.none || mapData[newPos2.x][newPos2.y] === my.mapData.objectTypeID.enemy) && my.playerList.getByPosition(newPos2, id) === null && my.enemyList.getByPosition(newPos2, id) === null)) {
            return false;
        }

        var newPos3 = {
            x : newPos.x + size - 1,
            y : newPos.y + size - 1
        };
        if (!((mapData[newPos3.x][newPos3.y] === my.mapData.objectTypeID.none || mapData[newPos3.x][newPos3.y] === my.mapData.objectTypeID.enemy) && my.playerList.getByPosition(newPos3, id) === null && my.enemyList.getByPosition(newPos3, id) === null)) {
            return false;
        }

        //フィールド情報書き換え　古い位置はNONEに、新しい位置はプレイヤーに
        for (var i = 0; i < size; i++) {
            for (var j = 0; j < size; j++) {
                my.mapData.setMapObject(currentGameObject.position.x + i, currentGameObject.position.y + j, my.mapData.objectTypeID.none);
                my.mapData.setMapObject(newPos.x + i, newPos.y + j, my.mapData.objectTypeID.enemy);
            }
        }
        currentGameObject.move(elem.value.moveVector.x, elem.value.moveVector.y);
        return true;
    };
    //アクションキューの内容を先頭から消化していく
    that.dealingActionQueue = function() {
        //プレイヤーの行動キューの内容を先頭から順に処理していく
        var currentQueue = my.playerActionQueue.dequeueAll();
        currentQueue.forEach(function(elem) {
            //移動行動の時
            if (elem.actionType === Action.actionTypeID.move) {
                that.dealPlayerMoveAction(elem);
            }
            //射撃の時
            else if (elem.actionType === Action.actionTypeID.fire) {
                that.dealFireAction(elem);
            }
            //刀攻撃の時
            else if (elem.actionType === Action.actionTypeID.blade) {
                that.dealBladeAction(elem);
            }
        });
    };

    //敵のアクションキューの内容を先頭から処理していく
    that.dealingEnemyActionQueue = function() {
        //敵の行動キューの内容を先頭から順に処理していく
        var currentQueue = my.enemyActionQueue.dequeueAll();
        currentQueue.forEach(function(elem) {
            //移動行動の時
            if (elem.actionType === Action.actionTypeID.move) {
                that.dealEnemyMoveAction(elem);
            }
            //射撃の時
            else if (elem.actionType === Action.actionTypeID.fire) {
                that.dealEnemyFireAction(elem);
            }
        });
    };

    //銃の弾の移動を行う
    that.updateWeaponsStatus = function() {
        var weaponList = my.weaponList.getObjectList();
        var mapData = my.mapData.getMapData();
        for (var i in weaponList) {
            if (weaponList.hasOwnProperty(i)) {
                var currentWeapon = weaponList[i];

                //スピードに応じて、1回の呼び出しで複数フレームの移動を行う
                for (var j = 0; j < currentWeapon.getSpeed() && currentWeapon.getEnable(); j++) {
                    var newPos = {
                        x : currentWeapon.position.x + currentWeapon.getFront().x,
                        y : currentWeapon.position.y + currentWeapon.getFront().y
                    };
                    //壁と衝突する時
                    if ( typeof mapData[newPos.x] === 'undefined' || mapData[newPos.x][newPos.y] == my.mapData.objectTypeID.wall) {
                        //自身を無効にする
                        currentWeapon.setEnable(false);
                        break;
                    }

                    //敵とプレイヤーで分ける
                    //TODO:適当すぎる
                    var currentPlayer;
                    if (currentWeapon.getParentID() < 0) {
                        //敵の時
                        currentPlayer = my.enemyList.get(currentWeapon.getParentID());
                    }
                    else {
                        //プレイヤーの時
                        currentPlayer = my.playerList.get(currentWeapon.getParentID());
                    }

                    //壁・プレイヤーとの当たり判定を取る
                    var mayBeCollidePlayer = my.playerList.getByPosition(newPos);
                    var mayBeCollideEnemy = my.enemyList.getByPosition(newPos);
                    var weaponParentID = currentWeapon.getParentID();

                    //プレイヤーと衝突した時
                    if (mayBeCollidePlayer !== null && mayBeCollidePlayer.getID() !== weaponParentID) {
                        //プレイヤーのHPを減らす
                        mayBeCollidePlayer.decreaseHP(1);
                        if (!mayBeCollidePlayer.getIsMatchless()) {
                            mayBeCollidePlayer.setMatchless();
                        }
                        //自身を無効にする
                        currentWeapon.setEnable(false);

                        break;
                    }
                    //敵と衝突した時
                    //敵同士の相打ちはなしにする
                    else if (mayBeCollideEnemy !== null && mayBeCollideEnemy.getID() !== weaponParentID && my.enemyList.get(weaponParentID) === null) {
                        //プレイヤーのHPを減らす
                        mayBeCollideEnemy.decreaseHP(1);
                        //自身を無効にする
                        currentWeapon.setEnable(false);

                        break;
                    }

                    //向いている方向に1マス移動する
                    currentWeapon.move(currentWeapon.getFront().x, currentWeapon.getFront().y);
                }
            }
        }
        //ebable = falseのものを削除する
        my.weaponList.creanup();
        my.enemyList.creanup();
        my.playerList.creanup();
    };

    /**
     * 瀕死の状態になったとき
     */
    that.onPlayerPreDead = function() {

    };

    that.onPlayerDead = function() {

    };

    //各プレイヤーの状態を更新する(現在位置でのアクションを起こす(トラップ・クリスタル取得), HP・クリスタル数などの残量に応じた処理を行う)
    that.updatePlayersStatus = function() {
        var playerList = my.playerList.getObjectList();
        var mapData = my.mapData.getMapData();
        for (var i in playerList) {
            if (playerList.hasOwnProperty(i) && playerList[i].getEnable()) {
                var currentPlayer = playerList[i];
                var playerPos = currentPlayer.getPosition();

                var newPosObjType = -1;
                if ( typeof mapData[playerPos.x] !== 'undefined') {
                    newPosObjType = mapData[playerPos.x][playerPos.y];
                }

                //TODO:死んだ時の処理もオーバーライド出来るようにメソッドにするか、関数オブジェクト呼び出しにするか
                //プレイヤーのHPが0かつ瀕死状態でなければバラまきつランダムリスポーン
                var currentMapView = my.mapData.getMapData();
                if (playerList[i].getHP() <= 0 && playerList[i].getState() === 0) {
                    //瀕死状態とする
                    playerList[i].setState(1);

                    //瀕死状態になった時刻を設定
                    playerList[i].setPreDeadTime(new Date().getTime());
                }
                //SOS失敗orリトライボタンを押した時
                else if (playerList[i].getState() === 3) {
                    console.log('stete ==3');
                    //とりあえず8個くらいばらまく
                    playerList[i].decreaseCrystalCount(8);
                    for (var x = 0; x < 3; x++) {
                        for (var y = 0; y < 3; y++) {
                            if ( typeof currentMapView[playerPos.x + x] !== 'undefined' && currentMapView[playerPos.x+x][playerPos.y + y] === my.mapData.objectTypeID.none) {
                                my.mapData.setMapObject(playerPos.x + x, playerPos.y + y, my.mapData.objectTypeID.crystal);
                            }
                        }
                    }
                    //リスポーンさせる
                    //TODO:何かしらのメソッドが必要
                    my.mapData.setMapObject(playerPos.x, playerPos.y, my.mapData.objectTypeID.none);
                    currentPlayer.resporn(my.mapData.getNonePositionRandomly());

                    my.onPlayerChangeLayer(currentPlayer, 1);
                }
                else {
                    //プレイヤーがいる位置のオブジェクトの効果を適用する
                    //クリスタル
                    if (newPosObjType === my.mapData.objectTypeID.crystal) {
                        //プレイヤーのクリスタル所持数を増やす
                        playerList[i].increaseCrystalCount(1);
                        
                        //プレイヤーのHPを回復する
                        playerList[i].increaseHP(1);
                        
                        //クリスタルをフィールドから削除する
                        my.mapData.setMapObject(playerPos.x, playerPos.y, my.mapData.objectTypeID.none);
                    }

                    //敵と接触したらダメージ
                    if (my.enemyList.getByPosition(playerPos) !== null) {
                        currentPlayer.decreaseHP();
                        if (!currentPlayer.getIsMatchless()) {
                            currentPlayer.setMatchless();
                        }
                    }

                    //階段だったらクリア
                    if (newPosObjType === my.mapData.objectTypeID.stairs) {
                        console.log("reach stairs");
                        my.onPlayerGoNextStage(playerList[i]);
                    }

                    //フィールド情報書き換え 新しい位置はプレイヤーに
                    my.mapData.setMapObject(playerPos.x, playerPos.y, my.mapData.objectTypeID.player);
                }

                //プレイヤーの内部状態を更新
                currentPlayer.update();
            }
        }
    };

    that.setCrystalRandomly = function() {
        //とりあえずアイテムやクリスタルをランダムでフィールドに配置する
        var currentSetedCount = my.mapData.getCurrentCrystalCount();
        if (Math.random() < 0.1 && currentSetedCount < MyApp.maxCrystalCount) {
            var setPosition = my.mapData.getNonePositionRandomly();
            my.mapData.setMapObject(setPosition.x, setPosition.y, my.mapData.objectTypeID.crystal);
        }
    };

    /**
     * 敵のアクションを起こす <br>
     * 敵をランダムに追加する
     */
    that.updateEnemyStatus = function() {
        var random = parseInt(Math.random() * 100, 10);
        var mapData = my.mapData.getMapData();

        //敵をランダムで追加する
        if (random % 15 === 0 && my.enemyList.getCount() < MyApp.maxEnemyCount) {
            var enemy = Enemy();
            enemy.setPosition(my.mapData.getNonePositionRandomly(enemy.getSize()));
            my.enemyList.add(enemy);

            //フィールド情報書き換え　古い位置はNONEに、新しい位置はプレイヤーに
            var size = enemy.getSize();
            var enemyPos = enemy.getPosition();
            for (var i = 0; i < size; i++) {
                for (var j = 0; j < size; j++) {
                    my.mapData.setMapObject(enemyPos.x + i, enemyPos.y + j, my.mapData.objectTypeID.enemy);
                }
            }

        }

        var enemyList = my.enemyList.getObjectList();
        for (var i in enemyList) {
            var currentEnemy = enemyList[i];
            //敵が死んだ時
            if (currentEnemy.getHP() <= 0) {
                var enemyPos = currentEnemy.getPosition();
                var size = currentEnemy.getSize();

                //敵を削除する
                currentEnemy.setEnable(false);

                //フィールドデータ更新

                for (var dx = 0; dx < size; dx++) {
                    for (var dy = 0; dy < size; dy++) {
                        my.mapData.setMapObject(currentEnemy.position.x + dx, currentEnemy.position.y + dy, my.mapData.objectTypeID.none);
                    }
                }

            }

            if (enemyList.hasOwnProperty(i)) {
                //敵の行動をランダムに決定する
                var action = enemyList[i].generateNextAction();
                if (action !== null) {
                    //行動キューに加える
                    that.addEnemyActionQueue(action);
                }
            }
        }
    };

    /**
     * 各オブジェクトの状態をクライアントに送信して同期する
     */

    that.sync = function(config) {
        if (!my.isUpdateEnd) {
            util.error("update not ended");
            return false;
        }

        //各プレイヤーに順に送る
        var playerList = my.playerList.getObjectList();
        var cache = {
            mapData : my.mapData.generateSendData({
                prevData : my.prevMapData
            }),
            playerList : my.playerList.generateSendData({
                prevData : my.prevPlayerList
            }),
            weaponList : my.weaponList.generateSendData({
                prevData : my.prevWeaponList
            }),
            enemyList : my.enemyList.generateSendData({
                prevData : my.prevEnemyList
            })
        };

        var count = 0;
        var socketIDArray = my.playerList.getSocketIDArray();
        var length = socketIDArray.length;
        var i=0;
        function processRow() {( function processRows() {
            var currentUser;
                for (var j = 0; i < length && j < 5; ++i, ++j) {// 5件ずつ処理
                    //初期化の送信が必要な場合
                    if ((currentUser=my.playerList.getBySocketID(socketIDArray[i]))&&!currentUser.getIsSendInitData()) {
                        util.log(util.format("send init data:%s", i));
                        config.io.socket(socketIDArray[i]).emit('initialize', {
                            ownUserID : currentUser.getUserID(),
                            mapData : my.mapData.getMapData(),
                            width : my.mapData.getWidth(),
                            height : my.mapData.getHeight(),
                            playerList : my.playerList.generateSendData({
                                prevData : {}
                            })
                        });
                       currentUser.setIsSendInitData(true);
                    }
                    //差分のみの送信の場合
                    else {
                        config.io.socket(socketIDArray[i]).json.volatile.emit('sync', cache);
                    }
                }
                if (i < length) {
                    process.nextTick(processRows);
                }
            }());
        }

        processRow();

        //差分のみを送るので今の状態を保存
        my.prevMapData = my.mapData.getMapDataCopy();
        my.prevPlayerList = my.playerList.getCurrentParameters();
        my.prevWeaponList = my.weaponList.getCurrentParameters();
        my.prevEnemyList = my.enemyList.getCurrentParameters();
    };

    /**
     * このステージに新たなユーザーを追加する
     */
    that.joinUser = function(newUserOption) {
        console.log("joinUser " + newUserOption.mapID);
        newUserOption.position = newUserOption.position || my.mapData.getNonePositions()[parseInt(Math.random() * 2, 10)];
        var mapData = my.mapData.getMapData();
        newUserOption.mapID = my.mapID;

        //プレイヤーの位置が壁の場合(初期化されていない時)は強制的に何もない場所にする
        if ((newUserOption.position.x == 0 && newUserOption.position.y == 0) || typeof mapData[newUserOption.position.x] === 'undefined' || typeof mapData[newUserOption.position.x][newUserOption.position.y] === 'undefined' || mapData[newUserOption.position.x][newUserOption.position.y] !== my.mapData.objectTypeID.none) {
            newUserOption.position = my.mapData.getNonePositions()[parseInt(Math.random() * 2, 10)];
        }

        //最初は初期化データを送信する
        newUserOption.isSendInitData = false;

        //既にuserIDが登録済みの時(タブを2つ開いた時など)そのユーザーのsessionID,socketIDのみを更新する
        var aleadyLogginedUser = my.playerList.getByUserID(newUserOption.userID);
        util.debug(util.format('add new user(%s %s %s) to %s', newUserOption.userID, newUserOption.expressSessionID, newUserOption.socketID, my.mapID));
        my.playerList.add(Player(newUserOption), true);
        my.mapData.setMapObject(newUserOption.position.x, newUserOption.position.y, my.mapData.objectTypeID.player);
    };

    my.requestSOS = function(userID, io) {
        var currentPlayer = my.playerList.get(userID);
        var success = my.playerList.get(userID).setSOS();
        if (success) {
            that.onChatMessage({
                userID : userID,
                io : io,
                message : util.format("SOS!! 地下%s階 x:%s y:%s", currentPlayer.getLayer(), currentPlayer.position.x, currentPlayer.position.y),
                postDate : new Date().getTime(),
            });
        }
    };
    my.requestRetry = function(userID) {
        my.playerList.get(userID).setGameEnd();
    };

    /**
     *
     * @param {Object} params
     * @param {Object} params.code
     * @param {Object} params.userID
     * @param {Object} params.io
     */
    that.onKeyDown = function(params) {
        //left:37 up:38 right:39 down:40 space:32
        var userID = params.userID;
        var code = params.code;
        var action = null;

        if (!my.playerList.hasObject(userID, params.io)) {
            util.error(util.format("error keydown:plaerList has not userID: %s", userID));
            return;
        }

        //Zキー(SOSボタンが押された時)
        if (code === 90) {
            console.log('z　is pushed');
            my.requestSOS(userID, params.io);
            return;
        }
        //Xキー(リトライボタンが押された時)
        if (code === 88) {
            console.log('x　is pushed');
            my.requestRetry(userID, params.io);
            return;
        }

        //矢印キーが入力された時
        if (0 <= code && code < 32) {
            var moveVector = {
                x : 0,
                y : 0
            };
            if ((code >> 3) % 2 === 1) {
                moveVector.x += (-1);
            }
            else if ((code >> 2) % 2 === 1) {
                moveVector.x += 1;
            }

            if ((code >> 1) % 2 === 1) {
                moveVector.y += (-1);
            }
            else if (code % 2 === 1) {
                moveVector.y += 1;
            }
            action = Action({
                id : userID,
                actionType : Action.actionTypeID.move,
                value : {
                    moveVector : moveVector
                }
            });
            //行動キューに加える
            if (action !== null) {
                that.addActionQueue(action);
            }
        }
        //スペースキーが押された時
        if ((code >> 4) % 2 === 1) {
            //攻撃アクション
            action = Action({
                id : userID,
                actionType : Action.actionTypeID.fire,
                value : {
                    parentID : userID
                }
            });
            //行動キューに加える
            if (action !== null) {
                that.addActionQueue(action);
            }
        }
        //zキーが押された時
        else if (code === 90) {
            //刀アクション
            action = Action({
                id : userID,
                actionType : Action.actionTypeID.blade,
                value : {
                    parentID : userID
                }
            });
            //行動キューに加える
            if (action !== null) {
                that.addActionQueue(action);
            }
        }
    };

    /**
     * チャットメッセージを受信した時
     * @param {Object} params.userID
     * @param {Object} params.message
     * @param {Object} params.io
     */
    that.onChatMessage = function(params) {
        util.debug('onChatMessage');
        //同じ階層の人にメッセージを送信する
        var playerList = my.playerList.getObjectList();
        for (var i in playerList) {
            if (playerList.hasOwnProperty(i)) {
                //チャットメッセージを同じ階層の人にメッセージを配信する
                params.io.socket(playerList[i].getSocketID()).emit('chatMessage', {
                    userID : i,
                    message : String.prototype.escapeHtml(params.message),
                });
            }
        }
    };
    that.onDisconnect = function(params) {
        util.debug("disconnect");
        that.leaveUser(params.userID);
    };
    that.leaveUser = function(userID) {
        var leaveUser = my.playerList.get(userID);
        if (leaveUser !== null) {
            leaveUser.setEnable(false);
            my.mapData.setMapObject(leaveUser.position.x, leaveUser.position.y, my.mapData.objectTypeID.none);
        }
    };

    that.getUserCount = function() {
        return my.playerList.getCount();
    };

    /**
     * プレイヤーの行動キューに加える
     */
    that.addActionQueue = function(action) {
        my.playerActionQueue.enqueue(action);
    };
    /*
     * 敵の行動キューに加える
     */
    that.addEnemyActionQueue = function(action) {
        my.enemyActionQueue.enqueue(action);
    };

    /**
     * クライアントに定期的にこのステージの情報を送る時のデータを作成
     */
    that.generateStageInfoData = function() {
        var data = {};

        //ログイン中の同じステージのユーザーID一覧
        data.users = [];
        var playerList = my.playerList.getObjectList();
        for (var i in playerList) {
            if (playerList.hasOwnProperty(i)) {
                data.users.push(i);
            }
        }
        return data;
    };
    return that;
};

var QuestStage = function(spec) {
    var that = Stage(spec);

    //スーパークラスのdealPlayerMoveActionを呼び出せるようにする
    var super_dealPlayerMoveAction = that.superior('dealPlayerMoveAction');

    //クエストステージでは移動のたびにDBに位置情報を保存しておく
    //@Override
    that.dealPlayerMoveAction = function(elem) {
        if (super_dealPlayerMoveAction(elem)) {
            //移動に成功した時のみDBに保存する
            //移動のたびに非同期でDB書き込み
            //TODO:あとでDBクラスにまとめる
            var currentPlayer = that.getPlayerList().get(elem.id);
            DB.UserData.update({
                userID : currentPlayer.getUserID()
            }, {
                $set : {
                    status : {
                        position : {
                            x : currentPlayer.position.x,
                            y : currentPlayer.position.y
                        },
                        mapID : currentPlayer.getMapID(),
                        layer : currentPlayer.getLayer(),
                        hp : currentPlayer.getHP()
                    },
                    lastAccess : Date.now()
                }
            }, {
                upsert : true
            }, function(err) {
                if (err) {
                    util.log(err);
                }
            });
        }
    };
    return that;
};
var BattleStage = function(spec) {
    spec = spec || {};
    var that = Stage(spec);
    return that;
};
var StageList = function(spec) {
    spec = spec || {};
    var that = {};
    var my = {};

    //とりあえずuserIDとMapIDの紐付け用に使う
    my.playerList = PlayerList();

    //マップIDをキーとするオブジェクト
    my.stageList = {};

    /**
     * ユーザーの階層間の移動を行う <br>
     * 人数調整もここで行う
     * @param {Player} player 移動するプレイヤー
     * @param {Object} oldMapID 移動元のMapID (defaults:undefined)
     * @param {Object} nextMapID 移動先のMapID (バトル用<0<クエスト用)
     */
    my.changeUserLayer = function(player, nextLayer) {
        console.log("changeUserLayer");
        //mapID<0:バトル 0<mapID:クエスト
        if (player === null) {
            util.error('player ===null');
            return;
        }
        var isQuest = nextLayer > 0;
        var oldMapID = player.getMapID();
        var oldStage = my.stageList[oldMapID];
        var newUserOption = MyUtil.deepCopy(player.toJSON());
        var nextMapID, nextStage;
        var currentUser = my.playerList.get(player.getID());

        util.debug(util.format("userID:%s oldMapID:%s nextMapID:%s", player.getUserID(), oldMapID, nextMapID));

        //次のステージのインスタンスを取得
        //getJoinableStagesで人数調整も行う
        var joinableNextStages = that.getJoinableStages(nextLayer);

        //参加できるマップが無いときは新規作成
        if (joinableNextStages.length <= 0) {
            nextMapID = that.generateNextMapID(nextLayer);
            my.changeUserStage(player, oldMapID, nextMapID, nextLayer);
        }
        else {
            nextStage = joinableNextStages[0];
            nextMapID = nextStage.getMapID();
            currentUser.setMapID(nextStage.getMapID());
            nextStage.joinUser(newUserOption);
            if ( typeof oldStage !== 'undefined' && oldMapID !== nextMapID) {
                oldStage.leaveUser(player.getID());
            }
        }
        return nextMapID;
    };

    /**
     * MapIDを指定して、ユーザーを別のStageに遷移させる
     * ステージが見作成の時はlayerとMapIDを元に新規作成する
     * @param player {Player} 移動するプレイヤー
     * @param oldMapID {String} 遷移元のMapID(任意)
     * @param nextMapID {String} 遷移先のMapID
     * @param layer {Number} 遷移先の階層
     */
    my.changeUserStage = function(player, oldMapID, nextMapID, layer) {
        console.log("changeUserStage");
        //mapID<0:バトル 0<mapID:クエスト
        var isQuest = nextMapID[0] > 0;
        util.debug(util.format("userID:%s oldMapID:%s nextMapID:%s isQuest:%s", player.getUserID(), oldMapID, nextMapID, isQuest));

        //次のステージのインスタンスを取得
        var oldStage = my.stageList[oldMapID];
        var nextStage = my.stageList[nextMapID];
        player.setMapID(nextMapID);
        var newUserOption = MyUtil.deepCopy(player.toJSON());
        console.log(newUserOption.mapID);

        //次のステージのインスタンスが無いときは新規作成してステージリストに追加する
        if ( typeof nextStage === 'undefined') {
            //次のステージのマップのレイアウトをDBから読み取る
            //DBからmapIDを元にマップデータ検索し、まだ存在しない場合はあらたなレイアウトを作成してDBに保存する
            DB.FieldData.findOne({
                mapID : newUserOption.mapID
            }, function(err, val) {
                var newMapData;
                //DBにレイアウトが存在すればそれを利用、なければ新規作成してDBに保存
                if (val === null || !val.layout) {
                    //DBにまだマップは存在しないので新規作成
                    newMapData = Map().init({
                        width : MyApp.mapWidth,
                        height : MyApp.mapHeight
                    });

                    //バトル用の時は広いマップ,クエスト用の時は狭いマップにする
                    if (isQuest) {
                        //クエスト用
                        newMapData.createMapData(MyApp.mapWidth, MyApp.mapHeight);
                    }
                    else {
                        //バトル用
                        newMapData.init({
                            width : 50,
                            height : 50
                        });
                        newMapData.createBattleMapData(50, 50);
                    }

                    //マップのレイアウトを新規作成したのでDBに保存
                    new DB.FieldData({
                        mapID : newUserOption.mapID,
                        layout : newMapData.exportData()
                    }).save(function(err) {
                        if (err) {
                            util.error(err);
                        }
                    });
                }
                else {
                    console.log(util.format("read　mapdata:%s from db", newUserOption.mapID));
                    newMapData = Map().importData(val.layout);
                }

                //次のステージのインスタンスを生成
                //バトル用とクエスト用で用いるクラスが異なる
                if (isQuest) {
                    nextStage = QuestStage({
                        mapID : newUserOption.mapID.toString(),
                        layer : layer,
                        mapData : newMapData,
                        onPlayerGoNextStage : function(args) {
                            my.goNextStage(args);
                        },
                        onPlayerChangeLayer : function(player, nextLayer) {
                            var currentPlayer = my.playerList.get(player.getID());
                            currentPlayer.setLayer(nextLayer);
                            currentPlayer.setPosition({
                                x : 0,
                                y : 0
                            });
                            my.changeUserLayer(currentPlayer, nextLayer);
                        }
                    });
                }
                else {
                    nextStage = BattleStage({
                        mapID : newUserOption.mapID,
                        layer : layer,
                        mapData : newMapData,
                        onPlayerGoNextStage : function(args) {
                            my.goNextStage(args);
                        },
                        onPlayerChangeLayer : function(player, nextLayer) {
                            var currentPlayer = my.playerList.get(player.getID());
                            currentPlayer.setLayer(nextLayer);
                            currentPlayer.setPosition({
                                x : 0,
                                y : 0
                            });
                            my.changeUserLayer(currentPlayer, nextLayer);
                        }
                    });
                }
                //ステージリストに新規作成したステージのインスタンスを追加
                that.add(nextStage);

                //次のステージにユーザーを移す
                nextStage.joinUser(newUserOption);
                if ( typeof oldStage !== 'undefined' && oldMapID !== nextMapID) {
                    oldStage.leaveUser(player.getID());
                }
            });
        }
        else {
            //次のステージにユーザーを移す
            nextStage.joinUser(newUserOption);
            if ( typeof oldStage !== 'undefined' && oldMapID !== nextMapID) {
                oldStage.leaveUser(player.getID());
            }
        }
    };

    /**
     * プレイヤーがステージを抜けて次のステージへ移る時(条件達成・階段を登って次のステージへ移ったなど)にStageクラスのインスタンスから呼び出されるコールバック関数
     * @param {Player} player 移動するプレイヤーのPlayer型のインスタンス
     */
    my.goNextStage = function(player) {
        console.log("goNextStage");
        if ( typeof player === "undefined") {
            util.error("params is undef");
            return;
        }

        //とりあえず1階層マップを移る
        var nextLayer = player.getLayer() + 1;
        var currentUser = my.playerList.get(player.getID());
        currentUser.setLayer(nextLayer);
        currentUser.setPosition({
            x : 0,
            y : 0
        });

        //次のステージへの移動を行う
        my.changeUserLayer(currentUser, nextLayer);
    };

    /**
     * 一意な値(mapID)をキーにしてステージのインスタンスを取得する
     */
    that.get = function(id) {
        return my.stageList[id];
    };

    /**
     * ステージリストに新たなステージクラスのインスタンスを追加する
     */
    that.add = function(stage) {
        var mapID = stage.getID();
        if ( typeof mapID === 'undefined') {
            util.error("stageID");
            return false;
        }
        if ( mapID in my.stageList) {
            util.error("aleady exists");
            return false;
        }

        my.stageList[mapID] = stage;
    };

    that.getByLayer = function(layer) {
        var result = [];
        for (var i in my.stageList) {
            if (my.stageList.hasOwnProperty(i) && my.stageList[i].getLayer() === layer) {
                result.push(my.stageList[i]);
            }
        }
        return result;
    };
    that.getJoinableStages = function(layer) {
        var result = [];
        for (var i in my.stageList) {
            if (my.stageList.hasOwnProperty(i) && my.stageList[i].getLayer() === layer && my.stageList[i].getUserCount() < MyApp.maxStageUserCount) {
                result.push(my.stageList[i]);
            }
        }
        return result;
    };
    /**
     * 各ステージクラスのupdateを呼び出して各階層に存在するオブジェクトの状態を更新する
     */
    that.update = function(params) {
        for (var i in my.stageList) {
            //ステージにプレイヤーが居ない場合は更新しない
            if (my.stageList.hasOwnProperty(i) && my.stageList[i].getUserCount() > 0) {
                my.stageList[i].update(params);
            }
        }
    };

    /**
     * 各ステージクラスのsyncを呼び出して各階層に存在するオブジェクトの状態をクライアントに同期させる
     */
    that.sync = function(params) {
        for (var i in my.stageList) {
            if (my.stageList.hasOwnProperty(i) && my.stageList[i].getUserCount() > 0) {
                //ステージにプレイヤーが居ない場合は更新しない
                ( function(i, params) {
                    process.nextTick(function() {
                        my.stageList[i].sync(params);
                    });

                }(i, params));
            }
        }
    };

    /**
     * クライアントがゲームへの接続を開始した時
     * @param {Object} params
     * @param {Object} params.sessionID
     * @param {Object} params.userID
     * @param {Object} params.socketID
     * @param {Object} params.socket
     */
    that.onConnection = function(params) {
        console.log('stageList.onConnection');
        var expSID = params.sessionID;
        var userID = params.userID;
        var socketID = params.socketID;

        //DBからユーザーのパラメータを取ってくる
        DB.getUserData(userID, function(userParams) {
            console.log("read user data from DB");
            var userParams = userParams || {
                status : {
                    position : {
                        x : 0,
                        y : 0
                    }
                },
            };

            var newUserOption = {
                userID : userID,
                expressSessionID : expSID,
                socketID : socketID,
                name : userID,
                position : {
                    x : userParams.status.position.x,
                    y : userParams.status.position.y
                },
                mapID : userParams.status.mapID || undefined,
                layer : userParams.status.layer || 1,
                hp : userParams.status.hp || 10
            };

            //params.modeでquestとbattleを振り分ける。
            if ( typeof params.mode === 'undefined' || params.mode === "quest") {
                //クエストの時は普通のstageクラスを用いる＆DBからの情報をそのまま使う

            }
            //バトルの時
            else if (params.mode === "battle") {
                //バトルの時はmapIDはparams.battleMapIDで受け取る
                //バトルのmapIDは負の数にする
                newUserOption.mapID = params.battleMapID;
            }

            //userIDとmapIDの紐付けのために
            //ログアウトしないままタブを2つ開いた時など
            var aleadyLogginedUser = my.playerList.getByUserID(newUserOption.userID);
            if (aleadyLogginedUser !== null) {
                aleadyLogginedUser.setSocketID(newUserOption.socketID);
                aleadyLogginedUser.setExpressSessionID(newUserOption.expressSessionID);
                aleadyLogginedUser.setPosition(newUserOption.position);
                aleadyLogginedUser.setMapID(newUserOption.mapID);
                aleadyLogginedUser.setLayer(newUserOption.layer);
                aleadyLogginedUser.setHP(newUserOption.hp);
                aleadyLogginedUser.setIsSendInitData(false);

                //mapIDに基づいた部屋に配置する
                if ( typeof aleadyLogginedUser.getMapID() !== 'undefined') {
                    my.changeUserStage(aleadyLogginedUser, 0, aleadyLogginedUser.getMapID());
                }
                else {
                    //layerに基づいた部屋に配置する
                    var mapID = my.changeUserLayer(Player(newUserOption), newUserOption.layer);
                    aleadyLogginedUser.setMapID(mapID);
                }
            }
            else {
                util.debug(util.format('Add new user:%s %s %s', newUserOption.userID, newUserOption.expressSessionID, newUserOption.socketID));
                my.playerList.add(Player(newUserOption));
                console.dir(newUserOption);

                //mapIDに基づいた部屋に配置する
                if ( typeof newUserOption.mapID !== 'undefined') {
                    my.changeUserStage(Player(newUserOption), 0, newUserOption.mapID);
                }
                else {
                    //layerに基づいた部屋に配置する
                    var mapID = my.changeUserLayer(Player(newUserOption), newUserOption.layer);
                    my.playerList.getByUserID(newUserOption.userID).setMapID(mapID);
                }
            }
        }, function(err) {
            if (err) {
                util.error(err);
            }
            else {
                util.error('error');
            }
        });
    };

    /**
     * クライアントからkeyDownイベントを受け取る
     * @param {Object} params
     * @param {Object} params.code
     * @param {Object} params.userID
     */
    that.onKeyDown = function(params) {
        //TODO:送ってきたユーザーの属するステージクラスのインスタンスをparams.userIDより？取得
        //そのインスタンスのonKeyDown呼び出し
        var currentUser = my.playerList.getByUserID(params.userID);
        if ( typeof currentUser === 'undefined' || currentUser === null) {
            util.error('user not found');
            return;
        }
        var nextStage = my.stageList[currentUser.getMapID()];
        try {
            if ( typeof nextStage !== 'undefiend') {
                nextStage.onKeyDown(params);
            }
        }
        catch(ex) {
            console.error(ex);
        }

    };
    /**
     * チャットメッセージを受信した時
     * @param {Object} params.userID
     * @param {Object} params.message
     * @param {Object} params.io
     */
    that.onChatMessage = function(params) {
        util.debug('onChatMessage');
        //TODO:送ってきたユーザーの属するステージクラスのインスタンスをparams.userIDより取得
        //そのインスタンスのonChatMessage呼び出し
        var currentUser = my.playerList.getByUserID(params.userID);
        if ( typeof currentUser === 'undefined' || currentUser === null) {
            util.error('user not found');
            return;
        }
        console.log("onChatMessage:" + params.message + " " + currentUser.getMapID() + currentUser.getLayer());
        var nextStage = my.stageList[currentUser.getMapID()];
        if ( typeof nextStage !== 'undefined' && nextStage !== null) {
            nextStage.onChatMessage(params);
        }
    };
    /**
     * クライアントの接続が切断された時
     * @param {Object} params
     * @param {Object} params.userID
     */
    that.onDisconnect = function(params) {
        console.log("onDisconnect");

        //TODO:送ってきたユーザーの属するステージクラスのインスタンスをparams.userIDより？取得
        //そのインスタンスのonDisconnect呼び出し
        var currentUser = my.playerList.getByUserID(params.userID);
        if ( typeof currentUser === 'undefined' || !currentUser) {
            util.error("currentUser === undef");
            return false;
        }
        var currentStage = my.stageList[currentUser.getMapID()];
        if ( typeof currentStage === 'undefined') {
            util.error("currentStage === undef");
            return false;
        }
        currentStage.onDisconnect(params);
    };
    that.getBattleUserCount = function() {
        var result = {};
        for (var i in my.stageList) {
            if (my.stageList.hasOwnProperty(i) && i < 0) {
                result[i] = my.stageList[i].getUserCount();
            }
        }
        return result;
    };

    /**
     * ユーザーに定期的にステージの情報を送る
     * @param {Object} params
     * @param {Object} params.userID
     * @param {Object} params.socket
     */
    that.onSendStageInfo = function(params) {
        params.socket.emit('sendStageInfo', my.stageList[my.playerList.get(params.userID).getMapID()].generateStageInfoData());
    };
    that.generateNextMapID = function(layer) {
        return util.format("%s_%s", layer, parseInt(Math.random() * 10241024,10));
    };

    return that;
};

module.exports = {
    Stage : Stage,
    StageList : StageList
};
