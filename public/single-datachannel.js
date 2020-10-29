"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { skynetApiKey, PCMbufferSize, MasterDelay } from "./constants.js";
import { processAudioFromPCM, pushPCMbuffer } from "./sync.js";
import { processAudioToPCMFactory } from "./sync-client.js";

var audioContext; // for Web Audio API
var clickBuffer; // click for latency detection
var delayNode, userLatency; // needs to be global to access from processAudio
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

// console.log("hi");
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
      channelCount: 1
    }
  });

  // Create Web Audio
  audioContext = new AudioContext({ sampleRate });

  // clickBuffer = await loadAudioBuffer("snd/Closed_Hat.wav");
  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream
  });

  const scriptProcessor = audioContext.createScriptProcessor(
    PCMbufferSize,
    1,
    1
  );
  scriptProcessor.onaudioprocess = processAudioToPCMFactory(sendPCMToServer);

  const channelMergerNode = audioContext.createChannelMerger(3);

  const songBuffer = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong.wav"
  );

  function onServerStartCallBack() {
    // console.log(dataConnection)
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer
    });
    playNode.connect(scriptProcessor);
    playNode.loop = true;
    playNode.start();

    // globalDataConnection = dataConnection;

    // userInputNode.connect(scriptProcessor);
    // work around it output nothing
    scriptProcessor.connect(audioContext.destination);

    // channelMergerNode.connect(audioContext.destination);
  }
  // sendAndRecieveFromServerSkynet(onServerStartCallBack);

  document.getElementById("play").onclick = onServerStartCallBack;

  startServer();
}
let globalDataConnection;

let packetCollector = [];
function sendPCMToServer(PCMPacket) {
  packetCollector.push(PCMPacket);
  if (packetCollector.length > 9) {
    const data = {
      type: "clientPCMPacket",
      PCMPacket: packetCollector
    };
    console.log("send", data);

    mockDataConnectionSend(data);
    // globalDataConnection.send(data);
    //remove everything https://www.tutorialspoint.com/in-javascript-how-to-empty-an-array
    packetCollector = [];
  }
}
let outputsample;
let PCMbuffer = [];
let scriptNodeStartingTime;

// function processAudioToPCM(event) {
//   var array, i, networkLatency;
//   var correspondingSecond, boundarySample, currentPlaybackTime;
//   var playbackTimeAdjustment;

//   array = event.inputBuffer.getChannelData(0);
//   const startSecond = event.playbackTime;
//   const bufferSize = event.inputBuffer.length;
//   const bufferDuration = event.inputBuffer.duration;
//   const endSecond = event.playbackTime + bufferDuration;
//   if (!scriptNodeStartingTime) {
//     scriptNodeStartingTime = startSecond;
//   }
//   //if (!outputsample) {
//   outputsample = {
//     correspondingSecond: startSecond - scriptNodeStartingTime,
//     pcm: array,
//   };
//   sendPCMToServer(outputsample);
// }
async function sendAndRecieveFromServerSkynet(onServerStartCallBack) {
  const peer = new Peer({
    key: skynetApiKey,
    debug: 3
  });
  peer.on("open", () => {
    console.log("sky net: open ");
    document.getElementById("my-id").textContent = peer.id;
  });

  peer.on("connection", dataConnection => {
    console.log("established datachannel :", dataConnection);
    dataConnection.on("open", () => {
      const data = {
        name: "SkyWay client",
        msg: "Hello, World!"
      };
      dataConnection.send(data);
    });
    dataConnection.on("data", data => {
      //console.log("data", data);
      if (data.type == "serverCommand") {
        if (data.msg == "start") {
          onServerStartCallBack(dataConnection);
        }
        // gotRemotePCMPacket(data.PCMPacket,audioContext.destination)
      }
    });
  });
  peer.on("error", err => {
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

function mockDataConnectionSend(data) {
  console.log(data);
  data.PCMPacket.forEach(PCMPacket => {
    // const buffer = PCMPacket.pcm;
    // const pcm = new Float32Array(buffer);
    const pcm = PCMPacket.pcm;
    gotRemotePCMPacket({ ...PCMPacket, pcm });
  });
}

async function startServer() {
  var loopLength, loopBeats, tempo, metronomeGain;

  // Update UI
  document.getElementById("sampleRate").disabled = true;
  // Get user input
  sampleRate = document.getElementById("sampleRate").value;
  console.log("Creating Web Audio.");
  // audioContext = new AudioContext({ sampleRate });

  const scriptProcessorEnd = audioContext.createScriptProcessor(
    PCMbufferSize,
    1,
    1
  );
  scriptProcessorEnd.onaudioprocess = processAudioFromPCM;
  scriptProcessorEnd.connect(audioContext.destination);

  // await sendAndRecievefromClientSkyway();
}

function gotRemotePCMPacket(PCMPacket) {
  console.log(PCMPacket);
  pushPCMbuffer(PCMPacket);
}
