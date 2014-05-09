var cookie = require('cookie');

module.exports = function(route, app) {
    app.get(route+'/', function(req, res) {
        res.render('chat', {
        });
    });
};