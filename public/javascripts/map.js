'use strict';
( function(global) {
    /**
     * Mapクラス <br>
     * usage: var map = Map().init({width:100, height:100});
     */
    var Map = function(spec) {
        var that = {}, 
        my = {};
        spec = spec || {};

        my.width = spec.width || 100;
        my.height = spec.height || 100;
                
        //マップのオブジェクトIDの定数
        that.objectTypeID = ( function() {
            return {
                none : 0,
                wall : 1,
                trap : 2,
                crystal : 3,
                player : 4,
                stairs : 5,
                enemy:6,
            };
        }());

        //マップデータ(2次元配列で)
        my.mapData = [];

        /**
         * マップ初期化
         * @param {Object} config.width 幅 config.height 高さ
         */
        that.init = function(config) {
            my.width = config.width;
            my.height = config.height;

            my.mapData = new Array(my.width);
            for (var i = 0; i < my.width; i++) {
                my.mapData[i] = new Array(my.height);
                for (var j = 0; j < my.height; j++) {
                    my.mapData[i][j] = that.objectTypeID.wall;
                }
            }
            return that;
        };
        /**
         * マップ生成
         * @param {Number} width 幅
         * @param {Number} height 高さ
         */
        that.createMapData = function(width, height) {
            //最小区画サイズ
            var MINIMUM_RECT_SIZE = 15;

            /**
             * 区画クラス
             * @param {Number} x 区画の基準点のX座標
             * @param {Number} y 区画の基準点のY座標
             * @param {Number} width 区画の幅
             * @param {Number} height 区画の高さ
             */
            var Rectangle = function(x, y, width, height, boolH, boolV, index) {
                this.x = x;
                this.y = y;
                this.width = width;
                this.height = height;
                this.splitHorizontally = boolH;
                this.splitVertically = boolV;
                this.index = index;
            };

            Rectangle.prototype = {
                setX : function(x) {
                    this.x = x;
                },
                setY : function(y) {
                    this.y = y;
                },
                setWidth : function(width) {
                    this.width = width;
                },
                setHeight : function(height) {
                    this.height = height;
                },
                setSplitH : function(bool) {
                    this.splitHorizontally = bool;
                },
                setSplitV : function(bool) {
                    this.splitVertically = bool;
                }
            };

            /**
             * 部屋クラス
             * @param {Number} x 部屋の基準点のX座標
             * @param {Number} y 部屋の基準点のY座標
             * @param {Number} width 部屋の幅
             * @param {Number} height 部屋の高さ
             */
            var Room = function(x, y, width, height) {
                this.x = x;
                this.y = y;
                this.width = width;
                this.height = height;
            };

            /**
             * ペアクラス
             * @param {Number} rectParentIndex 親区画のインデックス
             * @param {Number} rectChildIndex 子区画のインデックス
             * @param {String} splitLine 分割線の種類
             * @param {Number} splitPosition 分割線の位置
             */
            var Pair = function(rectParentIndex, rectChildIndex, splitLine, splitPosition) {
                this.rectParentIndex = rectParentIndex;
                this.rectChildIndex = rectChildIndex;
                this.splitLine = splitLine;
                this.splitPosition = splitPosition;
            };

            // 区画リスト
            var rectList = [];

            // 部屋リスト
            var roomList = [];

            // ペアリスト
            var pairList = [];

            /**
             * 区画の分割
             * @param {Rectangle} rect 分割する区画
             */
            var splitRect = function(rectParent) {

                //終了条件
                if ((rectParent.width <= MINIMUM_RECT_SIZE * 2) || (rectParent.height <= MINIMUM_RECT_SIZE * 2)) {
                    return;
                }
                else if (rectParent.width <= MINIMUM_RECT_SIZE * 2) {
                    rectParent.setSplitV(false);
                }
                else if (rectParent.height <= MINIMUM_RECT_SIZE * 2) {
                    rectParent.setSplitH(false);
                }

                //子区画の追加
                var rectChild = new Rectangle(rectParent.x, rectParent.y, rectParent.width, rectParent.height, rectParent.splitHorizontally, rectParent.splitVertically, rectList.length);
                rectList.push(rectChild);

                if (rectParent.splitHorizontally) {//上下に分割
                    var splitY = (rectParent.y + MINIMUM_RECT_SIZE) + Math.floor(Math.random() * (rectParent.height - MINIMUM_RECT_SIZE * 2));
                    rectParent.setHeight(splitY - rectParent.y);
                    rectChild.setHeight(rectChild.y + rectChild.height - 1 - splitY);
                    rectChild.setY(splitY + 1);
                    rectParent.setSplitH(false);
                    rectChild.setSplitH(false);
                    rectParent.setSplitV(true);
                    rectChild.setSplitV(true);
                    var pair = new Pair(rectParent.index, rectChild.index, "HORIZONTALLY", splitY);
                    pairList.push(pair);
                    splitRect(rectParent);
                    splitRect(rectChild);
                    return;
                }
                else if (rectParent.splitVertically) {//左右に分割
                    var splitX = (rectParent.x + MINIMUM_RECT_SIZE) + Math.floor(Math.random() * (rectParent.width - MINIMUM_RECT_SIZE * 2));
                    rectParent.setWidth(splitX - rectParent.x);
                    rectChild.setWidth(rectChild.x + rectChild.width - 1 - splitX);
                    rectChild.setX(splitX + 1);
                    rectParent.setSplitV(false);
                    rectChild.setSplitV(false);
                    rectParent.setSplitH(true);
                    rectChild.setSplitH(true);
                    var pair = new Pair(rectParent.index, rectChild.index, "VERTICALLY", splitX);
                    pairList.push(pair);
                    splitRect(rectParent);
                    splitRect(rectChild);
                    return;
                }
            };

            /**
             * 部屋の生成
             * @param {Rectangle} rect 部屋を生成する区画
             */
            var createRoom = function(rect) {
                var width = Math.floor(rect.width / 3) + Math.floor(Math.random() * (rect.width - Math.floor(rect.width / 3) - 1));
                var height = Math.floor(rect.height / 3) + Math.floor(Math.random() * (rect.height - Math.floor(rect.height / 3) - 1));
                var x = (rect.x + 1) + Math.floor(Math.random() * (rect.width - width - 1));
                var y = (rect.y + 1) + Math.floor(Math.random() * (rect.height - height - 1));
                var room = new Room(x, y, width, height);
                roomList.push(room);
            };

            /**
             * 部屋の追加
             * @param {Room} room 追加する部屋
             */
            var addRoom = function(room) {
                for (var j = room.y - 1; j <= room.y + room.height; j++) {
                    for ( i = room.x - 1; i <= room.x + room.width; i++) {
                        if (j == room.y - 1 || j == room.y + room.height || i == room.x - 1 || i == room.x + room.width) {
                            my.mapData[i][j] = that.objectTypeID.wall;
                        }
                        else {
                            my.mapData[i][j] = that.objectTypeID.none;
                        }
                    }
                }
            };

            /**
             * 通路の生成
             * @param {Pair} pair 作成するペア
             */
            var createPath = function(pair) {
                var parentRoom = roomList[pair.rectParentIndex];
                var childRoom = roomList[pair.rectChildIndex];
                switch(pair.splitLine) {
                    case "HORIZONTALLY":
                        var parentX = parentRoom.x + Math.floor(Math.random() * (parentRoom.width));
                        var childX = childRoom.x + Math.floor(Math.random() * (childRoom.width));
                        //境界線上の通路生成
                        for (var i = Math.min(parentX, childX); i <= Math.max(parentX, childX); i++) {
                            my.mapData[i][pair.splitPosition] = that.objectTypeID.none;
                        }
                        //親側の通路生成
                        for (var j = parentRoom.y + parentRoom.height; j < pair.splitPosition; j++) {
                            my.mapData[parentX][j] = that.objectTypeID.none;
                        }
                        //子側の通路生成
                        for (var j = pair.splitPosition; j < childRoom.y; j++) {
                            my.mapData[childX][j] = that.objectTypeID.none;
                        }
                        break;

                    case "VERTICALLY":
                        var parentY = parentRoom.y + Math.floor(Math.random() * (parentRoom.height));
                        var childY = childRoom.y + Math.floor(Math.random() * (childRoom.height));
                        //境界線上の通路生成
                        for (var j = Math.min(parentY, childY); j <= Math.max(parentY, childY); j++) {
                            my.mapData[pair.splitPosition][j] = that.objectTypeID.none;
                        }
                        //親側の通路生成
                        for (var i = parentRoom.x + parentRoom.width; i < pair.splitPosition; i++) {
                            my.mapData[i][parentY] = that.objectTypeID.none;
                        }
                        //子側の通路生成
                        for (var i = pair.splitPosition; i < childRoom.x; i++) {
                            my.mapData[i][childY] = that.objectTypeID.none;
                        }
                        break;
                }
            };

            //Mapを複数の区画に分割
            var initialRect = new Rectangle(1, 1, width - 2, height - 2, true, true, 0);
            rectList.push(initialRect);
            splitRect(initialRect);

            //各区画に1つずつ部屋を生成
            for (var i in rectList) {
                createRoom(rectList[i]);
            }

            //生成した部屋をリストに追加
            for (var i in roomList) {
                addRoom(roomList[i]);
            }

            //部屋同士をつなぐ通路の生成
            for (var i in pairList) {
                createPath(pairList[i]);
            }

            //階段をセットする
            var stairsPosition = that.getNonePositionRandomly();
            my.mapData[stairsPosition.x][stairsPosition.y] = that.objectTypeID.stairs;
        };

        /**
         * バトル用のマップデータを作成する
         */
        that.createBattleMapData = function(width, height) {
            for (var i = 1; i < width - 1; i++) {
                for (var j = 1; j < height - 1; j++) {
                    my.mapData[i][j] = that.objectTypeID.none;
                }
            }
        };

        /**
         * マップデータにオブジェクトを配置する
         * @param {Number} x x座標
         * @param {Number} y y座標
         * @param {Number} objctTypeID 配置するオブジェクトのTypeID
         * @return {bool} セットに成功したかどうか
         */
        that.setMapObject = function(x, y, objctTypeID) {
            //階段は不用意に上書きしないようにする
            if ( typeof my.mapData[x] !== 'undefined' && ((objctTypeID!==that.objectTypeID.stairs&&my.mapData[x][y]!==that.objectTypeID.stairs))||objctTypeID===that.objectTypeID.stairs) {
                my.mapData[x][y] = objctTypeID;
                return true;
            }
            else {
                return false;
            }
        };

        /**
         * マップにトラップをセットする
         * @param {Number} x x座標
         * @param {Number} y y座標
         * @return {bool} セットに成功したかどうか
         */
        that.setTrap = function(x, y) {
            return that.setMapObject(x, y, that.objectTypeID.trap);
        };

        /**
         * マップからトラップを削除する
         * @param {Number} x x座標
         * @param {Number} y y座標
         * @return {bool} 削除に成功したかどうか
         */
        that.removeTrap = function(x, y) {
            if (my.mapdata[x][y] !== that.objectTypeID.trap) {
                console.log("トラップがセットされていません");
                return false;
            }
            return my.setMapObject(x, y, that.objectTypeID.none);
        };

        /**
         * マップデータ(参照)を返す
         * @return マップデータ
         */
        that.getMapData = function() {
            return my.mapData;
        };

        that.getMapDataCopy = function() {
            var map = my.mapData;
            var width = map.length;
            var res = [];
            for(var i=0;i<width;i++){
                res.push(map[i].concat())
            }
            return res;
        };
        
        that.setMapData = function(mapData) {
            my.mapData = mapData;
        };

        that.getWidth = function() {
            return my.width;
        };
        that.getHeight = function() {
            return my.height;
        };

        my.respornPoint = [{
            x : 1,
            y : 1
        }, {
            x : 48,
            y : 48
        }, {
            x : 1,
            y : 48
        }, {
            x : 48,
            y : 1
        }];
        that.getRespornPoint = function() {
            return my.respornPoint[parseInt(Math.random() * my.respornPoint.length, 10)];
        };
        that.getNonePositions = function(size) {
            size = size ||1;
            var result = [];
            var width = my.mapData.length;
            for (var x = 0; x < width; x++) {
                var height = my.mapData[x].length;
                for (var y = 0; y < height; y++) {

                    var isNone = true;
                    for (var i = 0; i < size; i++) {
                        for (var j = 0; j < size; j++) {
                            var val = my.mapData[x+i][y + j];
                            if (typeof val==='undefined'||val !== that.objectTypeID.none) {
                                isNone = false;
                                break;
                            }
                        }
                        if (!isNone) {
                            break;
                        }
                    }
                    if (isNone) {
                        result.push({
                            x : x,
                            y : y
                        });
                    }

                }
            }
            return result;
        };
        that.getNonePositionRandomly = function(size) {
            size = size||1;
            var positions = that.getNonePositions(size);
            return positions[parseInt(Math.random() * positions.length, 10)];
        };
        that.getCurrentCrystalCount = function() {
            var count = 0;
            var width = my.mapData.length;
            for (var x = 0; x < width; x++) {
                var height = my.mapData[x].length;
                for (var y = 0; y < height; y++) {
                    if(typeof my.mapData[x]!=='undefined' && my.mapData[x][y]===that.objectTypeID.crystal){
                        count++;
                    }
                }
            }
            return count;
        }
        /**
         * マップデータ同士の差分を取ってクライアントに送るデータを生成する
         * @param {Array} prevData
         * @return {Array} [x座標,y座標,その(x,y)地点の新たな値]を要素に持つ差分の配列
         */
        my.exportDiff = function(prevData) {
            var width = my.mapData.length;
            var height = my.mapData[0].length;

            var diffArray = [];
            my.mapData.forEach(function(line, x) {
                line.forEach(function(val, y) {
                    if (typeof prevData[x]=='undefined' ||prevData[x][y] !== val) {
                        diffArray.push([x, y, val]);
                    }
                });
            });
            return diffArray;
        };
        /**
         * 差分配列を元に情報を更新する
         * @param {Array} diffArray [x座標,y座標,その(x,y)地点の新たな値]を要素に持つ差分の配列
         */
        that.importDiff = function(diffArray) {
            diffArray.forEach(function(elem) {
                my.mapData[elem[0]][elem[1]] = elem[2];
            });
        };
        /**
         * サーバ側から送るデータを生成する
         */
        that.generateSendData = function(params) {
            return my.exportDiff(params.prevData);
        };

        that.exportData = function() {
            var width = my.mapData.length;
            var height = my.mapData[0].length;

            //最初の2要素は幅と高さ
            var result = [width, height];
            for (var i = 0; i < width; i++) {
                for (var j = 0; j < height; j++) {
                    result.push(my.mapData[i][j]);
                }
            }
            return result;
        };
        that.importData = function(exportedData) {
            var width = exportedData.shift();
            var height = exportedData.shift();
            var result = [];
            for (var i = 0; i < width; i++) {
                result.push(exportedData.splice(0, height));
            }
            my.mapData = result;
            return that;
        };
        return that;
    };

    //サーバサイドとクライアントサイド両方で用いる
    global["Map"] = Map;
}(this));
