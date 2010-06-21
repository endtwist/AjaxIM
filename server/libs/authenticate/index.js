exports.cookie = 'ajaxim_session';

exports.authenticate = function(request) {
    // Verify user based on request.
    // On failure, redirect user to auth form
    
    return {
        username: 'username',
        displayname: 'John Smith',
        otherinfo: 'any other relevant key/values'
    };
};