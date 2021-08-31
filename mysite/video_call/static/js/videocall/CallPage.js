var username_data;
username_data = document.getElementById("label-username").textContent;

setTimeout(() => {
  onEnter(username_data);
}, 1000);

var mapPeers = {};

function onEnter(username_1) {
  username = username_1;

  webSocket = new WebSocket(endPoint);

  webSocket.onopen = function (e) {
    console.log("Connection opened! ", e);

    sendSignal("new-peer", {
      local_screen_sharing: false,
    });
  };
  webSocket.onmessage = webSocketOnMessage;

  webSocket.onclose = function (e) {
    console.log("Connection closed! ", e);
  };

  webSocket.onerror = function (e) {
    console.log("Error occured! ", e);
  };

  btnSendMsg.disabled = false;
  messageInput.disabled = false;
}

var mapScreenPeers = {};

var screenShared = false;

const localVideo = document.querySelector("#local-video");

var btnShareScreen = document.querySelector("#btn-share-screen");

var localStream = new MediaStream();

var localDisplayStream = new MediaStream();

btnToggleAudio = document.querySelector("#btn-toggle-audio");
btnToggleVideo = document.querySelector("#btn-toggle-video");

var messageInput = document.querySelector("#msg");
var btnSendMsg = document.querySelector("#btn-send-msg");

var ul = document.querySelector("#message-list");

var loc = window.location;

var endPoint = "";
var wsStart = "ws://";

if (loc.protocol == "https:") {
  wsStart = "wss://";
}

var endPoint = wsStart + loc.host + loc.pathname;

console.log(endPoint);

var webSocket;

var username;

var btn_Join = document.querySelector("#btn_join");

function webSocketOnMessage(event) {
  var parsedData = JSON.parse(event.data);

  var action = parsedData["action"];

  var peerUsername = parsedData["peer"];

  console.log("peerUsername: ", peerUsername);
  console.log("action: ", action);

  if (peerUsername == username) {
    return;
  }

  var remoteScreenSharing = parsedData["message"]["local_screen_sharing"];
  console.log("remoteScreenSharing: ", remoteScreenSharing);

  var receiver_channel_name = parsedData["message"]["receiver_channel_name"];
  console.log("receiver_channel_name: ", receiver_channel_name);

  if (action == "new-peer") {
    console.log("New peer: ", peerUsername);

    createOfferer(
      peerUsername,
      false,
      remoteScreenSharing,
      receiver_channel_name
    );

    if (screenShared && !remoteScreenSharing) {
      console.log("Creating screen sharing offer.");
      createOfferer(
        peerUsername,
        true,
        remoteScreenSharing,
        receiver_channel_name
      );
    }

    return;
  }

  var localScreenSharing = parsedData["message"]["remote_screen_sharing"];

  if (action == "new-offer") {
    console.log("Got new offer from ", peerUsername);

    var offer = parsedData["message"]["sdp"];
    console.log("Offer: ", offer);
    var peer = createAnswerer(
      offer,
      peerUsername,
      localScreenSharing,
      remoteScreenSharing,
      receiver_channel_name
    );

    return;
  }

  if (action == "new-answer") {
    var peer = null;

    if (remoteScreenSharing) {
      peer = mapPeers[peerUsername + " Screen"][0];
    } else if (localScreenSharing) {
      peer = mapScreenPeers[peerUsername][0];
    } else {
      peer = mapPeers[peerUsername][0];
    }

    var answer = parsedData["message"]["sdp"];

    console.log("mapPeers:");
    for (key in mapPeers) {
      console.log(key, ": ", mapPeers[key]);
    }

    console.log("peer: ", peer);
    console.log("answer: ", answer);

    peer.setRemoteDescription(answer);

    return;
  }
}

messageInput.addEventListener("keyup", function (event) {
  if (event.keyCode == 13) {
    event.preventDefault();

    btnSendMsg.click();
  }
});

btnSendMsg.onclick = btnSendMsgOnClick;

function btnSendMsgOnClick() {
  if (messageInput.value === "" || messageInput.value === null) {
    return;
  } else {
    var message = messageInput.value;
  }

  var li = document.createElement("li");
  if (username == "" || username == null || username == undefined) {
    li.style.backgroundColor = "#3c525e";
    li.style.padding = "5px";
    li.style.border = "5px solid #3c525e";
    li.style.borderRadius = "px";
    li.style.marginBottom = "4%";
    li.appendChild(document.createTextNode("Me: " + message));
  } else {
    li.style.backgroundColor = "#3c525e";
    li.style.padding = "5px";
    li.style.color = "#ffff";
    li.style.border = "5px solid #3c525e";
    li.style.borderRadius = "6px";
    li.style.marginBottom = "4%";
    li.style.display = "flex";
    li.style.position = "relative";
    li.style.marginRight = "8%";
    li.style.marginLeft = "8%";
    li.appendChild(document.createTextNode(username + ": " + message));
  }

  ul.appendChild(li);

  var dataChannels = getDataChannels();

  console.log("Sending: ", message);

  for (index in dataChannels) {
    dataChannels[index].send(username + ": " + message);
  }

  messageInput.value = "";
}

const constraints = {
  video: true,
  audio: true,
};

userMedia = navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
  localStream = stream;
  console.log("Got MediaStream:", stream);
  var mediaTracks = stream.getTracks();

  for (i = 0; i < mediaTracks.length; i++) {
    console.log(mediaTracks[i]);
  }

  localVideo.srcObject = localStream;
  localVideo.muted = true;

  window.stream = stream;

  audioTracks = stream.getAudioTracks();
  videoTracks = stream.getVideoTracks();

  audioTracks[0].enabled = false;
  videoTracks[0].enabled = false;

  var unmute_icon = document.getElementById("unmute_icon");

  btnToggleAudio.onclick = function () {
    audioTracks[0].enabled = !audioTracks[0].enabled;
    if (audioTracks[0].enabled) {
      unmute_icon.name = "mic-outline";
      return;
    }

    unmute_icon.name = "mic-off-outline";
  };

  var video_icn = document.getElementById("video_icn");

  btnToggleVideo.onclick = function () {
    videoTracks[0].enabled = !videoTracks[0].enabled;
    if (videoTracks[0].enabled) {
      video_icn.name = "videocam-outline";
      return;
    }
    video_icn.name = "videocam-off-outline";
  };
});

function sendSignal(action, message) {
  webSocket.send(
    JSON.stringify({
      peer: username,
      action: action,
      message: message,
    })
  );
}

function createOfferer(
  peerUsername,
  localScreenSharing,
  remoteScreenSharing,
  receiver_channel_name
) {
  var peer = new RTCPeerConnection(null);

  addLocalTracks(peer, localScreenSharing);

  var dc = peer.createDataChannel("channel");
  dc.onopen = () => {
    console.log("Connection opened.");
  };
  var remoteVideo = null;
  if (!localScreenSharing && !remoteScreenSharing) {
    dc.onmessage = dcOnMessage;

    remoteVideo = createVideo(peerUsername);
    setOnTrack(peer, remoteVideo);
    console.log("Remote video source: ", remoteVideo.srcObject);

    mapPeers[peerUsername] = [peer, dc];

    peer.oniceconnectionstatechange = () => {
      var iceConnectionState = peer.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        console.log("Deleting peer");
        delete mapPeers[peerUsername];
        if (iceConnectionState != "closed") {
          peer.close();
        }
        removeVideo(remoteVideo);
      }
    };
  } else if (!localScreenSharing && remoteScreenSharing) {
    dc.onmessage = (e) => {
      console.log("New message from %s's screen: ", peerUsername, e.data);
    };

    remoteVideo = createVideo(peerUsername + "-screen");
    setOnTrack(peer, remoteVideo);
    console.log("Remote video source: ", remoteVideo.srcObject);

    mapPeers[peerUsername + " Screen"] = [peer, dc];

    peer.oniceconnectionstatechange = () => {
      var iceConnectionState = peer.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        delete mapPeers[peerUsername + " Screen"];
        if (iceConnectionState != "closed") {
          peer.close();
        }
        removeVideo(remoteVideo);
      }
    };
  } else {
    dc.onmessage = (e) => {
      console.log("New message from %s: ", peerUsername, e.data);
    };

    mapScreenPeers[peerUsername] = [peer, dc];

    peer.oniceconnectionstatechange = () => {
      var iceConnectionState = peer.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        delete mapScreenPeers[peerUsername];
        if (iceConnectionState != "closed") {
          peer.close();
        }
      }
    };
  }

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(
        "New Ice Candidate! Reprinting SDP" +
          JSON.stringify(peer.localDescription)
      );
      return;
    }

    console.log("Gathering finished! Sending offer SDP to ", peerUsername, ".");
    console.log("receiverChannelName: ", receiver_channel_name);

    sendSignal("new-offer", {
      sdp: peer.localDescription,
      receiver_channel_name: receiver_channel_name,
      local_screen_sharing: localScreenSharing,
      remote_screen_sharing: remoteScreenSharing,
    });
  };

  peer
    .createOffer()
    .then((o) => peer.setLocalDescription(o))
    .then(function (event) {
      console.log("Local Description Set successfully.");
    });

  console.log("mapPeers[", peerUsername, "]: ", mapPeers[peerUsername]);

  return peer;
}

function createAnswerer(
  offer,
  peerUsername,
  localScreenSharing,
  remoteScreenSharing,
  receiver_channel_name
) {
  var peer = new RTCPeerConnection(null);

  addLocalTracks(peer, localScreenSharing);

  if (!localScreenSharing && !remoteScreenSharing) {
    var remoteVideo = createVideo(peerUsername);

    setOnTrack(peer, remoteVideo);

    peer.ondatachannel = (e) => {
      console.log("e.channel.label: ", e.channel.label);
      peer.dc = e.channel;
      peer.dc.onmessage = dcOnMessage;
      peer.dc.onopen = () => {
        console.log("Connection opened.");
      };

      mapPeers[peerUsername] = [peer, peer.dc];
    };

    peer.oniceconnectionstatechange = () => {
      var iceConnectionState = peer.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        delete mapPeers[peerUsername];
        if (iceConnectionState != "closed") {
          peer.close();
        }
        removeVideo(remoteVideo);
      }
    };
  } else if (localScreenSharing && !remoteScreenSharing) {
    peer.ondatachannel = (e) => {
      peer.dc = e.channel;
      peer.dc.onmessage = (evt) => {
        console.log("New message from %s: ", peerUsername, evt.data);
      };
      peer.dc.onopen = () => {
        console.log("Connection opened.");
      };

      mapScreenPeers[peerUsername] = [peer, peer.dc];

      peer.oniceconnectionstatechange = () => {
        var iceConnectionState = peer.iceConnectionState;
        if (
          iceConnectionState === "failed" ||
          iceConnectionState === "disconnected" ||
          iceConnectionState === "closed"
        ) {
          delete mapScreenPeers[peerUsername];
          if (iceConnectionState != "closed") {
            peer.close();
          }
        }
      };
    };
  } else {
    var remoteVideo = createVideo(peerUsername + "-screen");

    setOnTrack(peer, remoteVideo);

    peer.ondatachannel = (e) => {
      peer.dc = e.channel;
      peer.dc.onmessage = (evt) => {
        console.log("New message from %s's screen: ", peerUsername, evt.data);
      };
      peer.dc.onopen = () => {
        console.log("Connection opened.");
      };

      mapPeers[peerUsername + " Screen"] = [peer, peer.dc];
    };
    peer.oniceconnectionstatechange = () => {
      var iceConnectionState = peer.iceConnectionState;
      if (
        iceConnectionState === "failed" ||
        iceConnectionState === "disconnected" ||
        iceConnectionState === "closed"
      ) {
        delete mapPeers[peerUsername + " Screen"];
        if (iceConnectionState != "closed") {
          peer.close();
        }
        removeVideo(remoteVideo);
      }
    };
  }

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(
        "New Ice Candidate! Reprinting SDP" +
          JSON.stringify(peer.localDescription)
      );
      return;
    }

    console.log(
      "Gathering finished! Sending answer SDP to ",
      peerUsername,
      "."
    );
    console.log("receiverChannelName: ", receiver_channel_name);

    sendSignal("new-answer", {
      sdp: peer.localDescription,
      receiver_channel_name: receiver_channel_name,
      local_screen_sharing: localScreenSharing,
      remote_screen_sharing: remoteScreenSharing,
    });
  };

  peer
    .setRemoteDescription(offer)
    .then(() => {
      console.log("Set offer from %s.", peerUsername);
      return peer.createAnswer();
    })
    .then((a) => {
      console.log("Setting local answer for %s.", peerUsername);
      return peer.setLocalDescription(a);
    })
    .then(() => {
      console.log("Answer created for %s.", peerUsername);
      console.log("localDescription: ", peer.localDescription);
      console.log("remoteDescription: ", peer.remoteDescription);
    })
    .catch((error) => {
      console.log("Error creating answer for %s.", peerUsername);
      console.log(error);
    });

  return peer;
}

function dcOnMessage(event) {
  var message = event.data;

  var li = document.createElement("li");
  li.appendChild(document.createTextNode(message));
  li.style.backgroundColor = "#d6cec8";
  li.style.padding = "5px";
  li.style.display = "flex";
  li.style.position = "relative";
  li.style.border = "5px solid #d6cec8";
  li.style.borderRadius = "6px";
  li.style.marginTop = "5px";
  li.style.marginBottom = "4%";
  li.style.marginLeft = "30%";
  li.style.width = "maximum-content";
  ul.appendChild(li);
}

function getDataChannels() {
  var dataChannels = [];

  for (peerUsername in mapPeers) {
    console.log("mapPeers[", peerUsername, "]: ", mapPeers[peerUsername]);
    var dataChannel = mapPeers[peerUsername][1];
    console.log("dataChannel: ", dataChannel);

    dataChannels.push(dataChannel);
  }

  return dataChannels;
}

function getPeers(peerStorageObj) {
  var peers = [];

  for (peerUsername in peerStorageObj) {
    var peer = peerStorageObj[peerUsername][0];
    console.log("peer: ", peer);

    peers.push(peer);
  }

  return peers;
}

function createVideo(peerUsername) {
  var videoContainer = document.querySelector("#video-container");

  console.log("Other User: ", peerUsername);

  var remoteVideo = document.createElement("video");

  var other_user = document.createElement("user_details");

  var video_region_2 = document.getElementById("video-container-2");
  video_region_2.style.display = "none";

  remoteVideo.id = peerUsername + "-video";
  remoteVideo.autoplay = true;
  remoteVideo.playsinline = true;

  var videoWrapper = document.createElement("video_region_2");

  other_user.style.display = "flex";
  other_user.style.width = "25vh";
  other_user.style.height = "6%";
  other_user.style.float = "left";
  other_user.style.fontFamily = "arial";
  other_user.style.fontWeight = "550";
  other_user.style.color = "#fff";
  other_user.style.borderRadius = "5px";
  other_user.style.marginTop = "4px";
  other_user.style.marginLeft = "10px";
  other_user.style.fontSize = "16px";
  other_user.style.alignItems = "center";
  other_user.style.textAlign = "center";

  videoWrapper.style.height = "74vh";
  videoWrapper.style.width = "fit-content";
  videoWrapper.style.backgroundColor = "#000";
  videoWrapper.style.borderRadius = "10px";
  videoWrapper.style.boxShadow = "2px 2px 12px rgba(0, 0, 0, 0.2)";
  videoWrapper.style.display = "inline";
  videoWrapper.style.marginLeft = "104%";
  videoWrapper.style.marginTop = "0.4%";
  videoWrapper.style.position = "absolute";
  videoWrapper.style.float = "left";

  videoContainer.appendChild(videoWrapper);
  videoWrapper.appendChild(other_user);
  other_user.appendChild(document.createTextNode(peerUsername));

  videoWrapper.appendChild(remoteVideo);

  remoteVideo.style.height = "45vh";
  remoteVideo.style.marginTop = "22%";
  videoWrapper.style.maxWidth = "fit-content";
  remoteVideo.style.width = "fit-content";
  remoteVideo.style.position = "relative";
  remoteVideo.style.alignItems = "center";
  remoteVideo.style.display = "flex";

  return remoteVideo;
}

function setOnTrack(peer, remoteVideo) {
  console.log("Setting ontrack:");

  var remoteStream = new MediaStream();

  remoteVideo.srcObject = remoteStream;

  console.log("remoteVideo: ", remoteVideo.id);

  peer.addEventListener("track", async (event) => {
    console.log("Adding track: ", event.track);
    remoteStream.addTrack(event.track, remoteStream);
  });
}

function addLocalTracks(peer, localScreenSharing) {
  if (!localScreenSharing) {
    localStream.getTracks().forEach((track) => {
      console.log("Adding localStream tracks.");
      peer.addTrack(track, localStream);
    });

    return;
  }

  localDisplayStream.getTracks().forEach((track) => {
    console.log("Adding localDisplayStream tracks.");
    peer.addTrack(track, localDisplayStream);
  });
}

function removeVideo(video) {
  var videoWrapper = video.parentNode;
  videoWrapper.parentNode.removeChild(videoWrapper);
}
