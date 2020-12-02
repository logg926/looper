"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import {
  skynetApiKey,
  defaultSampleRate,
  clientStreamConstrain,
} from "./constants.js";

import { startStream } from "./audioContext-client.js";
import { initMediaDevice } from "./helperFunctions.js";

document.addEventListener("DOMContentLoaded", initDocument);

const remoteVideos = document.getElementById("js-remote-streams");
const localVideo = document.getElementById("js-local-stream");
// We start by associating the event handlers to the frontend.
async function initDocument() {
  // Adding event handlers to DOM
  document.getElementById("startButton").onclick = startButtonClick;
  document.getElementById("stopButton").onclick = stopStream;
  var selectBar = document.getElementById("audioSource");
  initMediaDevice(selectBar);
}

async function startButtonClick() {
  document.getElementById("latency").disabled = true;
  document.getElementById("startButton").disabled = true;

  var source = document.getElementById("audioSource").value;

  const linkProvided = document.getElementById("link").value;
  const latencyInMs = document.getElementById("latency").value;

  const testing = document.getElementById("testing").checked;
  const userDelayInBufferUnit = Math.round(
    ((parseInt(latencyInMs) / 1000) * defaultSampleRate) / 128
  ); //

  console.log("linkProvided", linkProvided);

  const link = linkProvided;
  // await startStream(
  //   sendAndRecieveFromServerSkynet,
  //   bufferPCMandSendToServer,
  //   link
  // );
  const sendFn = (dataConnection, data) => {
    // console.log("send", data);
    // dataConnection.send("hi")
    dataConnection.send(data);
  };
  const {
    onServerStartCallBack,
    onServerStopCallBack,
    changeAudioTrack,
  } = await startStream(
    packetBuffer,
    link,
    sendFn,
    userDelayInBufferUnit,
    testing,
    false,
    source
  );

  sendAndRecieveFromServerSkynet(
    onServerStartCallBack,
    onServerStopCallBack,
    changeAudioTrack
  );
}
let packetBuffer = [];
const peer = new Peer({
  key: skynetApiKey,
  debug: 3,
});
peer.on("open", () => {
  console.log("sky net: open ");
  document.getElementById("my-id").textContent = peer.id;
  // peer.listAllPeers(fuContent = peer.id;
  // peer.listAllPeers(function (list) {
  //   console.log(list);
  // });
});

async function sendAndRecieveFromServerSkynet(
  onServerStartCallBack,
  onServerStopCallBack,
  changeAudioTrack
) {
  const localStream = await navigator.mediaDevices
    .getUserMedia(clientStreamConstrain)
    .catch(console.error);

  peer.on("connection", (dataConnection) => {
    console.log("established datachannel :", dataConnection);
    dataConnection.on("open", () => {
      const data = {
        name: "SkyWay client",
        msg: "Hello, World!",
      };
      dataConnection.send(data);
    });

    //TODO: make this websocket as it is must recieve
    dataConnection.on("data", (data) => {
      console.log("recieve", data);
      if (data.type == "serverCommand") {
        if (data.msg == "start") {
          // console.log("data",data)

          localStream
            .getAudioTracks()
            .forEach((track) => (track.enabled = false));
          onServerStartCallBack(dataConnection, data.startTime);
        } else if (data.msg == "stop") {
          localStream
            .getAudioTracks()
            .forEach((track) => (track.enabled = true));
          onServerStopCallBack(dataConnection);
        } else if (data.msg == "changeAudio") {
          changeAudioTrack(data.arrayBuffer);
        }
      }
    });
  });

  // Render local stream
  localVideo.muted = true;
  localVideo.srcObject = localStream;
  localVideo.playsInline = true;
  await localVideo.play().catch(console.error);

  const sfuRoom = peer.joinRoom("testroom1", {
    mode: "sfu",
    stream: localStream,
  });
  sfuRoom.on("open", () => {});
  sfuRoom.on("stream", async (stream) => {
    const newVideo = document.createElement("video");
    newVideo.srcObject = stream;
    newVideo.playsInline = true;
    // mark peerId to find it later at peerLeave event
    newVideo.setAttribute("data-peer-id", stream.peerId);

    remoteVideos.append(newVideo);
    await newVideo.play().catch(console.error);
  });
  //for closing room members
  sfuRoom.on("peerLeave", (peerId) => {
    const remoteVideo = remoteVideos.querySelector(
      `[data-peer-id="${peerId}"]`
    );
    remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
    remoteVideo.srcObject = null;
    remoteVideo.remove();
    console.log("after peer leave with ", peerId, " dataConnections");
  });
  // for closing myself
  sfuRoom.once("close", () => {
    Array.from(remoteVideos.children).forEach((remoteVideo) => {
      remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();
    });
  });

  peer.on("error", (err) => {
    alert(err.message);
  });
}

function stopStream() {
  document.getElementById("stopButton").disabled = true;
  console.log("Leaving the session");
}
