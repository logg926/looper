"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { PCMbufferSize, clientSendBufferLength } from "./constants.js";
import {
  processAudioFromPCMFactory,
  createServerProcessorNode
} from "./sync-new.js";
import { processAudioToPCMFactory } from "./sync-client.js";

var audioContext; // for Web Audio API
var sampleRate;

const clientAmount = 2;
document.addEventListener("DOMContentLoaded", initDocument);

// We start by associating the event handlers to the frontend.
async function initDocument() {
  // Adding event handlers to DOM
  document.getElementById("startButton").onclick = startStream;
  document.getElementById("stopButton").onclick = stopStream;
}

async function startStream() {
  // Disable UI
  var loopLength;
  document.getElementById("sessionId").disabled = true;
  document.getElementById("sampleRate").disabled = true;
  document.getElementById("loopBeats").disabled = true;
  document.getElementById("latency").disabled = true;
  document.getElementById("startButton").disabled = true;

  audioContext = new AudioContext({ sampleRate });
  await audioContext.audioWorklet.addModule("client-processor.js");
  await audioContext.audioWorklet.addModule("server-processor.js");
  const createMultipleScriptProcessors = clientAmount => {
    const scriptProcessors = [];
    for (var i = 0; i < clientAmount; i++) {
      scriptProcessors.push(
        new AudioWorkletNode(audioContext, "client-processor")
      );
    }
    return scriptProcessors;
  };

  const songBuffer = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong.wav"
  );
  const songBuffer2 = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong2.wav"
  );
  const userInputStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: 1
    }
  });
  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream
  });

  const scriptProcessors = createMultipleScriptProcessors(clientAmount);
  scriptProcessors[0].port.onmessage = event => {
    sendPCMToServer(event.data);
  };
  scriptProcessors[1].port.onmessage = event => {
    sendPCMToServer2(event.data);
  };

  scriptProcessors[0].connect(audioContext.destination);
  scriptProcessors[1].connect(audioContext.destination);
  let refreshIntervalId1, refreshIntervalId2;
  let playNode, playNode2;
  function onServerStartCallBack() {
    playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer
    });
    playNode2 = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer2
    });
    playNode.connect(scriptProcessors[0]);
    // userInputNode.connect(scriptProcessors[0]);
    // playNode.connect(audioContext.destination)
    playNode2.connect(scriptProcessors[1]);
    // playNode.loop = true;
    playNode.start();
    playNode2.start();
    // playNode.onended = () => {
    //   scriptProcessors.map((scriptProcessor) => {
    //     scriptProcessor.port.postMessage({ stop: true });
    //   });
    // };
    scriptProcessors.map(scriptProcessor => {
      scriptProcessor.port.postMessage({ start: true });
    });
    // work around it output nothing
    refreshIntervalId1 = setInterval(function() {
      const length = packetCollector.length;
      if (length) {
        const data = {
          type: "clientPCMPacket",
          PCMPacket: packetCollector.splice(0, length)
        };
        mockDataConnectionSend(data);
      }
    }, 1000);
    refreshIntervalId2 = setInterval(function() {
      const length = packetCollector2.length;
      if (length) {
        const data = {
          type: "clientPCMPacket",
          PCMPacket: packetCollector2.splice(0, length)
        };
        mockDataConnectionSend(data);
      }
    }, 1000);
  }

  function onServerStopCallBack() {
    scriptProcessors.map(scriptProcessor => {
      scriptProcessor.port.postMessage({ stop: true });
    });
    playNode.stop();
    playNode.disconnect();
    playNode2.stop();
    playNode2.disconnect();
    clearInterval(refreshIntervalId1);
    clearInterval(refreshIntervalId2);
    packetCollector.length = 0;
    packetCollector2.length = 0;
  }

  scriptProcessorEnd = startServer(onServerStartCallBack, onServerStopCallBack);
}
let scriptProcessorEnd;
let packetCollector = [];
function sendPCMToServer(PCMPacket) {
  packetCollector.push(PCMPacket);
}

let packetCollector2 = [];
function sendPCMToServer2(PCMPacket) {
  packetCollector2.push(PCMPacket);
}
//
let PCMbuffer = [];
let scriptNodeIndex;

const status = { serverStarted: null };

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
  //console.log("mocksend", data);
  data.PCMPacket.forEach(PCMPacket => {
    // const buffer = PCMPacket.pcm;
    // const pcm = new Float32Array(buffer);
    const pcm = PCMPacket.pcm;
    gotRemotePCMPacket({ ...PCMPacket, pcm });
  });
}

function startServer(onServerStartCallBack, onServerStopCallBack) {
  var loopLength, loopBeats, metronomeGain;

  // Update UI
  document.getElementById("sampleRate").disabled = true;
  // Get user input
  sampleRate = document.getElementById("sampleRate").value;
  console.log("Creating Web Audio.");
  // audioContext = new AudioContext({ sampleRate });

  const scriptProcessorEnd = createServerProcessorNode(
    audioContext,
    clientAmount
  );

  scriptProcessorEnd.connect(audioContext.destination);

  const serverSendStartMock = event => {
    // status.serverStarted = true;
    scriptProcessorEnd.port.postMessage({ start: true });
    onServerStartCallBack();
  };

  const serverSendStopMock = event => {
    // status.serverStarted = true;
    scriptProcessorEnd.port.postMessage({ stop: true });
    onServerStopCallBack();
  };

  document.getElementById("play").onclick = serverSendStartMock;

  document.getElementById("stop").onclick = serverSendStopMock;
  return scriptProcessorEnd;
}

function gotRemotePCMPacket(PCMPacket) {
  // console.log(PCMPacket);

  scriptProcessorEnd.port.postMessage(PCMPacket);
}
