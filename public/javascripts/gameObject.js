"use strict";( function(global) {
    if ( typeof require !== 'undefined') {
        var ActionClass = require("../../src/action.js");
        var Action = ActionClass.Action;
        var ActionQueue = ActionClass.ActionQueue;
    }
    /**
     * ゲームオブジェクト基底クラス
     * @param {Object} spec プロパティオブジェクト
     * @param {Object} spec.position.x x座標
     * @param {Object} spec.position.y y座標
     */
    var GameObject = function(spec) {
        spec = spec || {};
        var that = {}, my = {};

        //有効かどうか falseのものはthat.creanupでリストから削除される
        my.enable = true;

        //enable=falseの状態でcreanupが呼び出されるとtrueになる
        my.deleted = false;

        //位置情報
        my.position = spec.position ? {
            x : spec.position.x,
            y : spec.position.y
        } : {
            x : 0,
            y : 0
        };
        that.position = ( function() {
            return my.position;
        }());

        //向いている方向の単位ベクトル
        my.front = spec.front || {
            x : 1,
            y : 1
        };

        //一意なID
        my.id = spec.id || 1;

        that.getID = function() {
            return my.id;
        };
        that.setID = function(id) {
            my.id = id;
        };
        that.move = function(x, y) {
            //位置を更新する
            my.position.x += x;
            my.position.y += y;
            //向いている方向も変える
            if (!(x == 0 && y == 0)) {
                that.setFront({
                    x : (x !== 0) ? x / x * (x < 0 ? -1 : 1) : 0,
                    y : (y !== 0) ? y / y * (y < 0 ? -1 : 1) : 0
                });
            }
        };
        that.getPosition = function() {
            return my.position;
        };
        that.setPosition = function(position) {
            position = position || {
                x : 0,
                y : 0
            };
            my.position.x = position.x;
            my.position.y = position.y;
        };
        that.setFront = function(vector) {
            my.front = vector;
        };
        that.getFront = function() {
            return my.front;
        };
        that.setEnable = function(enable) {
            my.enable = enable;
        };
        that.getEnable = function() {
            return my.enable;
        };
        that.setDeleted = function(deleted) {
            my.deleted = deleted;
        };
        that.getDeleted = function(deleted) {
            return my.deleted;
        };

        return that;
    };

    /**
     * プレイヤークラス
     * @param {Object} spec プロパティオブジェクト
     * @param {Object} spec.expressSessionID ExpressのセッションID
     * @param {Object} spec.socketID Scoket.ioのコネクションID
     * @param {Object} spec.userID ユーザーID
     */
    var Player = function(spec) {
        spec = spec || {};
        var that = GameObject(spec), my = {};

        my.isSendInitData = spec.isSendInitData || false;
        my.expressSessionID = spec.expressSessionID || "";
        my.socketID = spec.socketID || null;
        my.userID = spec.userID || null;
        my.crystalCount = spec.crystalCount || 0;
        my.hp = spec.hp || parseInt(Math.random() * 3, 10) + 1;
        my.mapID = spec.mapID || -1;
        my.layer = spec.layer || 1;
        my.name = spec.name || "default name";
        my.maxHP = spec.maxHP || my.hp;
        my.size = spec.size || 1;
        my.matchlessCount = spec.matchlessCount || 0;
        my.syncCount = 15000;

        my.preDeadTime = spec.preDeadTime || -1;
        //0:生きている 1:瀕死 2:SOS中 3終わり
        my.state = spec.state || 0;

        //trueだとupdate内で強制的に1階に戻される
        //SOS発信してから1分間立った時orリトライボタンが押された時に強制的に有効になる
        my.isEndGame = spec.isEndGame || false;

        that.getExpressSessionID = function() {
            return my.expressSessionID;
        };
        that.setExpressSessionID = function(expressSessionID) {
            my.expressSessionID = expressSessionID;
        };
        that.getSocketID = function() {
            return my.socketID;
        };
        that.setSocketID = function(socketID) {
            my.socketID = socketID;
        };
        that.getUserID = function() {
            return my.userID;
        };
        that.setUserID = function(userID) {
            my.userID = userID;
        };
        that.getName = function() {
            return my.name;
        };
        that.setName = function(name) {
            my.name = name;
        };
        that.setCrystalCount = function(count) {
            my.crystalCount = count;
        };
        that.getCrystalCount = function() {
            return my.crystalCount;
        };
        that.increaseCrystalCount = function(value) {
            value = value || 1;
            my.crystalCount += value;
        };
        that.decreaseCrystalCount = function(amount) {
            amount = amount || 1;
            my.crystalCount -= amount;
        };
        that.getHP = function() {
            return my.hp;
        };
        that.setHP = function(hp) {
            my.hp = hp;
        };
        that.getSize = function() {
            return my.size;
        };
        that.setSize = function(size) {
            my.size = size;
        };
        that.decreaseHP = function(amount, fource) {
            amount = amount || 1
            fource = fource || false;

            //生きている状態の時は減らさない
            if (!fource && (that.getIsMatchless() || my.state !== 0)) {
                return false;
            }
            if (my.hp - amount >= 0) {
                my.hp -= amount;
            }
            return my.hp;
        };
        that.increaseHP = function(amount, fource) {
            amount = amount || 1
            fource = fource || false;

            //生きている状態の時は減らさない
            if (!fource && (that.getIsMatchless() || my.state !== 0)) {
                return false;
            }
            if (my.hp + amount <= that.getMaxHP()) {
                my.hp += amount;
            }
            return my.hp;
        };
        that.getMapID = function() {
            return my.mapID;
        };
        that.setMapID = function(mapID) {
            my.mapID = mapID;
        };
        that.setIsSendInitData = function(isSendInitData) {
            my.isSendInitData = isSendInitData;
        };
        that.getIsSendInitData = function() {
            return my.isSendInitData;
        };
        that.getMatchlessCount = function() {
            return my.matchlessCount;
        };
        that.setMatchlessCount = function(count) {
            my.matchlessCount = count;
        };
        that.getMaxHP = function() {
            return my.maxHP;
        };
        that.setMaxHP = function(maxHP) {
            my.maxHP = maxHP;
        };
        that.setMatchless = function() {
            my.matchlessCount = 10;
        };
        that.getIsMatchless = function() {
            return my.matchlessCount > 0;
        };
        that.getLayer = function() {
            return my.layer;
        };
        that.setLayer = function(layer) {
            my.layer = layer;
        };
        that.update = function() {
            if (my.matchlessCount > 0) {
                my.matchlessCount--;
            }
            if (my.syncCount > 0) {
                my.syncCount--;
            }
            else if (my.syncCount <= 0) {
                my.syncCount = 100;
                my.isSendInitData = false;
            }

            //死んだ時刻がセットされていて、なおかつSOS中の時は時間を調べて60秒経ったら死亡状態にする
            if (my.preDeadTime !== -1 && my.state === 2) {
                if (new Date().getTime() - my.preDeadTime > 60 * 1000) {
                    console.error('player is turn to dead');
                    my.state = 3;
                    my.preDeadTime = -1;
                }
            }
        };
        that.setPreDeadTime = function(preDeadTime) {
            my.preDeadTime = preDeadTime;
        };
        that.getPreDeadTime = function() {
            return my.preDeadTime;
        };
        that.getIsEndGame = function() {
            return my.isEndGame;
        };
        that.setIsEndGame = function(isEndGame) {
            my.isEndGame = isEndGame;
        };
        that.getState = function() {
            return my.state;
        };
        that.setState = function(state) {
            my.state = state;
        };
        that.setSOS = function() {
            if (my.state === 1) {
                console.log('set SOS');
                my.state = 2;
                return true;		
            }
            else {
                console.error('player is not preDead');
                return false;
            }	     
        };
        that.setGameEnd = function() {
            if (my.state === 1 || my.state === 2) {
                my.state = 3;
            }
            else {
                console.log('setGameEnd called but player is live');
            }
        };
        that.resporn = function(position) {
            console.log("resporn");
            that.setState(0);
            that.setHP(10);
            that.setPosition(position);
        };

        /**
         * getIDをオーバーライド <br>
         * userIDを一意なキーとする
         */
        that.getID = function() {
            return that.getUserID();
        };

        that.isDifferentFrom = function(obj) {
            if (my.hp !== obj.getHP()) {
                return true;
            }
            else if (that.position.x !== obj.position.x) {
                return true;
            }
            else if (that.position.y !== obj.position.y) {
                return true;
            }
            else if (my.crystalCount !== obj.getCrystalCount()) {
                return true;
            }
            else if (that.getEnable() !== obj.getEnable()) {
                return true;
            }
            else if (that.getLayer() !== obj.getLayer()) {
                return true;
            }
            else if (that.getState() !== obj.getState()) {
                return true;
            }
        };
        that.getDiff = function(obj) {
            var res = {};
            if (my.hp !== obj.getHP()) {
                res.hp = my.hp;
            }
            if (that.position.x !== obj.position.x) {
                res.position = {
                    x : that.position.x
                };
            }
            if (that.position.y !== obj.position.y) {
                res.position = res.position || {};
                res.position.y = that.position.x;
            }
            if (my.crystalCount !== obj.getCrystalCount()) {
                res.crystalCount = my.crystalCount;
            }
            if (res !== {}) {
                res.userID = my.userID;
            }
            return res;
        }
        /**
         * プロパティを全て出力する
         *
         */
        that.toJSON = function() {
            var result = {};
            result["expressSessionID"] = that.getExpressSessionID();
            result["socketID"] = that.getSocketID();
            result["userID"] = that.getUserID();
            result["name"] = that.getName();
            result["crystalCount"] = that.getCrystalCount();
            result["mapID"] = that.getMapID();
            result["position"] = {};
            result["position"]["x"] = that.position.x;
            result["position"]["y"] = that.position.y;
            result["size"] = that.getSize();
            result["hp"] = that.getHP();
            result["layer"] = that.getLayer();
            return result;
        };
        return that;
    };

    /**
     * GameObjectを格納するリストの基底クラス
     */
    var GameObjectList = function() {
        var that = {}, my = {};

        //GameObject.getID()によって取得される一意な値をキーとしてGameObjectを格納する連想配列
        my.objectList = {};

        /**
         * リストに新たなGameObjectを追加する
         * @param {GameObject} obj 新たに追加するGameObject
         * @return {bool} 追加に成功したかどうか
         */
        that.add = function(obj, fource) {
            if (!fource && obj.getID() in my.objectList) {
                return false;
            }
            else {
                my.objectList[obj.getID()] = obj;
                return true;
            }
        };
        /**
         * GameObject.getID()によって取得される一意な値をキーに持つオブジェクトをリストから削除する
         * @param {Object} id 削除するGameObjectのGameObject.getID()によって取得される一意な値
         * @return {bool} 削除に成功したかどうか
         */
        that.remove = function(id) {
            if ( id in my.objectList) {
                delete my.objectList[id];
                return true;
            }
            else {
                console.log("called remove false");
                return false;
            }
        };

        /**
         * 全ての要素をリストから削除する
         */
        that.removeAll = function() {
            my.objectList = {};
        };

        /**
         * enable == false　のものをリストから削除する
         * @return 削除された要素の配列
         */
        that.creanup = function() {
            var deleteKeys = [];
            for (var i in my.objectList) {
                if (my.objectList.hasOwnProperty(i) && my.objectList[i].getDeleted() === true) {
                    deleteKeys.push(i);
                }
            }
            deleteKeys.forEach(function(elem) {
                delete my.objectList[elem];
            });

            var notEnabledKeys = [];
            for (var i in my.objectList) {
                if (my.objectList.hasOwnProperty(i) && my.objectList[i].getEnable() === false) {
                    notEnabledKeys.push(i);
                }
            }
            notEnabledKeys.forEach(function(elem) {
                my.objectList[elem].setDeleted(true);
            });

        };

        /**
         * 指定したIDをキーにもつGameObjectがリスト中に存在するかどうか
         * @param {Object} id GameObject.getID()によって取得される一意な値
         */
        that.hasObject = function(id) {
            return ( id in my.objectList);
        };

        /**
         * 指定した値をキーに持つGameObjectを取得する
         * @param {Object} id 取得したいGameObjectのGameObject.getID()によって取得する一意な値
         * @return {GameObject} 指定したIDをキーに持つGameObject
         */
        that.get = function(id) {
            var i;
            for (i in my.objectList) {
                if (my.objectList.hasOwnProperty(i)) {
                    if (my.objectList[i].getID() === id) {
                        return my.objectList[i];
                    }
                }
            }
            return null;
        };

        /**
         * 配列の形にして返す
         */
        that.toArray = function() {
            var array = [], i;
            for (i in my.objectList) {
                if (my.objectList.hasOwnProperty(i)) {
                    array.push(my.objectList[i]);
                }
            }
            return array;
        };

        /**
         * 要素数を返す
         */
        that.getCount = function() {
            var obj = my.objectList;
            return Object.keys(obj).length;
        };

        /**
         * データへの参照を返す
         */
        that.getObjectList = function() {
            return my.objectList;
        };

        /**
         * 差分配列を元に情報を更新する
         * @param {Array} diffArray [ID,変更が起きているオブジェクトのプロパティセット]を要素にもつ配列
         */
        that.importDiff = function(diffArray) {
            diffArray.forEach(function(elem) {
                my.objectList[elem[0]] = elem[1];
            });
        };
        /**
         * サーバ側から送るデータを生成する
         */
        that.generateSendData = function(params) {
            return my.exportDiff(params.prevData);
        };
        return that;
    };

    /**
     * 各プレイヤーのインスタンスを追加するプレイヤーリストクラス
     * @param {Object} spec
     */
    var PlayerList = function(spec) {
        spec = spec || {};
        var that = GameObjectList(spec), my = {};

        that.getBySocketID = function(socketID) {
            var playerList = that.getObjectList(), i;
            for (i in playerList) {
                if (playerList.hasOwnProperty(i) && playerList[i].getSocketID() === socketID) {
                    return playerList[i];
                }
            }
            return null;
        };
        that.getByExpressSessionID = function(expressSessionID) {
            var playerList = that.getObjectList(), i;
            for (i in playerList) {
                if (playerList.hasOwnProperty(i) && playerList[i].getExpressSessionID() === expressSessionID) {
                    return playerList[i];
                }
            }
            return null;
        };
        that.getByUserID = function(userID) {
            var playerList = that.getObjectList(), i;
            for (i in playerList) {
                if (playerList.hasOwnProperty(i) && playerList[i].getUserID() === userID) {
                    return playerList[i];
                }
            }
            return null;
        };
        that.getByPosition = function(position) {
            var playerList = that.getObjectList(), i;
            for (i in playerList) {
                if (playerList.hasOwnProperty(i) && playerList[i].position.x == position.x && playerList[i].position.y == position.y) {
                    return playerList[i];
                }
            }
            return null;
        };

        /**
         * プレイヤーデータ同士の差分を取る <br>
         * サーバ側のみで用いる <br>
         * TODO:サーバ側でのみ参照できるようにする
         * @param {Array} prevData 直前のmy.GameObjectList
         * @return {Array} [userID,変更が起きているオブジェクトのプロパティセット]を要素にもつ配列
         */
        my.exportDiff = function(prevData) {
            var result = [];
            var playerList = that.getObjectList();
            for (var i in playerList) {
                if (playerList.hasOwnProperty(i)) {
                    if ( typeof prevData[i] === 'undefined' || prevData[i].userID != playerList[i].getUserID() || prevData[i].position.x != playerList[i].position.x || prevData[i].position.y != playerList[i].position.y || prevData[i].hp != playerList[i].getPosition() || prevData[i].CrystalCount != playerList[i].getCrystalCount()) {
                        result.push([i, playerList[i]]);
                    }

                }
            }
            return result;
        };
        /**
         * 差分配列を元に情報を更新する
         * @param {Array} diffArray [ID,変更が起きているオブジェクトのプロパティセット]を要素にもつ配列
         */
        that.importDiff = function(diffArray) {
            var playerList = that.getObjectList();
            var deletArray = [];

            diffArray.forEach(function(elem) {
                if ( typeof elem['userID'] !== 'undefined' && typeof playerList[elem.userID] !== 'undefined') {
                    if ( typeof elem.enable !== 'undefined' && !elem.enable) {
                        deletArray.push(elem.userID);
                    }
                    else {
                        var currentPlayer = playerList[elem.userID];
                        typeof elem.position.x !== 'undefined' ? currentPlayer.position = {
                            x : elem.position.x,
                            y : currentPlayer.position.y
                        } : "";
                        typeof elem.position.y !== 'undefined' ? currentPlayer.position = {
                            x : currentPlayer.position.x,
                            y : elem.position.y
                        } : "";
                        typeof elem.front !== 'undefined' ? currentPlayer.setFront({
                            x : elem.front.x,
                            y : elem.front.y
                        }) : "";
                        typeof elem.hp !== 'undefined' ? currentPlayer.setHP(elem.hp) : "";
                        typeof elem.maxHP !== 'undefined' ? currentPlayer.setMaxHP(elem.maxHP) : "";
                        typeof elem.crystalCount !== 'undefined' ? currentPlayer.setCrystalCount(elem.crystalCount) : "";
                        typeof elem.mapID !== 'undefined' ? currentPlayer.setMapID(elem.mapID) : "";
                        typeof elem.size !== 'undefined' ? currentPlayer.setSize(elem.size) : "";
                        typeof elem.matchlessCount !== 'undefined' ? currentPlayer.setMatchlessCount(elem.matchlessCount) : "";
                        typeof elem.layer !== 'undefined' ? currentPlayer.setLayer(elem.layer) : "";
                        typeof elem.state !== 'undefined' ? currentPlayer.setState(elem.state) : "";
                    }
                }
                else if (elem.enable) {
                    that.add(Player(elem));
                }
            });

            deletArray.forEach(function(elem) {
                that.getObjectList()[elem] = undefined;
                that.remove(elem);
            });
        };

        that.getCurrentParameters = function() {
            var playerList = that.getObjectList(), i, result = {};
            for (i in playerList) {
                if (playerList.hasOwnProperty(i)) {
                    var current = {};
                    current['ID'] = i;
                    current['userID'] = playerList[i].getUserID();
                    current['position'] = {};
                    current['position']['x'] = playerList[i].position.x;
                    current['position']['y'] = playerList[i].position.y;
                    current['front'] = playerList[i].getFront();
                    current['hp'] = playerList[i].getHP();
                    current['maxHP'] = playerList[i].getMaxHP();
                    current['crystalCount'] = playerList[i].getCrystalCount();
                    current['mapID'] = playerList[i].getMapID();
                    current['enable'] = playerList[i].getEnable();
                    current['size'] = playerList[i].getSize();
                    current['matchlessCount'] = playerList[i].getMatchlessCount();
                    current['layer'] = playerList[i].getLayer();
                    current['state'] = playerList[i].getState();
                    result[i] = current;
                }
            }
            return result;
        };

        /**
         * クライアントに送信するためにプレイヤーの状態の差分のオブジェクトの配列を生成する
         * @return {Array[Player]} userID, positionプロパティのみをもつPlayer型の！インスタンスの配列
         */
        that.generateSendData = function(params) {
            params = params || {};
            var playerList = that.getObjectList(), i, result = [];
            var prevData = params.prevData;
            for (i in playerList) {
                if (playerList.hasOwnProperty(i)) {
                    var current = {}, currentPlayer;
                    if ( i in prevData) {
                        var elem = prevData[i];
                        if (playerList[elem.ID].isDifferentFrom(Player(elem))) {
                            currentPlayer = playerList[elem.ID];
                        }
                        else {
                            continue;
                        }
                    }
                    else {
                        currentPlayer = playerList[i];
                    }
                    current['userID'] = currentPlayer.getUserID();
                    current['position'] = currentPlayer.position;
                    current['front'] = currentPlayer.getFront();
                    current['hp'] = currentPlayer.getHP();
                    current['maxHP'] = currentPlayer.getMaxHP();
                    current['crystalCount'] = currentPlayer.getCrystalCount();
                    current['mapID'] = currentPlayer.getMapID();
                    current['enable'] = currentPlayer.getEnable();
                    current['size'] = currentPlayer.getSize();
                    current['matchlessCount'] = currentPlayer.getMatchlessCount();
                    current['layer'] = currentPlayer.getLayer();
                    current['state'] = currentPlayer.getState();

                    result.push(current);
                }
            }
            return result;
        };
        that.getSocketIDArray = function(){
          var result=[];
          var playerList = that.getObjectList();
          for(var i in playerList){
              result.push(playerList[i].getSocketID());
          }
          return result;
        };
        return that;
    };
    /**
     * クリスタルオブジェクト
     * @param {Object} spec
     */
    var Crystal = function(spec) {
        spec = spec || {};
        var that = GameObject(spec);
        return that;
    };

    var Weapon = function(spec) {
        spec = spec || {};
        var that = GameObject(spec);
        var my = {};

        //1秒あたりの移動量
        my.speed = spec.speed || 2;

        //一意な値 オブジェクトカウントをIDとして扱う
        my.id = spec.id || Weapon.prototype.getWeaponCount();

        //親のGameObjectのgetID()によって取得される一意な値
        //発射元ユーザーのuserIDを用いる
        my.parentID = spec.parentID || null;

        that.getParentID = function() {
            return my.parentID;
        };
        that.setParentID = function(parentID) {
            my.parentID = parentID;
        };

        //getIDをオーバーライド オブジェクトカウントをIDとして扱う
        that.getID = function() {
            return my.id;
        };
        that.getSpeed = function() {
            return my.speed;
        };
        return that;
    };
    //オブジェクトが生成された数
    Weapon.prototype.count = 0;
    Weapon.prototype.getWeaponCount = function() {
        return Weapon.prototype.count++;
    };

    /**
     * 各攻撃のインスタンスを追加する攻撃リストクラス
     * @param {Object} spec
     */
    var WeaponList = function(spec) {
        spec = spec || {};
        var that = GameObjectList(spec), my = {};
        /**
         * Weaponデータ同士の差分を取る <br>
         * サーバ側のみで用いる <br>
         * TODO:サーバ側でのみ参照できるようにする
         * @param {Array} prevData 直前のmy.GameObjectList
         * @return {Array} [userID,変更が起きているオブジェクトのプロパティセット]を要素にもつ配列
         */
        my.exportDiff = function(prevData) {
            var result = [];
            var weaponList = that.getObjectList();
            for (var i in weaponList) {
                if (weaponList.hasOwnProperty(i)) {
                    if ( typeof prevData[i] === 'undefined' || prevData[i].parentID !== weaponList[i].getParentID() || prevData[i].position.x !== weaponList[i].position.x || prevData[i].position.y !== weaponList[i].position.y || prevData[i].id !== weaponList[i].getID()) {
                        result.push([i, weaponList[i]]);
                    }
                }
            }
            return result;
        };
        /**
         * 差分配列を元に情報を更新する
         * @param {Array} diffArray [ID,変更が起きているオブジェクトのプロパティセット]を要素にもつ配列
         */
        that.importDiff = function(diffArray) {
            var weaponList = that.getObjectList();
            var idList = [];
            diffArray.forEach(function(elem) {
                 //posidion.x,position.y,id,parentid,...
                 var currentData = elem.split(',');
                 var x = currentData[0];
                 var y = currentData[1];
                 var id = currentData[2];
                 var pid = currentData[3];
                if (typeof weaponList[id] !== 'undefined') {
                    weaponList[id].position = {
                        x :x,
                        y :y
                    } ;
                    weaponList[id].setParentID(pid);
                }
                else {
                    that.add(Weapon({id:id,position:{x:x,y:y},parentID:pid}));
                }
                idList.push(id);
            });

            //ローカルに存在するIDで、サーバには存在しないIDは削除する
            var removeIds = [];
            for (var i in weaponList) {
                if (weaponList.hasOwnProperty(i) && idList.indexOf(i.toString()) < 0) {
                    removeIds.push(i);
                }
            }
            removeIds.forEach(function(val) {
                delete weaponList[val];
            });
        };

        that.getCurrentParameters = function() {
            var weaponList = that.getObjectList(), i, result = [];
            for (i in weaponList) {
                if (weaponList.hasOwnProperty(i)) {
                    var current = {}, currentWeapon = weaponList[i];
                    current['position'] = {};
                    current['position']['x'] = currentWeapon.position.x;
                    current['position']['y'] = currentWeapon.position.y;
                    current['id'] = currentWeapon.getID();
                    current['parentID'] = currentWeapon.getParentID();
                    result.push(current);

                }
            }
            return result;
        };

        /**
         * クライアントに送信するためにの弾のオブジェクトの情報の配列を生成する
         * @return {Array} userID, positionプロパティのみをもつPlayerクラスのインスタンスの配列
         */
        that.generateSendData = function(params) {
            params = params || {};
            var playerList = that.getObjectList(), i, result = [];
            var prevData = params.prevData;
            var diffData = my.exportDiff(prevData);
            //posidion.x,position.y,id,parentid,...
            for (i in diffData) {
                if (diffData.hasOwnProperty(i)) {
                    var current =diffData[i][1].position.x+","+diffData[i][1].position.y+","+diffData[i][0]+","+diffData[i][1].getParentID();
                    result.push(current);
                }
            }
            return result;
        };
        return that;
    };

    var Trap = function(spec) {
        spec = spec || {};
        var that = GameObject(spec);
        var my = {};
    };

    var Enemy = function(spec) {
        spec = spec || {};
        //とりあえずプレイヤーを継承
        var that = Player(spec);
        var my = my || {};

        my.id = spec.id || Enemy.prototype.getEnemyCount();
        my.size = spec.size || parseInt(Math.random() * 10, 10) + 1;

        //getID, getUserIDをオーバーライド オブジェクトカウントをIDとして扱う
        that.getID = function() {
            return my.id;
        };
        that.getUserID = function() {
            return my.id;
        };
        that.getSize = function() {
            return my.size;
        };
        that.setSize = function(size) {
            my.size = size;
        };

        //次の行動予定をランダムに生成する
        that.generateNextAction = function() {

            //アクションを適当に設定する
            var action, randomValue = Math.random() * 10;
            if (randomValue < 1) {
                //弾の発射
                action = Action({
                    id : my.id,
                    actionType : Action.actionTypeID.fire,
                    value : {
                        parentID : my.id
                    }
                });
            }
            else if (randomValue < 5) {
                //移動する
                randomValue = parseInt(Math.random() * 10, 10);
                action = Action({
                    id : my.id,
                    actionType : Action.actionTypeID.move,
                    value : {
                        parentID : my.id,
                        moveVector : {
                            //移動方向をランダムで設定する
                            x : Math.random().toFixed() * (randomValue % 2 == 0 ? 1 : -1), //0か1か-1
                            y : Math.random().toFixed() * (randomValue % 2 == 0 ? 1 : -1)//0か1か-1
                        }
                    }
                });
            }
            else {
                //何もしない
                return null;
            }
            return action;
        };
        return that;
    };
    //オブジェクトが生成された数
    Enemy.prototype.count = -1;
    Enemy.prototype.getEnemyCount = function() {
        return Enemy.prototype.count--;
    };

    var EnemyList = function(spec) {
        spec = spec || {};

        //とりあえずプレイヤーリスト継承してしまう
        var that = PlayerList(spec);
        var my = my || {};

        that.getByPosition = function(position, exclusiveID) {
            var playerList = that.getObjectList(), i;
            exclusiveID = exclusiveID || 0;

            for (i in playerList) {
                if (playerList.hasOwnProperty(i)) {
                    var posx = playerList[i].position.x;
                    var posy = playerList[i].position.y;
                    var size = playerList[i].getSize();
                    if (posx <= position.x && position.x <= posx + size - 1 && posy <= position.y && position.y <= posy + size - 1 && playerList[i].getID() !== exclusiveID) {
                        return playerList[i];
                    }
                }
            }
            return null;
        };
        return that;
    };

    //サーバサイドとクライアントサイド両方で用いる。
    global["GameObject"] = GameObject;
    global["GameObjectList"] = GameObjectList;
    global["Player"] = Player;
    global["PlayerList"] = PlayerList;
    global["Crystal"] = Crystal;
    global["Weapon"] = Weapon;
    global["WeaponList"] = WeaponList;
    global["Enemy"] = Enemy;
    global["EnemyList"] = EnemyList;
}(this));

