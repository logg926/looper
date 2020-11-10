"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import {
  skynetApiKey,
  PCMbufferSize,
  clientSendBufferLength,
} from "./constants.js";
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

  await audioContext.audioWorklet.addModule("client-processor.js");
  // clickBuffer = await loadAudioBuffer("snd/Closed_Hat.wav");
  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream,
  });

  const songBuffer = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong.wav"
  );
  
  const userDelayInBufferUnit = document.getElementById("latency").value;

  const scriptProcessor = new AudioWorkletNode(
    audioContext,
    "client-processor",
    {
    processorOptions: {
      userDelayInBufferUnit,
    }
  }
  );

  // work around it output nothing
  scriptProcessor.connect(audioContext.destination);
  let refreshIntervalId;
  let playNode;
  function onServerStartCallBack(dataConnection) {
    playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    // playNode.connect(scriptProcessor);
    playNode.loop = true;
    playNode.start();
    playNode.connect(audioContext.destination)
    // const nodeStatus = {};
    scriptProcessor.port.postMessage({ start: true });

    scriptProcessor.port.onmessage = (event) => {
      bufferPCMandSendToServer(event.data, dataConnection, packetBuffer);
    };
    refreshIntervalId = setInterval(function () {
      const length = packetBuffer.length;
      if (length) {
        const data = {
          type: "clientPCMPacket",
          PCMPacket: packetBuffer.splice(0, length),
        };
        console.log("send", data);
        dataConnection.send(data);
      }
    }, 1000);
    userInputNode.connect(scriptProcessor);
  }

  function onServerStopCallBack() {
    scriptProcessor.port.postMessage({ stop: true });
    playNode.stop();
    playNode.disconnect();
    clearInterval(refreshIntervalId);
    //empty buffer
    packetBuffer.length = 0;
    // userInputNode.connect(scriptProcessor);
  }
  sendAndRecieveFromServerSkynet(onServerStartCallBack, onServerStopCallBack);

  // document.getElementById("play").onclick = onServerStartCallBack;
}

let packetBuffer = [];
async function bufferPCMandSendToServer(
  PCMPacket,
  dataConnection,
  packetBuffer
) {
  packetBuffer.push(PCMPacket);
}

let outputsample;
let PCMbuffer = [];
let scriptEndNodeStartingTime;

async function sendAndRecieveFromServerSkynet(
  onServerStartCallBack,
  onServerStopCallBack
) {
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
      console.log("recieve", data);
      if (data.type == "serverCommand") {
        if (data.msg == "start") {
          onServerStartCallBack(dataConnection);
        } else if (data.msg == "stop") {
          onServerStopCallBack(dataConnection);
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
