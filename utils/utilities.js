
/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */

exports.randString = generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

exports.randSessionKey = genRandSessionKey = function() {
	var key = '';
    var possible = '0123456789';

    for (var i = 0; i < 3; i++) {
        key += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return key;
}
