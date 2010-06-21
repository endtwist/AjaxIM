exports.cookie = 'ajaxim_session';

exports.authenticate = function(request, callback) {
    // Verify user based on request.
    // On failure, redirect user to auth form
    
    callback({
        username: 'username',
        displayname: 'John Smith',
        otherinfo: 'any other relevant key/values'
    });
};

exports.friends = function(user, callback) {
    // Create a friends list based on given user data
    
    callback([
        'username1',
        'username2',
        'username3'
    ]);
};