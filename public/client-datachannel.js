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
      buffer: songBuffer
    });
    playNode.connect(scriptProcessor);
    playNode.loop = true;
    playNode.start();

    scriptProcessor.onaudioprocess = processAudioToPCMFactory(
      sendPCMToServerFactory(dataConnection)
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

const sendPCMToServerFactory = dataConnection => {
  const sendPCMToServer = PCMPacket => {
    packetCollector.push(PCMPacket);
    if (packetCollector.length > 9) {
      const data = {
        type: "clientPCMPacket",
        PCMPacket: packetCollector
      };
      console.log("send", data);
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

function pushPCMbuffer(PCMbuffer, item) {
  //console.log('b4', PCMbuffer.map(x => x.correspondingSecond))

  PCMbuffer.push(item);
  //insertion sort with only last item unsorted
  let pos = PCMbuffer.length - 2;
  while (
    pos >= 0 &&
    PCMbuffer[pos].correspondingSecond > item.correspondingSecond
  ) {
    PCMbuffer[pos + 1] = PCMbuffer[pos];
    pos--;
  }
  PCMbuffer[pos + 1] = item;

  //console.log('aft', PCMbuffer.map(x => x.correspondingSecond))

  return PCMbuffer;
}

function startScriptEndNodeStartingTime(startSecond) {
  if (PCMbuffer.length > 0 && !scriptEndNodeStartingTime) {
    scriptEndNodeStartingTime = startSecond;
  }
}

function popPCMbuffer(PCMbuffer, time, end) {
  // past  remove from buffer, future keep in buffer
  while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < time) {
    PCMbuffer.shift();
  }
  // PCMbuffer search for correspondingSecond from time to end
  const result = PCMbuffer[0];
  if (result && result.correspondingSecond <= end) return result;
  else return null;
}

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
//     pcm: array
//   };
//   //console.log("start", startSecond);
//   //console.log(outputsample);
//   //console.log(bufferSize, bufferDuration);
//   sendPCMToServer(outputsample);

//   /* Test with dummy network delay (seems works)
//   setTimeout((outputsample) => {
//     if (PCMbuffer[-1] && PCMbuffer[-1].correspondingSecond > outputsample.correspondingSecond) {
//       console.log('SPECIAL')
//     }
//     console.log('insert', outputsample.correspondingSecond)
//     pushPCMbuffer(PCMbuffer, outputsample);

//     console.log('pushedPCM', PCMbuffer.map(x => x.correspondingSecond))

//   }, 1000 * Math.random(), outputsample);
//   */

//   //}
// }
/*
function processAudioFromPCM(event) {
  // var array, i, networkLatency, bufferSize, bufferDuration;
  // var startSecond, endSecond, boundarySample, currentPlaybackTime;
  // var playbackTimeAdjustment;

  const delay = 2;
  const startSecond = event.playbackTime;
  const bufferSize = event.inputBuffer.length;
  const bufferDuration = event.inputBuffer.duration;
  const endSecond = event.playbackTime + bufferDuration;

  //Test for PCM Buffer (it works)
  console.log("--------------------");
  console.log("end startSecond", startSecond);
  console.log("before PCMbuffer", PCMbuffer.map(x => x.correspondingSecond));

  startScriptEndNodeStartingTime(startSecond);
  console.log("start timeee node", scriptEndNodeStartingTime);
  if (scriptEndNodeStartingTime) {
    const result = popPCMbuffer(
      PCMbuffer,
      startSecond - scriptEndNodeStartingTime - delay,
      endSecond - scriptEndNodeStartingTime - delay
    );

    //Test for PCM Buffer (it works)
    console.log(
      "now",
      startSecond,
      "from",
      startSecond - delay,
      "to",
      endSecond - delay
    );
    console.log("PCM", result);
    console.log("after PCMbuffer", PCMbuffer.map(x => x.correspondingSecond));
    //play
    // The output buffer contains the samples that will be modified and played
    let outputBuffer = event.outputBuffer;

    var inputData = result && result.pcm;
    let outputData = outputBuffer.getChannelData(0);

    // Loop through the 4096 samples
    for (var sample = 0; sample < outputBuffer.length; sample++) {
      // make output equal to the same as the input
      outputData[sample] = inputData ? inputData[sample] : 0;
    }
    //console.log(inputData);
    //console.log(inputData && inputData.sum())
  }
}
*/
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
