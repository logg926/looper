"use strict";

import {
  skynetApiKey,
  defaultSampleRate,
  serverStreamConstrain
} from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { initMediaDevice } from "./helperFunctions.js";

import {
  passPCMPacketToServerProcessor,
  startServerNode,
  addParticipant
} from "./audioContext-server.js";

const status = { serverStarted: null };
document.addEventListener("DOMContentLoaded", initDocument);

const remoteVideos = document.getElementById("js-remote-streams");
const localVideo = document.getElementById("js-local-stream");
function updateUITime(time) {
  document.getElementById("time").innerHTML = time;
}
async function initDocument() {
  // Adding event handlers to DOM.

  document.getElementById("startServerButton").onclick = startServer;
  var selectBar = document.getElementById("audioSource");
  initMediaDevice(selectBar);
}
function muteStream(localStream) {
  localStream.getAudioTracks().forEach(track => (track.enabled = false));
}
function unmuteStream(localStream) {
  localStream.getAudioTracks().forEach(track => (track.enabled = true));
}


async function startServer() {
  async function publishBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();

    const serverSendTrack = async event => {
      //send arrayBuffer
      const data = {
        type: "serverCommand",
        msg: "changeAudio",
        arrayBuffer: arrayBuffer.slice()
      };

      dataConnections.map(dataConnection => {
        dataConnection.send(data);
      });
    };

    document.getElementById("sendTrack").onclick = serverSendTrack;
    document.querySelector("audio").src = URL.createObjectURL(blob);
  }

  const link = document.getElementById("link").value;

  const { scriptProcessorEnd, onStart, onStop } = await startServerNode(
    defaultSampleRate,
    clientAmount,
    updateUITime,
    publishBlob,
    link
  );

  const localStream = await sendAndRecievefromClientSkyway(scriptProcessorEnd);

  function onclickstart() {
    const startTime = document.getElementById("startSecond").value;
    muteStream(localStream);
    onStart(startTime);
    const data = {
      type: "serverCommand",
      msg: "start",
      startTime: parseFloat(startTime)
    };

    console.log("clickstart", dataConnections);
    dataConnections.map(dataConnection => {
      dataConnection.send(data);
    });
  }

  function onclickstop() {
    unmuteStream(localStream);
    onStop();
    const data = {
      type: "serverCommand",
      msg: "stop"
    };
    dataConnections.map(dataConnection => {
      dataConnection.send(data);
    });
  }

  document.getElementById("play").onclick = onclickstart;

  document.getElementById("stop").onclick = onclickstop;
}

let dataConnections = [];
const peer = new Peer({
  key: skynetApiKey,
  debug: 3
});
peer.on("open", () => {
  console.log("sky net: open ");
  document.getElementById("my-id").textContent = peer.id;
});

async function sendAndRecievefromClientSkyway(scriptProcessorEnd) {
  function call(theirID) {
    //connect client
    const dataConnection = peer.connect(theirID);
    dataConnection.on("open", () => {
      dataConnections.push(dataConnection);
      console.log(
        "after call, dataConnections",
        dataConnections.map(x => x.remoteId)
      );
      addParticipant(theirID, scriptProcessorEnd);
    });
    // Receive data
    dataConnection.on("data", data => {
      if (data.type === "clientPCMPacket") {
        passPCMPacketToServerProcessor(data, scriptProcessorEnd, theirID);
      }
    });
  }

  var myPreferredCameraDeviceId = document.getElementById("audioSource").value;
  const deviceAudioChoose = {
    ...serverStreamConstrain,
    audio: {
      ...serverStreamConstrain.audio,
      deviceId: myPreferredCameraDeviceId
    }
  };
  const localStream = await navigator.mediaDevices
    .getUserMedia(deviceAudioChoose)
    .catch(console.error);

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  const sfuRoom = peer.joinRoom("testroom1", {
    mode: "sfu",
    stream: localStream
  });
  // sfuRoom.on("open", () => {});

  sfuRoom.on("stream", async stream => {
    const newVideo = document.createElement("video");
    newVideo.srcObject = stream;
    newVideo.playsInline = true;
    // mark peerId to find it later at peerLeave event
    newVideo.setAttribute("data-peer-id", stream.peerId);
    call(stream.peerId);
    remoteVideos.append(newVideo);
    await newVideo.play().catch(console.error);
  });
  //for closing room members
  sfuRoom.on("peerLeave", peerId => {
    const remoteVideo = remoteVideos.querySelector(
      `[data-peer-id="${peerId}"]`
    );
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
    remoteVideo.remove();
    dataConnections = dataConnections.filter(
      dataConnection => dataConnection.remoteId !== peerId
    );
    console.log(
      "after peer leave with ",
      peerId,
      " dataConnections",
      dataConnections.map(x => x.remoteId)
    );
  });
  // for closing myself
  sfuRoom.once("close", () => {
    Array.from(remoteVideos.children).forEach(remoteVideo => {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();
    });
  });

  peer.on("error", err => {
    alert(err.message);
  });

  return localStream;
}

const clientAmount = 2;
