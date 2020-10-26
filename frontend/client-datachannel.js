"use strict";

import Metronome from "./metronome.js";
import Correlator from "./correlator.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { skynetApiKey } from "./constants.js";
var audioContext; // for Web Audio API
var clickBuffer; // click for latency detection
var delayNode, userLatency; // needs to be global to access from processAudio
var sampleRate;
var loopLength;

document.addEventListener("DOMContentLoaded", initDocument);

// We start by associating the event handlers to the frontend.
async function initDocument() {
  // Adding event handlers to DOM
  document.getElementById("startButton").onclick = startStream;
  document.getElementById("stopButton").onclick = stopStream;
}

/*                                               * created in gotRemoteStream

USER                        |                  A
----------------------------+------------------+------------------------------
CLIENT                      |                  |
                            V                  |
                     userInputNode        destination
                            |                  A
                            V                  |
                       delay Node              +---------> recordingNode*
                            |                  |
               1            V 0                | 0          1
metronome -----> channelMergerNode     channelSplitterNode* ----> correlator*
                            |                  A
                            V                  |
                    serverOutputNode    serverInputNode*
CLIENT                      |                  A
----------------------------+------------------+------------------------------
SERVER                      V                  |
*/

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
  sampleRate = document.getElementById("sampleRate").value * 1;
  tempo = document.getElementById("tempo").value * 1;
  userLatency = document.getElementById("latency").value / 1000;
  const loopBeats = document.getElementById("loopBeats").value * 1;

  // Calculate loop lenght
  loopLength = (60 / tempo) * loopBeats; // Theoretical loop lengh, but
  loopLength = (Math.round((loopLength * sampleRate) / 128) * 128) / sampleRate;
  tempo = (60 / loopLength) * loopBeats;
  // according to the Web Audio API specification, "If DelayNode is part of a
  // cycle, then the value of the delayTime attribute is clamped to a minimum
  // of one render quantum."  We do this explicitly here so we can sync the
  // metronome.
  console.log("Loop lengh is %.5f s, tempos is %.1f bpm.", loopLength, tempo);

  // Getting user media
  const userInputStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: 1,
    },
  });
  // TODO: Assign handler to userInputStream.oninactive

  // Create Web Audio
  audioContext = new AudioContext({ sampleRate });

  // clickBuffer = await loadAudioBuffer("snd/Closed_Hat.wav");
  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream,
  });

  const scriptProcessor = audioContext.createScriptProcessor(16384, 1, 1);
  scriptProcessor.onaudioprocess = processAudioToPCM;

  const scriptProcessorEnd = audioContext.createScriptProcessor(16384, 1, 1);
  scriptProcessorEnd.onaudioprocess = processAudioFromPCM;


  const songBuffer = await loadAudioBuffer("snd/song.wav");
  userInputNode.connect(scriptProcessor);
  // work around it output nothing
  scriptProcessor.connect(audioContext.destination);

  scriptProcessorEnd.connect(audioContext.destination)


  function onclickstart(event) {
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    playNode.connect(audioContext.destination, 0, 0);
    playNode.loop = true;
    playNode.start();
  }

  document.getElementById("play").onclick = onclickstart;
}
let outputsample;
let PCMbuffer = [];
let scriptNodeStartingTime;

function pushPCMbuffer(PCMbuffer, item) {

  //console.log('b4', PCMbuffer.map(x => x.correspondingSecond))

  PCMbuffer.push(item)
  //insertion sort with only last item unsorted
  let pos = PCMbuffer.length - 2
  while (pos >= 0 && PCMbuffer[pos].correspondingSecond > item.correspondingSecond) {
    PCMbuffer[pos + 1] = PCMbuffer[pos];
    pos--;
  }
  PCMbuffer[pos + 1] = item;

  //console.log('aft', PCMbuffer.map(x => x.correspondingSecond))

  return PCMbuffer
}
function popPCMbuffer(PCMbuffer, time, end) {

  // past  remove from buffer, future keep in buffer
  while (PCMbuffer[0] && PCMbuffer[0].correspondingSecond < time) {
    PCMbuffer.shift()
  }
  // PCMbuffer search for correspondingSecond from time to end
  const result = PCMbuffer[0]
  if (result && result.correspondingSecond <= end) return result
  else return null
}

function processAudioToPCM(event) {
  var array, i, networkLatency;
  var correspondingSecond, boundarySample, currentPlaybackTime;
  var playbackTimeAdjustment;

  array = event.inputBuffer.getChannelData(0);
  const startSecond = event.playbackTime;
  const bufferSize = event.inputBuffer.length;
  const bufferDuration = event.inputBuffer.duration;
  const endSecond = event.playbackTime + bufferDuration
  if (!scriptNodeStartingTime) {
    scriptNodeStartingTime = startSecond
  }
  //if (!outputsample) {
  outputsample = {
    correspondingSecond: startSecond - scriptNodeStartingTime,
    pcm: array,
  };
  //console.log(outputsample);


  pushPCMbuffer(PCMbuffer, outputsample);

  /* Test with dummy network delay (seems works)
  setTimeout((outputsample) => {
    if (PCMbuffer[-1] && PCMbuffer[-1].correspondingSecond > outputsample.correspondingSecond) {
      console.log('SPECIAL')
    }
    console.log('insert', outputsample.correspondingSecond)
    pushPCMbuffer(PCMbuffer, outputsample);

    console.log('pushedPCM', PCMbuffer.map(x => x.correspondingSecond))

  }, 1000 * Math.random(), outputsample);
  */


  //}
}
function processAudioFromPCM(event) {

  // var array, i, networkLatency, bufferSize, bufferDuration;
  // var startSecond, endSecond, boundarySample, currentPlaybackTime;
  // var playbackTimeAdjustment;

  const delay = 2
  const startSecond = event.playbackTime;
  const bufferSize = event.inputBuffer.length;
  const bufferDuration = event.inputBuffer.duration;
  const endSecond = event.playbackTime + bufferDuration

  //Test for PCM Buffer (it works)
  //console.log("--------------------")
  //console.log('before PCMbuffer', PCMbuffer.map(x => x.correspondingSecond))

  const result = popPCMbuffer(PCMbuffer, startSecond - delay, endSecond - delay)

  //Test for PCM Buffer (it works)
  //console.log('now', startSecond, 'from', startSecond - delay, 'to', endSecond - delay)
  //console.log('PCM', result)
  //console.log('after PCMbuffer', PCMbuffer.map(x => x.correspondingSecond))

  //play
  // The output buffer contains the samples that will be modified and played
  let outputBuffer = event.outputBuffer;

  var inputData = result && result.pcm
  let outputData = outputBuffer.getChannelData(0);

  // Loop through the 4096 samples
  for (var sample = 0; sample < outputBuffer.length; sample++) {
    // make output equal to the same as the input
    outputData[sample] = inputData ? inputData[sample] : 0;

  }
  console.log(inputData)
  //console.log(inputData && inputData.sum())



}
async function sendAndRecieveFromServerSkynet(
  audioStream,
  remoteStreamCallBack
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
        name: "SkyWay",
        msg: "Hello, World!",
      };
      dataConnection.send(data);
    });
    // ...
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
