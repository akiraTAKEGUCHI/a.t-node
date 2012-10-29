"use strict";
var util = require("util"), crypto = require("crypto"), mongoose = require('mongoose');
/**
 * DBへのセッション情報の保存・ユーザー情報の保存・投稿内容の保存を行う
 */

var db;
module.exports = function() {
    var that = {};
    //DB未接続時に接続
    if (( typeof db === 'undefined' || db.connections._readyState === 0)) {
        if ( typeof process.env.NODE_ENV !== 'undefined' && process.env.NODE_ENV === 'test') {
            console.warn("DB is connected fot test");
            db = mongoose.connect('mongodb://localhost/user');
        }
        else {
            console.log('connected to db');
            db = mongoose.connect('mongodb://localhost/user');
        }
    }

    //ユーザーログイン情報スキーマ
    var UserLogin = new mongoose.Schema({
        userID : {
            type : String,
            required : true,
            unique : true
        },
        password : {
            type : String,
            required : true,
        },
    });
    mongoose.model('UserLogin', UserLogin);
    that.UserLogin = mongoose.model('UserLogin');

    //UserIDは半角英数字4〜15文字
    that.UserLogin.schema.path('userID').validate(function(value) {
        return (/^[a-zA-Z0-9]{4,15}$/).test(value);
    }, 'Invalid ID : UserIDは半角英数字4〜15文字');
    that.UserLogin.schema.path('password').validate(function(value) {
        return (/^[a-zA-Z0-9]{4,}$/).test(value);
    }, 'Invalid password : Passwordは半角英数字4文字以上');

    //ユーザーデータスキーマ
    //ステータス・セッション情報・現在いる階層やマップIDを持つ
    var UserData = new mongoose.Schema({
        userID : {
            type : String,
            required : true,
            unique : true
        }, //ユーザーID(一意)
        name : String, //名前
        status : {
            crystal : Number, //クリスタル所持数
            position : {
                x : Number,
                y : Number
            },
            hp : Number, //HP
            layer : Number, //第何層にいるか
            mapID : String, //現在いるMapのID
        },
        icon : String, //アイコン画像をbase64エンコードしたもの
        //登録ユーザー数の増加に伴って探索に時間がかかる・・・？
        session : {
            sessionID : String, //expressのsessionID
            socketID : String, //socket.ioのsocketID
            lastAccess : Number, //最後に通信した時刻　ある程度時間が経つとセッション情報はクリアされる
        },
        'deleted' : Number, //削除日時 削除要求があったデータも一定期間保持する
    });
    mongoose.model('UserData', UserData);
    that.UserData = mongoose.model('UserData');

    //ログイン判別スキーマ
    var UserStatus = new mongoose.Schema({
        userID : {
            type : String,
            required : true,
        },
        sessionID : String,
        lastAccess : Number
    });
    mongoose.model('UserStatus', UserStatus);
    that.UserStatus = mongoose.model('UserStatus');

    var FieldData = new mongoose.Schema({
        mapID : {
            type : String,
            required : true,
            unique : true
        },
        layer : Number,
        layout : Array,
        weapon : Array,
    });
    mongoose.model('FieldData', FieldData);
    that.FieldData = mongoose.model('FieldData');

    //TODO:その他追加予定関数: isRightIdPassPare 正しいID・パスワードかどうか
    //TODO: setStatus ステータスを更新
    //TODO: getStatus ステータスを取得

    that.disconnect = function() {
        db.disconnect();
    };
    /**
     * sessionIDがログイン済みのものか確かめる
     * @param sessionID sessionID
     * @param successCallBack ログイン済みであった場合のコールバック関数
     * @param errCallBack エラーまたは未ログインであった場合のコールバック関数
     */
    that.isLogined = function(sessionID, successCallBack, errCallBack) {
        console.log(sessionID);
        that.UserStatus.findOne({
            'sessionID' : sessionID
        }, function(err, session) {
            if (err) {
                errCallBack(err);
            }
            else {
                if ( typeof session !== "undefined" && session !== null) {
                    successCallBack(session);
                }
                else {
                    errCallBack('session is undefined');
                }
            }
        });
    };

    /**
     * セッション情報を更新する
     * @param params.sessionID sessionID
     * @param params.userID userID
     * @param successCallBack ログイン済みであった場合のコールバック関数
     * @param errCallBack エラーまたは未ログインであった場合のコールバック関数
     */
    that.sessionUpdate = function(params, successCallBack, errCallBack) {
        var data = {
            userID : params.userID,
            lastAccess : Date.now()
        };
        that.UserStatus.update({
            sessionID : params.sessionID
        }, {
            $set : data
        }, {
            upsert : true
        }, function(err, numberAffected) {
            if (!err) {
                util.log(util.format("session updated:%s", params.sessionID));
                successCallBack(data);
            }
            else {
                util.error(util.format("session update error:%s", params.sessionID));
                errCallBack(err);
            }
        });
    };

    /**
     * 2分間アクセスのないユーザーのセッション情報を削除する
     * @param sessionID sessionID
     * @param successCallBack ログイン済みであった場合のコールバック関数
     * @param errCallBack エラーまたは未ログインであった場合のコールバック関数
     */
    that.dropSession = function(successCallBack, errCallBack) {
        that.UserStatus.remove({
            lastAccess : {
                '$lte' : Date.now() - 2 * 60 * 1000
            }
        }, function(err, numberAffected) {
            if (err) {
                console.dir(err);
                errCallBack(err);
            }
            else {
                util.log("clean up:" + numberAffected);
                successCallBack(numberAffected);
            }
        });
    };

    /**
     * DBからユーザーのステータス情報を取ってくる
     * @param {Object} userID
     * @param {Object} successCallBack
     * @param {Object} errorCallBack
     */
    that.getUserData = function(userID, successCallBack, errorCallBack) {
        console.log(userID);
        that.UserData.findOne({
            userID : userID
        }, function(err, userParams) {
            console.log('wnd');
            if (err) {
                console.dir(err);
                util.error(err);
                errorCallBack(err);
            }
            else {
                console.dir(userParams);
                successCallBack(userParams);
            }
        });
    };

    /**
     * ユーザーを新規登録する
     * @param {Object} params
     * @param {Object} params.userID ユーザーID
     * @param {Object} params.password パスワード
     * @param {Object} successCallBack
     * @param {Object} errorCallBack
     */
    that.registUser = function(params, successCallBack, errorCallBack) {
        that.UserLogin(params).pre('save', function(next) {
            if (!(/^[a-zA-Z0-9]{4,16}$/).test(this.password)) {
                console.error("Invaild password");
                errorCallBack("Invaild password");
                return;
            }
            //暗号化
            this.password = crypto.createHash('md5').update(this.password).digest("hex");
            next();
        }).save(function(err) {
            if (err) {
                errorCallBack(err);
                return;
            }
            successCallBack();
            return;
        });
    };

    /**
     * ユーザーID,パスワードの組み合わせから登録済みユーザーかどうか確かめる
     * @param {Object} params
     * @param {Object} params.userID ユーザーID
     * @param {Object} params.password パスワード
     * @param {Object} successCallBack
     * @param {Object} errorCallBack
     */
    that.isRegisted = function(params, successCallBack, errorCallBack) {
        params = params || {
            password : "",
            userID : ""
        };
        params.password = crypto.createHash('md5').update(params.password).digest("hex");
        that.UserLogin.findOne(params, function(err, data) {
            if (data !== null) {
                successCallBack(data);
            }
            else if (err) {
                console.dir(err);
                errorCallBack(err);
            }
            else {
                errorCallBack('invaild pair of userID and password');
            }
        });
    };
    return that;
};
