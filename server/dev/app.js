var cookie = require('cookie');

module.exports = function(route, app) {
    app.get(route+'/', function(req, res) {
        res.render('chat', {
        });
    });

    app.get(route+'/cookie', function(req, res) {
        var uid = function(n) {
           var chars='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', nn='';
           for(var c=0; c < n; c++){
              nn += chars.substr(0|Math.random() * chars.length, 1);
           }
           return nn;
        };
        res.setHeader('Set-Cookie',
            cookie.serialize('sessionid', uid(40), {path: '/'})
        );
        res.send('cookie set');
    });
};