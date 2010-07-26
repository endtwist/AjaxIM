var utils = require('connect/utils');

module.exports = function(app) {
    app.get('/', function(req, res) {
        res.render('chat', {
            locals: {}
        });
    });

    app.get('/cookie', function(req, res) {
        res.send('cookie set', {
            'Set-Cookie': utils.serializeCookie('sessionid', utils.uid())
        });
    });
};