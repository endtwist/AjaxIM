var cookie = require('cookie');

module.exports = function(route, app) {
    app.get(route+'/', function(req, res) {
        res.render('chat', {
        });
    });

    app.get(route+'/cookie', function(req, res) {
        var uid = function(n) {
           var d = new Date().getTime();
           var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
               var r = (d + Math.random()*16)%16 | 0;
               d = Math.floor(d/16);
               return (c=='x' ? r : (r&0x7|0x8)).toString(16);
           });
           return uuid;
        };
        res.setHeader('Set-Cookie',
            cookie.serialize('sessionid', uid(40), {path: '/'})
        );
        res.send('cookie set');
    });
};