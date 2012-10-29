'use strict';
var MyApp = {
    requestBattleDataIntervalID : -1
};

var connection = io.connect("/lobby");

var requestBattleData = function() {
    connection.emit("requestBattleData");
};

connection.on('connect', function() {
    console.log("cliant-connect");
    
    //サーバーに現在のバトル部屋の状態を定期的に問い合わせるクラス
    if (MyApp.requestBattleDataIntervalID === -1) {
        MyApp.requestBattleDataIntervalID = setInterval(function() {
            requestBattleData();
        }, 10000);
    }
});

connection.on('latestinfo',function(data){
    console.log(data);
});


connection.on('disconnect', function() {
    console.log("cliant-disconnect");
});