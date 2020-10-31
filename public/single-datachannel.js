"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { PCMbufferSize } from "./constants.js";
import { processAudioFromPCMFactory, pushPCMbuffer } from "./sync-new.js";
import { processAudioToPCMFactory } from "./sync-client.js";

var audioContext; // for Web Audio API
var sampleRate;

document.addEventListener("DOMContentLoaded", initDocument);

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

  audioContext = new AudioContext({ sampleRate });
  await audioContext.audioWorklet.addModule("client-processor.js");
  const createMultipleScriptProcessors = (clientAmount) => {
    const scriptProcessors = [];
    for (var i = 0; i < clientAmount; i++) {
      scriptProcessors.push(
        new AudioWorkletNode(audioContext, "client-processor")
        // audioContext.createScriptProcessor(PCMbufferSize, 1, 1)
      );
    }
    return scriptProcessors;
  };
  // const scriptProcessors = createMultipleScriptProcessors(clientAmount);
  const scriptNodeStatus1 = {};
  const scriptNodeStatus2 = {};
  // scriptProcessors[0].onaudioprocess = processAudioToPCMFactory(
  //   sendPCMToServer,
  //   scriptNodeStatus1
  // );
  // scriptProcessors[1].onaudioprocess = processAudioToPCMFactory(
  //   sendPCMToServer2,
  //   scriptNodeStatus2
  // );

  const songBuffer = await loadAudioBuffer(
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2Fsong.wav"
  );

  function onServerStartCallBack() {
    const scriptProcessors = createMultipleScriptProcessors(clientAmount);
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });

    scriptProcessors[0].port.onmessage = (event) => {
      sendPCMToServer(event.data);
    };
    scriptProcessors[1].port.onmessage = (event) => {
      sendPCMToServer2(event.data);
    };
    playNode.connect(scriptProcessors[0]);

    playNode.connect(scriptProcessors[1]);
    playNode.loop = true;
    playNode.start();
    // work around it output nothing

    scriptProcessors[0].connect(audioContext.destination);
    scriptProcessors[1].connect(audioContext.destination);
  }

  const serverSendStartMock = (event) => {
    status.serverStarted = true;
    onServerStartCallBack();
  };
  document.getElementById("play").onclick = serverSendStartMock;

  startServer();
}

let packetCollector = [];
function sendPCMToServer(PCMPacket) {
  packetCollector.push(PCMPacket);
  if (packetCollector.length > 9) {
    const data = {
      type: "clientPCMPacket",
      PCMPacket: packetCollector,
    };
    console.log("send", data);

    mockDataConnectionSend(data);
    //remove everything https://www.tutorialspoint.com/in-javascript-how-to-empty-an-array
    packetCollector = [];
  }
}

let packetCollector2 = [];
function sendPCMToServer2(PCMPacket) {
  packetCollector2.push(PCMPacket);
  if (packetCollector2.length > 9) {
    const data = {
      type: "clientPCMPacket",
      PCMPacket: packetCollector2,
    };
    console.log("send", data);

    mockDataConnectionSend(data);
    //remove everything https://www.tutorialspoint.com/in-javascript-how-to-empty-an-array
    packetCollector2 = [];
  }
}
//
let PCMbuffer = [];
let scriptNodeIndex;

const clientAmount = 2;
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
  console.log(data);
  data.PCMPacket.forEach((PCMPacket) => {
    // const buffer = PCMPacket.pcm;
    // const pcm = new Float32Array(buffer);
    const pcm = PCMPacket.pcm;
    gotRemotePCMPacket({ ...PCMPacket, pcm }, PCMbuffer);
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
  scriptProcessorEnd.onaudioprocess = processAudioFromPCMFactory(
    PCMbuffer,
    scriptNodeIndex,
    status
  );
  scriptProcessorEnd.connect(audioContext.destination);
}

function gotRemotePCMPacket(PCMPacket, PCMbuffer) {
  // console.log(PCMPacket);
  pushPCMbuffer(PCMPacket, PCMbuffer, clientAmount);
}
