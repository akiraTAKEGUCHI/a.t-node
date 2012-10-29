'use strict';
//初期化処理
$(function() {
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
	// bodyのCSS設定 
	document.getElementById("body").style.margin=getBrowserWidth()*2/100 + "px";
	
    // dungeonボタンのサイズ設定                                                                                                                                                                              
    $("#dungeon_button")[0].style.width = getBrowserWidth()*96/100 + "px";
    $("#dungeon_button")[0].style.height = getBrowserHeight()*1/2 - getBrowserWidth()*1/100 + "px";
    document.getElementById("dungeon_button").style.fontSize=getBrowserHeight()*8/100 + "px";
    // dungeonボタンの動作                                                                                                                                                                                    
    $("#dungeon_button").click(function () {
    });
	
	// battleボタンのサイズ設定                                                                                                                                                                              
    $("#battle_button")[0].style.width = getBrowserWidth()*96/100 + "px";
    $("#battle_button")[0].style.height = getBrowserHeight()*1/2 - getBrowserWidth()*1/100 + "px";
    document.getElementById("battle_button").style.fontSize=getBrowserHeight()*8/100 + "px";
    // battleボタンの動作                                                                                                                                                                                    
    $("#battle_button").click(function () {
    });
});
