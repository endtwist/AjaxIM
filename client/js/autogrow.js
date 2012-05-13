/*
 * Adapted from
 * https://github.com/jaz303/jquery-grab-bag/blob/master/javascripts/jquery.autogrow-textarea.js
 *
 * Auto-growing textareas; technique ripped from Facebook
 */
$.fn.autogrow = function(options) {
    
    this.filter('textarea').each(function() {
        
        var $this       = $(this),
            minHeight   = $this.height(),
            lineHeight  = $this.css('lineHeight');
        
        var shadow = $('<div></div>').css({
            position:   'absolute',
            top:        -10000,
            left:       -10000,
            width:      $(this).width() - parseInt($this.css('paddingLeft')) - parseInt($this.css('paddingRight')),
            fontSize:   $this.css('fontSize'),
            fontFamily: $this.css('fontFamily'),
            lineHeight: $this.css('lineHeight'),
            resize:     'none',
            'word-wrap':'break-word'
        }).appendTo(document.body);
        
        var update = function() {
            var times = function(string, number) {
                for (var i = 0, r = ''; i < number; i ++) r += string;
                return r;
            };
            
            var val = this.value.replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/&/g, '&amp;')
                                .replace(/\n$/, '<br/>&nbsp;')
                                .replace(/\n/g, '<br/>')
                                .replace(/ {2,}/g, function(space) { return times('&nbsp;', space.length -1) + ' ' });
            
            shadow.html(val);
            $(this).css('height', Math.max(shadow.height(), minHeight));
        }
        
        $(this).change(update).keyup(update).keydown(update);
        
        update.apply(this);
        
    });
    
    return this;
    
}