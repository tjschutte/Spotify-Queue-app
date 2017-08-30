const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const request = require('request'); // "Request" library
const cmd = require('node-cmd');

// Application specific stuff. From https://developer.spotify.com/
const client_id = '124f0693c5084064ad7d8b4f1db5c55a'; // Your client id
const client_secret = '8b6d017da5d5427ab77cffb4388cbff0'; // Your secret
const redirect_uri = 'http://localhost:8888/create'; // Your redirect uri

// The list of songs added. Eventuall will need to tie this to a session key
var queues = queues || {};

var playing = playing || undefined;

/**
 * GET. Login and redirect back to the search page.
 */
exports.search = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

    res.render('search.html', {
        access_token: queues[sessionKey]['access_token'],
        song_list: JSON.stringify( queues[sessionKey]['songs']),
		sessionKey: sessionKey
    });

};

exports.findQueue = (req, res) => {
	//console.log(req.body);
	if (req.body.sessionKey in queues) {
		//console.log('Found:', req.body.sessionKey);
		res.send('FOUND');
	} else {
		res.send('NOT FOUND');
	}
};

exports.create = (req, res) => {
	// auth state
    var stateKey = 'spotify_auth_state';
    // your application requests refresh and access tokens
    // after checking the state parameter
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

    if (state === null || state !== storedState) {
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            },
            headers: {
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
            },
            json: true
        };

        // Everything good so far, hit API to get use access_token
        request.post(authOptions, function(error, response, body) {
            // on success (we could auth) get stuff about user
            if (!error && response.statusCode === 200) {
                var temp = body;

                var access_token = temp.access_token,
                    refresh_token = temp.refresh_token;

				queues[sessionKey] = {};
				queues[sessionKey]['key'] = sessionKey;
				queues[sessionKey]['access_token'] = access_token;
				queues[sessionKey]['songs'] = [];
				queues[sessionKey]['playing'] = {};
				queues[sessionKey]['sorted'] = true;
				queues[sessionKey]['song_timer'] = undefined;
				queues[sessionKey]['device_id'] = undefined;

				// Log sessions to the console.
				console.log(queues);

                // we can also pass the token to the browser to make requests from there
                // this is so the page renders?
                res.render('create.html', {
                    access_token: access_token,
                    song_list: JSON.stringify(queues[sessionKey]['songs']),
					sessionKey: sessionKey
                });
            } else {
                res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));
            }
        });
    }
};

exports.add = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	//console.log(sessionKey);
	queues[sessionKey]['sorted'] = false;

    var options = {
        url: 'https://api.spotify.com/v1/tracks/' + req.body.uri.split(':')[2],
        headers: {
            'Authorization': 'Bearer ' + req.body.access_token
        },
        json: true
    };

    request.get(options, function(error, response, body) {
        var songInfo = {
            "uri": req.body.uri,
            "name": body.name,
            "artist": body.artists[0].name,
            "duration_ms": body.duration_ms,
            "album_art_url": body.album.images[0].url,
			"votes": 0
        }
        // console.log(body);
        // console.log(body.album.images);

        queues[sessionKey]['songs'].push(songInfo);

        res.render('search.html', {
            access_token: req.body.access_token,
            song_list: JSON.stringify(queues[sessionKey]['songs']),
			sessionKey: sessionKey
        });
    });
};

exports.get_songs = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

	if (sessionKey == 'No key' || queues[sessionKey] == undefined) {
		res.sendStatus(400);
	}

	// Songs are not sorted, sort then go
	if (!queues[sessionKey]['sorted']) {
		queues[sessionKey]['songs'].sort(function(a, b) {
			return b.votes - a.votes;
		});
		queues[sessionKey]['sorted'] = true;
	}

	if (!(sessionKey in queues)) {
		var body = {
	        'playing': 'Nothing yet',
	        'songs': []
	    }
	    res.send(body);
	} else {
		var body = {
	        'playing': queues[sessionKey]['playing'],
	        'songs': queues[sessionKey]['songs']
	    }
	    res.send(body);
	}
};

exports.set_songs = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	//console.log(req.body.userID, req.body.playlistID);

	var options = {
        url: 'https://api.spotify.com/v1/users/' + req.body.userID + '/playlists/' + req.body.playlistID + '/tracks',
        headers: {
            'Authorization': 'Bearer ' + queues[sessionKey]['access_token']
        },
        json: true
    };

    request.get(options, function(error, response, body) {
		//console.log(body);
		for (var i = 0; i < body.items.length; i++) {
			var track = body.items[i].track;
			var songInfo = {
				"uri": track.uri,
				"name": track.name,
				"artist": track.artists[0].name,
				"duration_ms": track.duration_ms,
				"album_art_url": track.album.images[0].url,
				"votes": 0
			}

			queues[sessionKey]['songs'].push(songInfo);
		}
	});

	res.sendStatus(200);
};

function playNext(sessionKey) {

	if (queues[sessionKey]['song_timer'] != undefined) {
    	clearTimeout(queues[sessionKey]['song_timer']);
	}

	// Songs are not sorted, sort then go
	if (!queues[sessionKey]['sorted']) {
		queues[sessionKey]['songs'].sort(function(a, b) {
			return b.votes - a.votes;
		});
		queues[sessionKey]['sorted'] = true;
	}

	var access_token = queues[sessionKey]['access_token'];

    if (queues[sessionKey]['songs'].length != 0) {

        queues[sessionKey]['playing'] = queues[sessionKey]['songs'].shift();
        var length_ms = queues[sessionKey]['playing']['duration_ms'];
        //console.log("Now playing:", playing);
        //console.log("Songs left in playlist:", songs['songs'].length);

        cmd_String = "curl -v -XPUT -H 'Authorization: Bearer " + access_token +
            "' -H 'Content-type: application/json' -d '{\"device_id\": \"" + queues[sessionKey]['device_id'] + "\",\"uris\":[\"" + queues[sessionKey]['playing']['uri'] +"\"]}' \'https://api.spotify.com/v1/me/player/play\'";
        //console.log(cmd_String);
        cmd.run(cmd_String);

        queues[sessionKey]['song_timer'] = setTimeout(playNext, length_ms, sessionKey);

    } else {
        //console.log("Queue is empty");
    }
}

exports.play = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	//console.log(sessionKey);
	if (queues[sessionKey]['song_timer'] != undefined) {
    	clearTimeout(queues[sessionKey]['song_timer']);
	}

    if (queues[sessionKey]['songs'].length != 0) {
        queues[sessionKey]['playing'] = queues[sessionKey]['songs'].shift();
        var length_ms = queues[sessionKey]['playing']['duration_ms'];
        //console.log("Now playing:", queues[sessionKey]['playing']);
        //console.log("Songs left in playlist:", queues[sessionKey]['songs'].length);

        cmd_String = "curl -v -XPUT -H 'Authorization: Bearer " + req.body.access_token +
            "' -H 'Content-type: application/json' -d '{\"device_id\": \"" + queues[sessionKey]['device_id'] + "\",\"uris\":[\"" + queues[sessionKey]['playing']['uri'] +"\"]}' \'https://api.spotify.com/v1/me/player/play\'";

        cmd.run(cmd_String);

        queues[sessionKey]['song_timer'] = setTimeout(playNext, length_ms, sessionKey);

    } else {
        //console.log("Add some songs to play!");
    }
    res.sendStatus(200);
};

exports.setDevice = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['device_id'] = req.body.device_id;
	console.log('device id set to', req.body.device_id);
	res.sendStatus(200);
};

exports.upvote = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['sorted'] = false;
	//console.log("up-voted song was: ", req.body.uri);
	//console.log(sessionKey);
	var uri = req.body.uri;
	for (var i = 0; i < queues[sessionKey]['songs'].length; i++) {
		//console.log(queues[sessionKey]['songs'][i]);
		if (queues[sessionKey]['songs'][i]['uri'] == uri) {
			queues[sessionKey]['songs'][i]['votes']++;
			//console.log(queues[sessionKey]['songs'][i]['name'], "at", queues[sessionKey]['songs'][i]['votes'])
		}
	}
	res.sendStatus(200);
};

exports.downvote = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['sorted'] = false;
	//console.log("down-voted song was: ", req.body.uri);
	//console.log(sessionKey);
	var uri = req.body.uri;
	for (var i = 0; i < queues[sessionKey]['songs'].length; i++) {
		//console.log(queues[sessionKey]['songs'][i]);
		if (queues[sessionKey]['songs'][i]['uri'] == uri) {
			queues[sessionKey]['songs'][i]['votes']--;
			//console.log(queues[sessionKey]['songs'][i]['name'], "at", queues[sessionKey]['songs'][i]['votes'])
		}
	}
	res.sendStatus(200);
};

exports.join = (req, res) => {
    res.render('join.html');
};

 exports.setup = (req,res) => {
    res.render('setup.html');
};
