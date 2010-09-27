// Many functions borrowed from
// ext.js - Copyright TJ Holowaychuk <tj@vision-media.ca> (MIT Licensed)

module.exports = o_ = {
    merge: function(a, b) {
        if(!b) return a;
        var keys = Object.keys(b);
        for(var i = 0, len = keys.length; i < len; i++)
            a[keys[i]] = b[keys[i]];
        return a;
    },
    
    values: function(obj) {
        if(typeof obj == 'array')
            return obj;
        if(!obj || typeof obj !== 'object')
            return [];
        var keys = Object.keys(obj),
            vals = [];
        for(var i = 0, len = keys.length; i < len; ++i)
            vals.push(obj[keys[i]]);
        return vals;
    },
    
    find: function(arr, fn, context) {
        if(typeof arr == 'array') {
            for(var i = 0, len = arr.length; i < len; ++i)
                if(fn.call(context, arr[i], i, arr))
                    return arr[i];
        } else if(typeof arr == 'object') {
            var keys = Object.keys(obj);
            for(var i = 0, len = keys.length; i < len; ++i)
                if(fn.call(context, arr[keys[i]], keys[i], arr))
                    return [arr[keys[i]], keys[i]];
        }
    },

    bind: function(fn, context) {
        var self = fn,
            args = Array.prototype.slice.call(arguments, 2);
        return function() {
            var _args = Array.prototype.slice.call(arguments);
            return fn.apply(context, args.concat(_args));
        };
    }
};