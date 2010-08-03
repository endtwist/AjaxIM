exports.cookie = 'sessionid';

exports.authenticate = function(session_id, callback) {
    // Verify user based on request.
    // On failure, redirect user to auth form

    callback({
        username: 'username' + Math.floor(Math.random() * 1000),
        displayname: 'John Smith',
        otherinfo: 'any other relevant key/values'
    });
};

exports.friends = function(session_id, data, callback) {
    // Create a friends list based on given user data

    callback([
        'username1',
        'username2',
        'username3'
    ]);
};