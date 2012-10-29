"use strict";
var app = require("../app.js");
var errorMessage = {
    1 : "validation error : ID/passは4〜15文字",
    2 : "そのIDは既に使用済み"
};
var url = require('url');

/**
 * ユーザー登録ページ
 */
exports.index = function(req, res) {
    var query = url.parse(req.url, true).query;

    if ( typeof query !== 'undefined' && typeof query.errorid !== 'undefined' && typeof errorMessage[query.errorid] !== 'undefined') {
        res.render('regist', {
            info : errorMessage[query.errorid]
        });
    }
    else {
        res.render('regist', {
            info : ''
        });
    }
};

/**
 * ユーザー登録のpostを受け取る
 */
exports.regist = function(req, res) {
    console.log('/regist/new');
    var DB = app.DB;
    var inputData = {
        userID : req.body.userID,
        password : req.body.password
    };

    DB.UserLogin.findOne(inputData, function(err, data) {
        if (data === null) {
            //DBに保存する
            DB.registUser(inputData, function() {
                res.redirect('/login');
                return;
            }, function(err) {
                console.dir(err);
                res.redirect("/regist?errorid=2");
                return;
            });
        }
        else {
            console.log("既に登録済み:" + inputData.userID);
            res.redirect("/regist?errorid=2");
            return;
        }
    });
};
