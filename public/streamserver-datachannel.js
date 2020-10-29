"use strict";

import { signalingServerUrl, stunServerUrl } from "./constants.js";
import { skynetApiKey, PCMbufferSize, MasterDelay } from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";

import { processAudioFromPCM, pushPCMbuffer, PCMbuffer } from "./sync.js";
var signalingChannel, ownId; // for Websocket
var connection = []; // For RTC
var audioContext, sampleRate;

// let scriptEndNodeStartingTime;

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
  scriptProcessorEnd.onaudioprocess = processAudioFromPCM;
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
    // const mediaConnection = peer.call(theirID, audioMediaStream);
    // mediaConnection.on("stream", stream => {
    //   remoteStreamCallBack(stream, channelMergerNode);
    // });

    const dataConnection = peer.connect(theirID);

    // Send data
    dataConnection.on("open", () => {
      document.getElementById("play").onclick = onclickstart;

      function onclickstart() {
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

function gotRemotePCMPacket(PCMPacket) {
  pushPCMbuffer(PCMPacket);
}

// function pushPCMbuffer(PCMbuffer, item) {
//   PCMbuffer.push(item);
//   //insertion sort with only last item unsorted
//   let pos = PCMbuffer.length - 2;
//   while (
//     pos >= 0 &&
//     PCMbuffer[pos].correspondingSecond > item.correspondingSecond
//   ) {
//     PCMbuffer[pos + 1] = PCMbuffer[pos];
//     pos--;
//   }
//   PCMbuffer[pos + 1] = item;
//   return PCMbuffer;
// }

// function startScriptEndNodeStartingTime(startSecond) {
//   if (PCMbuffer.length > 0 && !scriptEndNodeStartingTime) {
//     scriptEndNodeStartingTime = startSecond;
//   }
// }

// function popPCMbuffer(PCMbuffer, time, end) {
//   // past  remove from buffer, future keep in buffer
//   const returnBufers = [];
//   while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < time) {
//     PCMbuffer.shift();
//   }
//   while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < end) {
//     const temp = PCMbuffer.shift();
//     //console.log("temp",temp)
//     returnBufers.push(temp);
//   }
//   // PCMbuffer search for correspondingSecond from time to end

//   return returnBufers;
// }

// function processAudioFromPCM(event) {
//   const delay = MasterDelay;
//   const startSecond = event.playbackTime;
//   const bufferSize = event.inputBuffer.length;
//   const bufferDuration = event.inputBuffer.duration;
//   const endSecond = event.playbackTime + bufferDuration;
//   startScriptEndNodeStartingTime(startSecond);
//   if (scriptEndNodeStartingTime) {
//     const result = popPCMbuffer(
//       PCMbuffer,
//       startSecond - scriptEndNodeStartingTime - delay,
//       endSecond - scriptEndNodeStartingTime - delay
//     );

//     //Test for PCM Buffer (it works)
//     /*
//     console.log(
//       "now",
//       startSecond,
//       "from",
//       startSecond - scriptEndNodeStartingTime - delay,
//       "to",
//       endSecond - scriptEndNodeStartingTime - delay
//     );
//     */
//     console.log(
//       "PCMbuffer",
//       PCMbuffer.map((x) => x.correspondingSecond)
//     );
//     console.log(
//       "PCM",
//       result.map((x) => x.correspondingSecond)
//     );
//     //play
//     // The output buffer contains the samples that will be modified and played

//     let outputBuffer = event.outputBuffer;
//     let outputData = outputBuffer.getChannelData(0);
//     if (result.length == 0) {
//       for (var sample = 0; sample < outputBuffer.length; sample++) {
//         // make output equal to the same as the input
//         outputData[sample] = 0;
//       }
//     }
//     result.map((input) => {
//       const inputData = input.pcm;
//       //console.log('inputputData',inputData)
//       // Loop through the 4096 samples
//       for (var sample = 0; sample < outputBuffer.length; sample++) {
//         // make output equal to the same as the input
//         outputData[sample] = inputData[sample];
//       }
//     });

//     //console.log('outputData',outputData);
//     //console.log(inputData && inputData.sum())
//   }
// }
