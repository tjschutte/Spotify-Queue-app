/**
 * Module dependencies.
 */
const express = require('express');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const request = require('request'); // "Request" library
const path = require('path');
const fs = require('fs');
const config = require('./config.json');

// Application specific stuff. From https://developer.spotify.com/
const client_id = config.client_id; // Your client id
const client_secret = config.client_secret; // Your secret
const redirect_uri = config.redirect_uri; // Your redirect uri

/**
 * Controllers (route handlers).
 */
const controller = require('./controllers/controller');
const utils = require('./utils/utilities');

// auth state
var stateKey = 'spotify_auth_state';
var sessionKey = 'sessionKey';
const numSessions = 1000;

/**
 * Create Express server.
 */
const app = express();
app.set('port', process.env.PORT || 8888);
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);


app.use('/static', express.static('public'))
app.use(express.static(__dirname + '/public')).use(cookieParser());

/** bodyParser.urlencoded(options)
* Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
* and exposes the resulting object (containing the keys and values) on req.body
*/
app.use(bodyParser.urlencoded({
  extended: true
}));

/**bodyParser.json(options)
* Parses the text as JSON and exposes the resulting object on req.body.
*/
app.use(bodyParser.json());

/**
 * Primary app routes. Pages are html pages that a user can visit and interact with.
   Control routes are the routes the app calls to make various api calls.
*/
// Pages
app.get('/', controller.setup);
app.get('/search', controller.search);
app.get('/join', controller.join);
app.get('/create', controller.create);
app.get('/capacity', controller.capacity);

// Control routes
app.post('/add', controller.add);
app.post('/end', controller.end);
app.post('/play', controller.play);
app.post('/find', controller.findQueue);
app.post('/device', controller.setDevice);
app.post('/upvote', controller.upvote);
app.post('/downvote', controller.downvote);
app.post('/setSongs', controller.set_songs);
app.get('/get_songs', controller.get_songs);
app.get('/get_tokens', controller.get_tokens);

// Redirect to login to spotify (gets us a key to use when searching)
// Will also use the key when we want to connect to a use device for whoever does the
// initial setup
app.get('/setup', function(req, res) {
    var state = utils.randString(16);
	var keyTry = 0;
	do {
		var key = utils.randSessionKey();
		keyTry++;
	} while (key in controller.queues && keyTry <= numSessions);

	if (keyTry >= numSessions) {
		res.redirect('/capacity');
		return;
	}
    res.cookie(stateKey, state);
	res.cookie(sessionKey, key);
    // your application requests authorization
    var scope = 'user-read-private user-read-email user-read-playback-state user-modify-playback-state playlist-modify-public playlist-modify-private';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            // Application_id
            client_id: client_id,
            // Scope of permissions we need from the user
            scope: scope,
            // Where the user will get redirected to within the app after login
            redirect_uri: redirect_uri,
            // application state
            state: state
        }));
});

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
