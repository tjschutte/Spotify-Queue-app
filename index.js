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

// Application specific stuff. From https://developer.spotify.com/
const client_id = '124f0693c5084064ad7d8b4f1db5c55a'; // Your client id
const client_secret = '8b6d017da5d5427ab77cffb4388cbff0'; // Your secret
const redirect_uri = 'http://localhost:8888/create'; // Your redirect uri

/**
 * Controllers (route handlers).
 */
const controller = require('./controllers/controller');
const utils = require('./utils/utilities');

// auth state
var stateKey = 'spotify_auth_state';
var sessionKey = 'sessionKey';
var keysInUse = [];

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

// Control routes
app.post('/add', controller.add);
app.get('/get_songs', controller.get_songs);
app.post('/play', controller.play);

// Redirect to login to spotify (gets us a key to use when searching)
// Will also use the key when we want to connect to a use device for whoever does the
// initial setup
app.get('/create', function(req, res) {
    var state = utils.randString(16);
	var key = utils.randSessionKey();
	keysInUse.push(key);
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
