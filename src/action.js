"use strict";
/**
 * プレイヤーの行動をキューに追加する際のクラス
 * @param{Object} spec.id アクション元の一意なID(userID)
 * @param{Action.actionTypeID} spec.actionType 行動の種類のID
 * @param{Object} spec.value 行動内容のパラメータ
 * @param{Object} spec.value.moveVector 移動方向
 */
var Action = function(spec) {
    var that = {};

    //アクション元の一意なID
    that.id = spec.id || null;
    that.actionType = spec.actionType || null;
    that.value = spec.value || null;
    return that;
};
Action.actionTypeID = ( function() {
    return {
        move : 1,
        fire : 2,
        blade:3
    };
}());

/**
 * プレイヤー全ての行動予定を格納するキュー
 */
var ActionQueue = function() {
    var that = {}, my = {};
    my.queue = [];

    /**
     * キューに行動予定を追加する
     * @param{Action} action プレイヤーの行動予定
     */
    that.enqueue = function(action) {
        my.queue.push(action);
    };

    /**
     * 現在のキューの内容を全て取り出す
     * @return{Object} キューの内容の配列
     */
    that.dequeueAll = function() {
        return my.queue.splice(0, my.queue.length);
    };
    return that;
};

module.exports = {Action:Action,ActionQueue:ActionQueue};
