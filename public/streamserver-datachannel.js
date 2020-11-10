"use strict";

import { skynetApiKey, PCMbufferSize } from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";

import { createServerProcessorNode } from "./sync-new.js";

var audioContext, sampleRate;

// let scriptEndNodeStartingTime;
let PCMbuffer = [];
let scriptNodeIndex;
const status = { serverStarted: null };
document.addEventListener("DOMContentLoaded", initDocument);

async function initDocument() {
  // Adding event handlers to DOM.
  document.getElementById("startServerButton").onclick = startServer;
}

async function startServer() {
  var loopLength, loopBeats, tempo, metronomeGain;

  // Update UI
  document.getElementById("sampleRate").disabled = true;
  // Get user input
  sampleRate = document.getElementById("sampleRate").value;
  console.log("Creating Web Audio.");
  audioContext = new AudioContext({ sampleRate });

  await audioContext.audioWorklet.addModule("server-processor.js");
  const scriptProcessorEnd = createServerProcessorNode(
    audioContext,
    clientAmount
  );
  scriptProcessorEnd.connect(audioContext.destination);
  await sendAndRecievefromClientSkyway(gotRemotePCMPacket, scriptProcessorEnd);

  function onclickstart() {
    scriptProcessorEnd.port.postMessage({ start: true });
    const data = {
      type: "serverCommand",
      msg: "start",
    };

    dataConnections.map((dataConnection) => {
      dataConnection.send(data);
    });
  }

  function onclickstop() {
    scriptProcessorEnd.port.postMessage({ stop: true });
    const data = {
      type: "serverCommand",
      msg: "stop",
    };

    dataConnections.map((dataConnection) => {
      dataConnection.send(data);
    });
  }
  document.getElementById("play").onclick = onclickstart;

  document.getElementById("stop").onclick = onclickstop;
}

const dataConnections = [];
async function sendAndRecievefromClientSkyway(
  gotRemotePCMPacket,
  scriptProcessorEnd
) {
  const peer = new Peer({
    key: skynetApiKey,
    debug: 3,
  });
  console.log("sky net: new peer");
  peer.on("open", () => {
    console.log("sky net: open ");
    document.getElementById("my-id").textContent = peer.id;
  });
  document.getElementById("make-call").onclick = () => {
    const theirID = document.getElementById("their-id").value;
    const dataConnection = peer.connect(theirID);
    // Send data
    dataConnection.on("open", () => {
      dataConnections.push(dataConnection);
    });
    // Receive data
    dataConnection.on("data", (data) => {
      console.log("receive", data);
      if (data.type == "clientPCMPacket") {
        data.PCMPacket.forEach((PCMPacket) => {
          const buffer = PCMPacket.pcm;
          const pcm = new Float32Array(buffer);

          gotRemotePCMPacket({ ...PCMPacket, pcm }, scriptProcessorEnd);
        });
      }
    });
  };
  document.getElementById("make-call2").onclick = () => {
    const theirID = document.getElementById("their-id2").value;
    const dataConnection = peer.connect(theirID);
    // Send data
    dataConnection.on("open", () => {
      dataConnections.push(dataConnection);
    });
    // Receive data
    dataConnection.on("data", (data) => {
      console.log("receive", data);
      if (data.type == "clientPCMPacket") {
        data.PCMPacket.forEach((PCMPacket) => {
          const buffer = PCMPacket.pcm;
          const pcm = new Float32Array(buffer);

          gotRemotePCMPacket({ ...PCMPacket, pcm }, scriptProcessorEnd);
        });
      }
    });
  };
  peer.on("error", (err) => {
    alert(err.message);
  });
}

const clientAmount = 2;
function gotRemotePCMPacket(PCMPacket, scriptProcessorEnd) {
  console.log("PCMPacket", PCMPacket);
  scriptProcessorEnd.port.postMessage(PCMPacket);
}
