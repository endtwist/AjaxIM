var cookie = require('cookie');

module.exports = function(route, app) {
    app.get(route+'/', function(req, res) {
        res.render('chat', {
            locals: {}
        });
    });

    app.get(route+'/cookie', function(req, res) {
        res.setHeader('Set-Cookie',
            cookie.serialize('sessionid', require('connect').utils.uid(40),
                                                {path: '/'})
        );
        res.send('cookie set');
    });
};