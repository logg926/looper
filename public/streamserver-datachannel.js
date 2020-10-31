"use strict";

import { skynetApiKey, PCMbufferSize } from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";

import { processAudioFromPCMFactory, pushPCMbuffer } from "./sync-new.js";

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

  await sendAndRecievefromClientSkyway();
}

async function sendAndRecievefromClientSkyway() {
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
      document.getElementById("play").onclick = onclickstart;

      function onclickstart() {
        status.serverStarted = true;
        const data = {
          type: "serverCommand",
          msg: "start",
        };

        dataConnection.send(data);
      }
    });
    // Receive data
    dataConnection.on("data", (data) => {
      //console.log('receive',data)
      if (data.type == "clientPCMPacket") {
        data.PCMPacket.forEach((PCMPacket) => {
          const buffer = PCMPacket.pcm;
          const pcm = new Float32Array(buffer);

          gotRemotePCMPacket({ ...PCMPacket, pcm });
        });
      }
      // => 'SkyWay: Hello, World!'
    });
  };
  document.getElementById("make-call2").onclick = () => {};
  peer.on("error", (err) => {
    alert(err.message);
  });
}

const clientAmount = 2;
function gotRemotePCMPacket(PCMPacket) {
  pushPCMbuffer(PCMPacket, PCMbuffer, clientAmount);
}
