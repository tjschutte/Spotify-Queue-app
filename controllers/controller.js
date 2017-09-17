const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const request = require('request'); // "Request" library
const cmd = require('node-cmd');
const config = require('../config.json');

// Application specific stuff. From https://developer.spotify.com/
const client_id = config.client_id; // Your client id
const client_secret = config.client_secret; // Your secret
const redirect_uri = config.redirect_uri; // Your redirect uri

const miliseconds_in_minute = 60000;
const refresh_wait = 55;

// Holds state information about each queue
var queues = queues || {};
exports.queues = queues;

exports.search = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

	if (sessionKey == undefined || sessionKey == 'No key' || queues[sessionKey] == undefined){
		res.render('error.html');
		return;
	}

    res.render('search.html', {
        access_token: queues[sessionKey]['access_token'],
        song_list: JSON.stringify( queues[sessionKey]['songs']),
		sessionKey: sessionKey
    });

};

exports.findQueue = (req, res) => {
	if (req.body.sessionKey in queues) {
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

				queues[sessionKey] = {}; // Empty session state.  Should hold everything a session needs
				queues[sessionKey]['key'] = sessionKey; // Corresponding key
				queues[sessionKey]['access_token'] = access_token; // Premium account access_token
				queues[sessionKey]['refresh_token'] = refresh_token; // Premium account refresh_token
				queues[sessionKey]['refresh_count'] = 0; // Number of times tokens have been refreshed
				// Keep the session alive. Refresh every 55 minutes (keys expire after 1 hour)
				queues[sessionKey]['refresh'] = setTimeout(refresh_tokens, (miliseconds_in_minute * refresh_wait), sessionKey);
				queues[sessionKey]['songs'] = []; // Songs in queue
				queues[sessionKey]['playing'] = {}; // Currently playing song information
				queues[sessionKey]['sorted'] = true; // If the song list has been sorted (by votes)
				queues[sessionKey]['song_timer'] = undefined; // Timer till we push next song
				queues[sessionKey]['device_id'] = undefined; // ID of playback device for this session

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
            'Authorization': 'Bearer ' + queues[sessionKey]['access_token']
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

        queues[sessionKey]['songs'].push(songInfo);

        res.render('search.html', {
            access_token: queues[sessionKey]['access_token'],
            song_list: JSON.stringify(queues[sessionKey]['songs']),
			sessionKey: sessionKey
        });
    });
};

exports.get_songs = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

	if (sessionKey == 'No key' || queues[sessionKey] == undefined || queues[sessionKey]['sorted'] == undefined) {
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
	var playlistLength;
	var offset = req.body.offset || 0;
	req.body.offset = offset;

	var options = {
        url: 'https://api.spotify.com/v1/users/' + req.body.userID + '/playlists/' + req.body.playlistID + '/tracks?offset=' + offset,
        headers: {
            'Authorization': 'Bearer ' + queues[sessionKey]['access_token']
        },
        json: true
    };

    request.get(options, function(error, response, body) {
		if (body.items != undefined) {
			playlistLength = body.total;
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
		} else {
			console.log(error, response);
			res.sendStatus(400);
		}

		if (playlistLength > 100 && offset < (playlistLength - 100)) {
			req.body.offset += 100;
			module.exports.set_songs(req, res);
		} else {
			res.sendStatus(200);
		}
	});
};

exports.end = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	if (queues[sessionKey] != undefined) {

		try {
			console.log('Expiring session:', sessionKey);
			console.log('Clearing timeout...');
			clearTimeout(queues[sessionKey]['refresh']);
			console.log('Removing Queue...');
			delete queues[sessionKey];
		} catch (TypeError) {  }

	}
	res.sendStatus(200);
}

function refresh_tokens(sessionKey) {
	if (queues[sessionKey] == undefined) {
		return;
	}

	// If session is more than 3 hours old... kill it. They have had enough.
	if (queues[sessionKey]['refresh_count'] > 5) {
		console.log('Expiring session:', sessionKey);
		delete queues[sessionKey];
		console.log(queues);
		return;
	}

	queues[sessionKey]['refresh'] = setTimeout(refresh_tokens, (miliseconds_in_minute * refresh_wait), sessionKey);
	var refresh_token = queues[sessionKey]['refresh_token'];
	queues[sessionKey]['refresh_count']++;

    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };
    request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            queues[sessionKey]['access_token'] = body.access_token;
        } else {
			console.log(error);
		}
    });
};

exports.get_tokens = (req, res) => {
		var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
		var body = {
	        'access_token' : queues[sessionKey]['access_token'],
	        'refresh_token': queues[sessionKey]['refresh_token'],
			'sessionKey'   : sessionKey
	    }
	    res.send(body);
}

function playNext(sessionKey) {

	try {
		clearTimeout(queues[sessionKey]['song_timer']);
	} catch (TypeError) {
		return;
	}

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

        cmd_String = "curl -v -XPUT -i -H 'Authorization: Bearer " + access_token +
            "' -H 'Content-type: application/json' -H 'Connection: close' -d '{\"device_id\": \"" + queues[sessionKey]['device_id'] + "\",\"uris\":[\"" + queues[sessionKey]['playing']['uri'] +"\"]}' \'https://api.spotify.com/v1/me/player/play\'";

		// Run the command. If it fails attempt to resolve and try again.
		var retry = false;
		do {
			cmd.get(cmd_String, function(err, data, stderr) {
				retry = false;
				var status_code = data.split(' ')[1];
				// if the session token is stale, get a new one
				if (status_code == '401') {
					refresh_tokens(sessionKey);
					retry = true;
					console.log(err, data, stderr);
				}
			});
		} while (retry);

        queues[sessionKey]['song_timer'] = setTimeout(playNext, length_ms, sessionKey);

    } else {
        //console.log("Queue is empty");
    }
}

exports.play = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';

	if (queues[sessionKey]['song_timer'] != undefined) {
    	clearTimeout(queues[sessionKey]['song_timer']);
	}

    if (queues[sessionKey]['songs'].length != 0) {
        queues[sessionKey]['playing'] = queues[sessionKey]['songs'].shift();
        var length_ms = queues[sessionKey]['playing']['duration_ms'];

        cmd_String = "curl -v -XPUT -i -H 'Authorization: Bearer " + req.body.access_token +
            "' -H 'Content-type: application/json' -H 'Connection: close' -d '{\"device_id\": \"" + queues[sessionKey]['device_id'] + "\",\"uris\":[\"" + queues[sessionKey]['playing']['uri'] +"\"]}' \'https://api.spotify.com/v1/me/player/play\'";

		// Run the command. If it fails attempt to resolve and try again.
		var retry = false;
		do {
	        cmd.get(cmd_String, function(err, data, stderr) {
				retry = false;
				var status_code = data.split(' ')[1];
				// if the session token is stale, get a new one
				if (status_code == '401') {
					refresh_tokens(sessionKey);
					retry = true;
					console.log(err, data, stderr);
				}
			});
		} while (retry);

        queues[sessionKey]['song_timer'] = setTimeout(playNext, length_ms, sessionKey);

    } else {
        //console.log("Add some songs to play!");
    }
    res.sendStatus(200);
};

exports.setDevice = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['device_id'] = req.body.device_id;
	res.sendStatus(200);
};

exports.upvote = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['sorted'] = false;

	var uri = req.body.uri;
	for (var i = 0; i < queues[sessionKey]['songs'].length; i++) {
		if (queues[sessionKey]['songs'][i]['uri'] == uri) {
			queues[sessionKey]['songs'][i]['votes']++;
		}
	}
	res.sendStatus(200);
};

exports.downvote = (req, res) => {
	var sessionKey = req.cookies ? req.cookies['sessionKey'] : 'No key';
	queues[sessionKey]['sorted'] = false;

	var uri = req.body.uri;
	for (var i = 0; i < queues[sessionKey]['songs'].length; i++) {
		if (queues[sessionKey]['songs'][i]['uri'] == uri) {
			queues[sessionKey]['songs'][i]['votes']--;
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

exports.capacity = (req, res) => {
	res.render('capacity.html');
}
