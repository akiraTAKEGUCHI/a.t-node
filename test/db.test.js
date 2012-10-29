"use strict";
var should = require('should');
var assert = require('assert');
var crypto = require("crypto");
var DB = require("../src/db.js")();

describe('DBtest', function() {
    describe('#registUser', function() {
        before(function(done) {
            DB.UserLogin.remove(function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        it('regist user {userID:abcd, password:1234}', function(done) {
            var inputData = {
                userID : 'abcd',
                password : '1234'
            };
            DB.registUser(inputData, function() {
                DB.UserLogin.findOne({
                    userID : 'abcd',
                    password : crypto.createHash('md5').update('1234').digest("hex")
                }, function(err, data) {
                    should.exist(data);
                    done();
                });
            }, function(err) {
                return done(err);
            });
        });

        it('duplication regist user test {userID:abcd, password:1234}', function(done) {
            var inputData = {
                userID : 'abcd',
                password : '1234'
            };
            DB.registUser(inputData, function() {
                done("duplication");
            }, function(err) {
                done();
            });
        });

        it('not validated regist user test {userID:123, password:1234}', function(done) {
            var inputData = {
                userID : '123',
                password : '1234'
            };
            DB.registUser(inputData, function() {
                done("not validated userID");
            }, function(err) {
                done();
            });
        });
        it('not validated regist user test {userID:1234567890123456, password:1234}', function(done) {
            var inputData = {
                userID : '1234567890123456',
                password : '1234'
            };
            DB.registUser(inputData, function() {
                done("not validated userID");
            }, function(err) {
                done();
            });
        });

        it('not validated regist user test {userID:1234, password:123}', function(done) {
            var inputData = {
                userID : '1234',
                password : '123'
            };
            DB.registUser(inputData, function() {
                done("not validated password");
            }, function(err) {
                done();
            });
        });
        it('not validated regist user test {userID:1234, password:123あ}', function(done) {
            var inputData = {
                userID : '1234',
                password : '123あ'
            };
            DB.registUser(inputData, function() {
                done("not validated password");
            }, function(err) {
                done();
            });
        });
        it('not validated regist user test {userID:あいうえお, password:1234}', function(done) {
            var inputData = {
                userID : 'あいうえお',
                password : '1234567890123456'
            };
            DB.registUser(inputData, function() {
                done("not validated password");
            }, function(err) {
                done();
            });
        });

        after(function(done) {
            DB.UserLogin.remove(function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
    });

    describe('#isRegisted', function() {
        before(function(done) {
            DB.registUser({
                userID : 'abcd',
                password : 'abcd'
            }, function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        it('enable login {userID:abcd password:abcd}', function(done) {
            var inputData = {
                userID : 'abcd',
                password : 'abcd'
            };
            DB.isRegisted(inputData, function() {
                done();
            }, function(err) {
                throw err;
            });
        });

        it('try to use invaild pair {userID:ABCD password:abcd}', function(done) {
            var inputData = {
                userID : 'ABCD',
                password : 'abcd'
            };
            DB.isRegisted(inputData, function() {
                done('try to use invaild pair');
            }, function(err) {
                should.exist(err);
                done();
            });
        });

        after(function(done) {
            DB.UserLogin.remove(function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });

    });

    describe('#sessionUpdate', function() {
        before(function(done) {
            DB.UserStatus.remove({}, function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        it('check whether session is storeable', function(done) {
            var sessionID = 'testSessionID';
            var userID = 'userID';
            DB.sessionUpdate({
                sessionID : sessionID,
                userID : userID
            }, function(res) {
                DB.UserStatus.find({
                    sessionID : sessionID
                }, function(err, data) {
                    if (err) {
                        return done(err);
                    }
                    should.exist(data);
                    data.should.have.length(1);
                    should.exist(data[0].lastAccess);
                    should.equal(data[0].userID, userID);
                    should.equal(data[0].lastAccess, res.lastAccess);
                    should.equal(data[0].userID, res.userID);
                    done();
                });
            }, function(err) {
                done(err);
            });
        });
        after(function(done) {
            DB.UserStatus.remove(function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
    });

    describe('#dropSession', function() {
        before(function(done) {
            DB.UserStatus.remove({}, function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        it('check whether 0 sessions are dropped before 2 minutes', function(done) {
            var sessionID = 'testSessionID';
            var userID = 'userID';
            var insertData = {
                sessionID : sessionID,
                userID : userID
            };
            DB.sessionUpdate(insertData, function(res) {
                DB.dropSession(function() {
                    DB.UserStatus.find(insertData, function(err, data) {
                        data.should.have.length(1);
                        should.equal(data[0].userID, userID);
                        should.equal(data[0].sessionID, sessionID);
                        done();
                    });
                }, function(err) {
                    throw err;
                });
            }, function(err) {
                done(err);
            });
        });
        after(function(done) {
            DB.UserStatus.remove(function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
    });

    describe('#isLogined', function() {
        before(function(done) {
            DB.UserStatus.remove({}, function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
        it('check whether invaild user access is denyed', function(done) {
            var sessionID = 'testSessionID';
            var userID = 'userID';
            var insertData = {
                sessionID : sessionID,
                userID : userID
            };
            DB.sessionUpdate(insertData, function(res) {
                DB.isLogined('userid', function() {
                    throw "invaild user access";
                }, function(data) {
                    should.exist(data);
                    done();
                });
            }, function(err) {
                throw err;
            });
        }, function(err) {
            done(err);
        });
        it('check whether vaild user access is accepted', function(done) {
            var sessionID = 'testSessionID';
            var userID = 'userID';
            var insertData = {
                sessionID : sessionID,
                userID : userID
            };
            DB.sessionUpdate(insertData, function(res) {
                DB.isLogined(sessionID, function(data) {
                    should.exist(data);
                    should.equal(data.userID,insertData.userID);
                    done();
                }, function(err) {
                    throw "invaild user access";
                });
            }, function(err) {
                throw err;
            });
        }, function(err) {
            throw err;
        });
    });
    after(function(done) {
        DB.UserStatus.remove(function(err) {
            if (err) {
                return done(err);
            }
            done();
        });
    });
});