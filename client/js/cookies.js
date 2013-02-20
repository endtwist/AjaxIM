// Cookies API
var cookies = {
    // === {{{AjaxIM.}}}**{{{cookies.set(name, value, days)}}}** ===
    //
    // Sets a cookie, stringifying the JSON value upon storing it.
    //
    // ==== Parameters ====
    // * {{{name}}} is the cookie name.\\
    // * {{{value}}} is the cookie data that you would like to store.\\
    // * {{{days}}} is the number of days that the cookie will be stored for.
    set: function(name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        } else var expires = "";
        document.cookie = name + "=" + JSON.stringify(value) + expires + "; path=/";
    },

    // === {{{AjaxIM.}}}**{{{cookies.get(name)}}}** ===
    //
    // Gets a cookie, decoding the JSON value before returning the data.
    //
    // ==== Parameters ====
    // * {{{name}}} is the cookie name that you would like to retrieve.
    get: function(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0) {
              var cval = decodeURIComponent(c.substring(nameEQ.length, c.length));
              try { return JSON.parse(cval); } catch (e) { return cval; }
            }
        }
        return null;
    },

    // === {{{AjaxIM.}}}**{{{cookies.erase(name)}}}** ===
    //
    // Deletes a cookie.
    //
    // {{{name}}} is the existing cookie that you would like to delete.
    erase: function(name) {
        this.set(name, '', -1);
    }
};
