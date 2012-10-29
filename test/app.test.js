"use strict";
var appjs = require('../app.js');
var app = appjs.express;
var should = require('should');
var assert = require('assert');
var url = require('url');
var superagent = require('superagent');

describe('HTTP Server', function() {
    var testUser = superagent.agent();

    before(function(done) {
        appjs.MyApp.DEBUG = false;
        appjs.DB.UserLogin.remove(function(err) {
            if (err) {
                return done(err);
            }
            appjs.DB.UserStatus.remove({}, function(err) {
                if (err) {
                    return done(err);
                }
                done();
            });
        });
    });
    it('GET / should return 200', function(done) {
        testUser.get('http://localhost:8080/').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.equal(res.statusCode, 200);
            done();
        });
    });
    it('GET /login should return 200', function(done) {
        testUser.get('http://localhost:8080/login').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.equal(res.statusCode, 200);
            done();
        });
    });
    it('GET /regist should return 200', function(done) {
        testUser.get('http://localhost:8080/regist').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.equal(res.statusCode, 200);
            done();
        });
    });
    it('GET /lobby should redirect to /login if user has not already logined', function(done) {
        testUser.get('http://localhost:8080/lobby').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/login");
            done();
        });
    });
    it('GET /game should redirect to /login if user has not already logined', function(done) {
        testUser.get('http://localhost:8080/game').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/login");
            done();
        });
    });
    it('POST /regist/new should redirect to /regist if failed to regist', function(done) {
        testUser.post('http://localhost:8080/regist/new').send({
            userID : 'min',
            password : 'bad'
        }).end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/regist");
            done();
        });
    });
    it('POST /regist/new should redirect to /login if success to regist', function(done) {
        testUser.post('http://localhost:8080/regist/new').send({
            userID : 'test',
            password : 'test'
        }).end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/login");
            done();
        });
    });
    it('POST /user/login should redirect to /login if faild to login', function(done) {
        testUser.post('http://localhost:8080/user/login').send({
            userID : 'test',
            password : 'bad_password'
        }).end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/login");
            done();
        });
    });
    it('POST /user/login should redirect to /lobby if success to login', function(done) {
        testUser.post('http://localhost:8080/user/login').send({
            userID : 'test',
            password : 'test'
        }).end(function(err, res) {
            if (err) {
                throw err;
            }
            should.exist(res.redirects);
            should.equal(url.parse(res.redirects[0], false, true).pathname, "/lobby");
            done();
        });
    });
    it('GET /lobby should return 200 after login', function(done) {
        testUser.get('http://localhost:8080/lobby').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.equal(res.statusCode, 200);
            should.equal(res.req.path, "/lobby");
            done();
        });
    });
    it('GET /game should return 200 after logined', function(done) {
        testUser.get('http://localhost:8080/game').end(function(err, res) {
            if (err) {
                throw err;
            }
            should.equal(res.statusCode, 200);
            should.equal(res.req.path, "/game");
            done();
        });
    });
});
