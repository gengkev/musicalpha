/*
	Be warned, it's pretty hacky and doesn't really separate functionality from UI
*/


function getXt(cb){
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "http://music.google.com/music/listen?u=0", true);
	xhr.onload = function(){
		chrome.cookies.get({
			url: 'http://music.google.com/music', 
			name: 'xt'
		}, function(info){
			cb(info.value);
		})
	}
	xhr.send(null);
}


function modifyEntries(xt, json, cb){
	var xhr = new XMLHttpRequest();
	xhr.open("POST", "http://music.google.com/music/services/modifyentries?u=0&xt="+xt, true);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	xhr.onload = function(){
		var json = JSON.parse(xhr.responseText);
		console.log(json);
		cb();
		console.assert(json.success == true);
	}
	xhr.send('json='+encodeURIComponent(JSON.stringify({
		entries: [
			json
		]
	})))
}
function measureDuration(f, cb){
	var url;
  if(window.createObjectURL){
    url = window.createObjectURL(f)
  }else if(window.createBlobURL){
    url = window.createBlobURL(f)
  }else if(window.URL && window.URL.createObjectURL){
    url = window.URL.createObjectURL(f)
  }else if(window.webkitURL && window.webkitURL.createObjectURL){
    url = window.webkitURL.createObjectURL(f)
  }
	var a = new Audio(url);
	a.addEventListener('loadedmetadata', function(){
		console.log("Measured Duration", a.duration);
		cb(Math.floor(a.duration * 1000)); //milliseconds because well, thats what google uses
	}, false);
}
function startUpload(file){
	console.log(file);
	
	var stage = 0, stages = 5;
	measureDuration(file, function(millis){
		document.getElementById('upload').value = 0.03;
		ID3v2.parseFile(file, function(tags){
			document.getElementById('upload').value = 0.06;
			getXt(function(xt){
				document.getElementById('upload').value = 0.09;
				uploadFile(file, function(file_id){
					var startTime = +new Date, delta = 1500, end = startTime + delta;
					(function(){
						if(+new Date < end){
							document.getElementById('upload').value = 0.90 + 0.1 * (+new Date - startTime)/delta;
							setTimeout(arguments.callee, 100)
						}
					})();
					setTimeout(function(){

						superxt = xt;
						var tracks = "", tracktotal = "";
						if(tags['Track number'].split('/').length == 2){
							tracks = tags['Track number'].split('/')[0]
							tracktotal = tags['Track number'].split('/')[1]
						}else if(/^\d+$/.test(tags['Track number'])){
							tracks = tags['Track number']
						}
						
						metadata = {
							"genre": tags.Genre|| '',
							"beatsPerMinute":0,
							"albumArtistNorm":"",
							"album": tags.Album|| '',
							"artistNorm":"",
							"lastPlayed": (+new Date)*1000,
							"durationMillis": millis,
							"url":"",
							"id": file_id,
							"composer":"",
							"creationDate": (+new Date)*1000,
							"title":tags.Title|| '',
							"albumArtist":tags.Artist|| '',
							"playCount":0,
							"name":tags.Title|| '',
							"artist":tags.Artist|| '',
							"titleNorm":"",
							"rating":0,
							"comment":"",
							"albumNorm":"",
							"year":tags.Year || '',
							"track":tracks,
							"totalTracks":tracktotal,
							"disc":"",
							"totalDiscs":""
						};
						modifyEntries(xt, metadata, function(){
							document.getElementById('upload').value = 1;
						});
					}, 1500); //wait a second for google to do magic
				})
			});
		})
	});
}

function uploadFile(file, cb){
	var file_id = 'antimatter15-'+Math.random().toString(16).substr(2)+'-'+Math.random().toString(16).substr(2);
	console.log('Created file ID', file_id);
	var xhr = new XMLHttpRequest();
	xhr.open('POST', 'http://uploadsj.clients.google.com/uploadsj/rupio', true);
	xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
	xhr.onload = function(){
		var json = JSON.parse(xhr.responseText);
		var transfer = json.sessionStatus.externalFieldTransfers[0];
		var url = transfer.putInfo.url;
		xhr.open('PUT', url, true);
		xhr.onload = function(){ //a callback within a callback! callbackception!
			console.log("Yay Done Uploading");
			var json = JSON.parse(xhr.responseText);
			console.assert(json.sessionStatus.state == "FINALIZED");
			cb(file_id, json);
		}
		xhr.upload.addEventListener('progress', function(evt){
  		document.getElementById('upload').value = (evt.loaded/evt.total) * 0.8 + 0.1;
	  }, false)
		
		xhr.setRequestHeader('Content-Type', transfer.content_type);
		xhr.send(file);
	}
	xhr.send(JSON.stringify(

		{
	"clientId": "Jumper Uploader",
	"createSessionRequest": {
		"fields": [
			{
				"inlined": {
					"content": "jumper-uploader-title-18468",
					"contentType": "text/plain",
					"name": "title"
				}
			},
			{
				"external": {
							"filename": file.fileName,
							"name": file.fileName,
							"put": {},
							"size": file.fileSize
				}
			},
			{
				"inlined": {
					"content": "0",
					"name": "AlbumArtLength"
				}
			},
			{
				"inlined": {
					"content": "0",
					"name": "AlbumArtStart"
				}
			},
			{
				"inlined": {
					"content": Math.random().toString(16).substr(2),
					"name": "ClientId"
				}
			},
			{
				"inlined": {
					"content": "00:11:22:33:44:55",
					"name": "MachineIdentifier"
				}
			},
			{
				"inlined": {
					"content": file_id,
					"name": "ServerId"
				}
			},
			{
				"inlined": {
					"content": "true",
					"name": "SyncNow"
				}
			},
			{
				"inlined": {
					"content": "153",
					"name": "TrackBitRate"
				}
			},
			{
				"inlined": {
					"content": "false",
					"name": "TrackDoNotRematch"
				}
			}
		]
	},
	"protocolVersion": "0.8"
}
	))
}
