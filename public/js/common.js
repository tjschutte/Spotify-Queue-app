// When the document has loaded, add some listeners to the search objects
$(document).ready(function() {
	get_tokens();
	$('#search-text-box').keydown(function(event) {
		if (event.keyCode == 13) {
			search();
		}
	});
});

var access_token;
var sessionKey;
var displayMode;
var votes = [];

function showKey() {
	$('#search-results').html("<h3 class='text-center'>Your session key is: " + sessionKey + "</h3>");
}

function display() {
	$('#search-text-box').hide();
	$('#search-button').hide();
	$('#show-playlist-button').hide();
	showMeWhatYouGot();
	$('#page').click(function() {
		$('#search-text-box').show();
		$('#search-button').show();
		$('#show-playlist-button').show();
	});
}

function showCommands() {
	$('#search-results').html(
		"\
		<h3 class='text-center'>\
			Valid commands are: </br>\
			!showkey - show your session key so others may join</br>\
			!display - turn display mode on\
			!commands - show this help messege</br>\
		</h3>");
}

function command(commandString) {
	var cmd = commandString.substring(1).toLowerCase();
	switch (cmd) {
		case "display":
		case "display()":
			display();
			break;
		case "showkey":
		case "showkey()":
			showKey();
			break;
		case "commands":
		case "commands()":
			showCommands();
			break;
		default:
			console.log("Invalid command:", cmd);
			$('#search-results').html("<h3 class='text-center'>Invalid Command: '\
			" + cmd + "' use '!commands' for help</h3>");
			break;
	}
}

function search() {
	// Cancel displayMode
	clearTimeout(displayMode);
	// Get the search terms
	var params = $('#search-text-box').val();
	// clear the text box
	$('#search-text-box').val("");

	if (params.charAt() === "!") {
		command(params);
		return;
	}

	// setup the querystring (remove spaces)
	var query = "?q=" + params.replace(/ /g, '+') + "&type=track&markert=US&limit=10";

	if (!params || 0 === params.length || !params.trim()) {
		$('#search-results').html("<h2>Type something in the search box first.</h2>");
		return;
	}

	$.ajax({
		type: "GET",
		url: 'https://api.spotify.com/v1/search' + query,
		headers: {
			'Authorization': 'Bearer ' + access_token
		},
		success: function(response) {
			var html;
			if (response.tracks.items.length != 0) {
				html =
					"<table style='width:100%' class='table-fill'> \
						<thead>\
							<th style='width:45%'>Song</th>\
							<th style='width:45%'>Artist</th>\
							<th style='width:10%'>Add</th>\
						</thead>";
				for (var i = 0; i < response.tracks.items.length; i++) {
					var item = response.tracks.items[i];
					html += "<tbody class='table-hover'>\
								<tr>" +
						"<td>" + item.name + "</td>\
									<td>" + item.artists[0].name + "</td>\
									<td class='text-center'>" +
						"<button class='add-button' onclick=addSong('" + item.uri + "')>Add</button>\
									</td>\
								</tr>\
							</tbody>";
				}
				html += "</table>";

			} else {
				html = "<h3 class='text-center'>We couldn't find the song you are looking for.</h3>"
			}
			$('#search-results').html(html);

		},
		error: function(error) {
			console.log(error);
		}
	});

}

function addSong(uri) {
	$.ajax({
		type: 'POST',
		data: JSON.stringify({
			"uri": uri,
			access_token: access_token
		}),
		contentType: 'application/json',
		url: '/add',
		error: function(xhr, textStatus, err) {
			console.log("readyState: " + xhr.readyState);
			console.log("responseText: " + xhr.responseText);
			console.log("status: " + xhr.status);
			console.log("text status: " + textStatus);
			console.log("error: " + err);
		},
		success: function() {
			$('#search-results').html("<h2 class='text-center'>Song Added!</h2>");
		}
	});
}

function showMeWhatYouGot() {
	$.ajax({
		type: 'GET',
		url: '/get_songs',
		error: function(xhr, textStatus, err) {
			clearTimeout(displayMode);
		},
		success: function(body) {
			var playing = body.playing;
			var queue = body.songs;

			if (queue.length > 0 || playing) {
				var html = "";
				if (playing != undefined && playing.name != undefined) {
					html +=
						"<h2 class='text-center'>Now playing</h2>\
							<table style='width:100%'>\
								<tr>\
									<th style='width:30%'></th>\
									<th style='width:35%'>Song</th>\
									<th style='width:35%'>Artist</th>\
								</tr>\
								<tr>\
									<td><img style='max-width: 100%' src=\"" +
						playing.album_art_url + "\"/></td>\
									<td><h4>" + playing.name + "</h4></td>\
									<td><h4>" + playing.artist +
						"</h4></td>\
								<tr>\
							</table>";
				}
				if (queue.length > 0) {
					html +=
						"<h2 class='text-center'>Coming up</h2>\
						<table style='width:100%'> \
							<tr>\
								<th style='width:30%'></th>\
								<th style='width:30%'>Song</th>\
								<th style='width:30%'>Artist</th>\
								<th style='width:10%'>Votes</th>\
							</tr>";
					for (var i = 0; i < queue.length; i++) {
						var item = queue[i];
						html += "<tr>\
									<td><img style='max-width: 100%' src=\"" + item.album_art_url + "\"/></td>\
									<td><h4>" + item.name +
							"</h4></td>\
									<td><h4>" + item.artist +
							"</h4></td>\
									<td>\
										<div class='input-group stylish-input-group'>\
											<span class='input-group-addon'>\
												<button type='button' onclick=tryUpvote('" + item.uri +
							"')><span class='glyphicon glyphicon-arrow-up'></span></button></br>\
												<button type='button' onclick=tryDownvote('" + item.uri +
							"')><span class='glyphicon glyphicon-arrow-down'></span></button>\
											</span>\
										</div>\
										<h4 class='text-center'>" + item.votes + "</h4>\
									</td>\
								</tr>";
					}
					html += "</table>";
				}

			} else {
				html = "<h2 class='text-center'>Hmmm... Nothing queued up.</h2>"
			}

			$('#search-results').html(html);
		}
	});
	displayMode = setTimeout(showMeWhatYouGot, 2000);
}

function tryUpvote(uri) {
	if ($.inArray(uri, votes) != -1) {
		return;
	} else {
		$.ajax({
			type: 'POST',
			data: JSON.stringify({
				"uri": uri,
				"sessionKey": sessionKey
			}),
			contentType: 'application/json',
			url: '/upvote',
			error: function(xhr, textStatus, err) {
				console.log("readyState: " + xhr.readyState);
				console.log("responseText: " + xhr.responseText);
				console.log("status: " + xhr.status);
				console.log("text status: " + textStatus);
				console.log("error: " + err);
			},
			success: function() {
				votes.push(uri);
				console.log(votes);
			}
		});
	}
}

function tryDownvote(uri) {
	if ($.inArray(uri, votes) != -1) {
		return;
	} else {
		$.ajax({
			type: 'POST',
			data: JSON.stringify({
				"uri": uri,
				"sessionKey": sessionKey
			}),
			contentType: 'application/json',
			url: '/downvote',
			error: function(xhr, textStatus, err) {
				console.log("readyState: " + xhr.readyState);
				console.log("responseText: " + xhr.responseText);
				console.log("status: " + xhr.status);
				console.log("text status: " + textStatus);
				console.log("error: " + err);
			},
			success: function() {
				votes.push(uri);
				console.log(votes);
			}
		});
	}
}

function get_tokens() {
	$.ajax({
		type: 'get',
		contentType: 'application/json',
		url: '/get_tokens',
		error: function(xhr, textStatus, err) {
			console.log("readyState: " + xhr.readyState);
			console.log("responseText: " + xhr.responseText);
			console.log("status: " + xhr.status);
			console.log("text status: " + textStatus);
			console.log("error: " + err);
		},
		success: function(response) {
			access_token = response.access_token;
			sessionKey = response.sessionKey;
		}
	});
}
