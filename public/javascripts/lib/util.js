'use strict';( function(global) {
    /**
     * {0},{1},{2}にarguments[1],arguments[2],...を埋め込む
     */
    Object.defineProperty(String.prototype, "Format", {
        Enumerable : false,
        value : function(format) {
            var args = arguments;
            return format.replace(/\{(\d)\}/g, function(m, c) {
                return args[parseInt(c) + 1];
            });
        }
    });
    Object.defineProperty(String.prototype, "escapeHtml", {
        Enumerable : false,
        value : function(str) {
            return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }
    });

    /**
     * オブジェクトをディープコピーする
     */
    var deepCopy = function(p, c) {
        var c = c || {};
        for (var i in p) {
            if ( typeof p[i] === 'object') {
                c[i] = (p[i] !== null && p[i].constructor === Array) ? [] : {};
                deepCopy(p[i], c[i]);
            }
            else {
                c[i] = p[i];
            }
        }
        return c;
    };

    var compare = function(obj1, obj2) {
        var paramName;

        var compare = function(objA, objB, param) {
            var paramObjA = objA[param], paramObjB = ( typeof objB === 'undefined' || typeof objB[param] === 'undefined') ? false : objB[param];

            switch (typeof objA[param]) {
                case "object" :
                    return (compare(paramObjA, paramObjB));
                case "function" :
                    return (paramObjA.toString() === paramObjB.toString());
                default:
                    return (paramObjA === paramObjB);
            }
        }
        for (paramName in obj1) {
            if ( typeof obj2 !== 'undefined' && typeof obj2[paramName] === 'undefined' || !compare(obj1, obj2, paramName)) {
                return (false);
            }
        }

        for (paramName in obj2) {
            if ( typeof obj1[paramName] === 'undefined' || !compare(obj1, obj2, paramName)) {
                return false;

            }
        }
        return true;
    };

    //寄生的継承においてスーパークラスのメソッドを呼び出せるようにする
    Object.defineProperty(Object.prototype, "superior", {
        Enumerable : false,
        value : function(name) {
            var that = this, method = that[name];
            return function() {
                return method.apply(that, arguments);
            };
        }
    });

    global['MyUtil'] = {
        compare : compare,
        deepCopy : deepCopy
    };
}(this));

