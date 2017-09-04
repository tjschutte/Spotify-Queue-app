
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
    const possibleNum = '0123456789';
	const possibleChar = 'abcdefghijklmnopqrstuvwxyz';

    for (var i = 0; i < 3; i++) {
        key += possibleNum.charAt(Math.floor(Math.random() * possibleNum.length));
    }

	key+= '-';

	for (var i = 0; i < 3; i++) {
        key += possibleChar.charAt(Math.floor(Math.random() * possibleChar.length));
    }
    return key;
}
