"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { skynetApiKey, PCMbufferSize } from "./constants.js";
import { processAudioToPCMFactory } from "./sync-client.js";
var audioContext; // for Web Audio API
var sampleRate;
var loopLength;

document.addEventListener("DOMContentLoaded", initDocument);

// for the skyway cdn
// let Peer;

// We start by associating the event handlers to the frontend.
async function initDocument() {
  // Adding event handlers to DOM
  document.getElementById("startButton").onclick = startStream;
  document.getElementById("stopButton").onclick = stopStream;
}

async function startStream() {
  // Disable UI
  var tempo, loopLength;
  document.getElementById("sessionId").disabled = true;
  document.getElementById("sampleRate").disabled = true;
  document.getElementById("loopBeats").disabled = true;
  document.getElementById("tempo").disabled = true;
  document.getElementById("latency").disabled = true;
  document.getElementById("startButton").disabled = true;

  // Get user input
  // sessionId = document.getElementById("sessionId").value;

  // Getting user media
  const userInputStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: 1,
    },
  });

  // Create Web Audio
  audioContext = new AudioContext({ sampleRate });

  // clickBuffer = await loadAudioBuffer("snd/Closed_Hat.wav");
  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream,
  });

  const scriptProcessor = audioContext.createScriptProcessor(
    PCMbufferSize,
    1,
    1
  );
  //const scriptProcessorEnd = audioContext.createScriptProcessor(PCMbufferSize, 1, 1);
  //scriptProcessorEnd.onaudioprocess = processAudioFromPCM;

  const channelMergerNode = audioContext.createChannelMerger(3);

  // scriptProcessorEnd.connect(channelMergerNode,0,0);

  //scriptProcessorEnd.connect(audioContext.destination);

  //userInputNode.connect(scriptProcessor);
  // work around it output nothing
  //scriptProcessor.connect(audioContext.destination);

  const songBuffer = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong.wav"
  );

  function onServerStartCallBack(dataConnection) {
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    playNode.connect(scriptProcessor);
    playNode.loop = true;
    playNode.start();
    const nodeStatus = {};
    scriptProcessor.onaudioprocess = processAudioToPCMFactory(
      sendPCMToServerFactory(dataConnection),
      nodeStatus
    );

    // userInputNode.connect(scriptProcessor);
    // work around it output nothing
    scriptProcessor.connect(audioContext.destination);

    // channelMergerNode.connect(audioContext.destination);
  }
  sendAndRecieveFromServerSkynet(onServerStartCallBack);

  // document.getElementById("play").onclick = onServerStartCallBack;
}
// let globalDataConnection;

let packetCollector = [];

const sendPCMToServerFactory = (dataConnection) => {
  const sendPCMToServer = (PCMPacket) => {
    packetCollector.push(PCMPacket);
    if (packetCollector.length > 9) {
      const data = {
        type: "clientPCMPacket",
        PCMPacket: packetCollector,
      };
      console.log("send", data);
      //this takes too long
      dataConnection.send(data);
      //remove everything https://www.tutorialspoint.com/in-javascript-how-to-empty-an-array
      packetCollector = [];
    }
  };
  return sendPCMToServer;
};

// function sendPCMToServer(PCMPacket) {
//   packetCollector.push(PCMPacket);
//   if (packetCollector.length > 9) {
//     const data = {
//       type: "clientPCMPacket",
//       PCMPacket: packetCollector,
//     };
//     console.log("send", data);
//     globalDataConnection.send(data);
//     //remove everything https://www.tutorialspoint.com/in-javascript-how-to-empty-an-array
//     packetCollector = [];
//   }
// }
let outputsample;
let PCMbuffer = [];
let scriptEndNodeStartingTime;

async function sendAndRecieveFromServerSkynet(onServerStartCallBack) {
  const peer = new Peer({
    key: skynetApiKey,
    debug: 3,
  });
  peer.on("open", () => {
    console.log("sky net: open ");
    document.getElementById("my-id").textContent = peer.id;
  });

  peer.on("connection", (dataConnection) => {
    console.log("established datachannel :", dataConnection);
    dataConnection.on("open", () => {
      const data = {
        name: "SkyWay client",
        msg: "Hello, World!",
      };
      dataConnection.send(data);
    });
    dataConnection.on("data", (data) => {
      //console.log("data", data);
      if (data.type == "serverCommand") {
        if (data.msg == "start") {
          onServerStartCallBack(dataConnection);
        }
        // gotRemotePCMPacket(data.PCMPacket,audioContext.destination)
      }
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

async function loadAudioBuffer(url) {
  console.log("Loading audio data from %s.", url);
  const response = await fetch(url);
  const audioData = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(audioData);
  return buffer;
}
