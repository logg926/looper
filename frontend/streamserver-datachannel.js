"use strict";

import Metronome from "./metronome.js";
import { signalingServerUrl, stunServerUrl } from "./constants.js";
import { skynetApiKey } from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { initServer, initOTSession } from "./vonangeAPI.session.js";

var signalingChannel, ownId; // for Websocket
var connection = []; // For RTC
var audioContext,
  clientOutputNode,
  channelMergerNode,
  channelMergerNode2,
  clientOutputNode2,
  sampleRate,
  loopGain; // for Web Audio API

document.addEventListener("DOMContentLoaded", initDocument);

async function initDocument() {
  // Adding event handlers to DOM.
  document.getElementById("startServerButton").onclick = startServer;
}

async function startServer() {
  var loopLength, loopBeats, tempo, metronomeGain;

  // Update UI
  document.getElementById("sampleRate").disabled = true;
  document.getElementById("loopBeats").disabled = true;
  document.getElementById("tempo").disabled = true;
  document.getElementById("loopGain").disabled = true;
  document.getElementById("metronomeGain").disabled = true;
  document.getElementById("startServerButton").disabled = true;

  // Get user input
  sampleRate = document.getElementById("sampleRate").value;
  loopGain = document.getElementById("loopGain").value;
  metronomeGain = document.getElementById("metronomeGain").value;
  tempo = document.getElementById("tempo").value;
  loopBeats = document.getElementById("loopBeats").value;

  // Adjust loop length and tempo according to the Web Audio API specification:
  // "If DelayNode is part of a cycle, then the value of the delayTime
  // attribute is clamped to a minimum of one render quantum."  We do this
  // explicitly here so we can sync the metronome.
  loopLength = (60 / tempo) * loopBeats;
  loopLength = (Math.round((loopLength * sampleRate) / 128) * 128) / sampleRate;
  tempo = (60 / loopLength) * loopBeats;
  console.log("Loop lengh is %.5f s, tempos is %.1f bpm.", loopLength, tempo);

  console.log("Creating Web Audio.");
  audioContext = new AudioContext({ sampleRate });

  channelMergerNode = new ChannelMergerNode(audioContext, {
    numberOfInputs: 2,
  });
  channelMergerNode2 = new ChannelMergerNode(audioContext, {
    numberOfInputs: 2,
  });
  clientOutputNode = new MediaStreamAudioDestinationNode(audioContext);
  clientOutputNode2 = new MediaStreamAudioDestinationNode(audioContext);

  /*
  CLIENT           |                                  A
  -----------------+----------------------------------+-------------------------
  SERVER           V                                  |
            clientInputNode(s)*                clientOutputNode(s)
                   |                                  A
                   V                                  |
          channelSplitterNode(s)* -----1-----> channelMergerNode(s)
                   |                                  |
                   V                                  |
             clientGainNode(s)*                       |
                   |                                  |
                   +-----0------> gainNode -----0-----+
                                   |    A             |
                                   V    |             |
                                  delayNode        metronome
  
                                                    *created on demand
  */

  /*
CLIENT           |                                  A
-----------------+----------------------------------+-------------------------
SERVER           V                                  |
          clientInputNode(s)*            clientOutputNodeTwo    clientOutputNodeOne(s)
                 |                                  A                     |
                 V                                  |                     |
        channelSplitterNode(s)* -----1--------------|                     |
                 | 0                                                      |
                 V                                                        |
           Destination(s)*                                                0
                                                                          |
                                                                          |
                                                                          |
                                                                          |
                                                                      SongPlayer
 
                                                                        *created on demand
*/

  const songBuffer = await loadAudioBuffer("snd/song.wav");

  function onclickstart(event) {
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    playNode.connect(songSplitterNode, 0, 0);
    playNode.loop = true;
    playNode.start();
  }
  const songSplitterNode = new ChannelSplitterNode(audioContext, {
    numberOfOutputs: 2,
  });

  document.getElementById("play").onclick = onclickstart;
  onclickstart();
  console.log("Waiting for offers.");
  songSplitterNode.connect(channelMergerNode, 0, 0);
  channelMergerNode.connect(clientOutputNode);
  songSplitterNode.connect(channelMergerNode2, 0, 0);

  channelMergerNode2.connect(clientOutputNode2);
  await sendAndRecievefromClientSkyway(
    clientOutputNode.stream,
    clientOutputNode2.stream,
    gotRemoteStream
  );
}

async function sendAndRecievefromClientSkyway(
  audioMediaStream,
  audioMediaStream2,
  remoteStreamCallBack
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
    const mediaConnection = peer.call(theirID, audioMediaStream);
    mediaConnection.on("stream", (stream) => {
      remoteStreamCallBack(stream, channelMergerNode);
    });
  };
  document.getElementById("make-call2").onclick = () => {
    const theirID = document.getElementById("their-id2").value;
    const mediaConnection = peer.call(theirID, audioMediaStream2);
    mediaConnection.on("stream", (stream) => {
      remoteStreamCallBack(stream, channelMergerNode2);
    });
  };
  peer.on("error", (err) => {
    alert(err.message);
  });
}

function gotRemoteStream(mediaStream, clientOutputNode) {
  console.log("Got remote media stream.");

  // Workaround for Chrome from https://stackoverflow.com/a/54781147
  new Audio().srcObject = mediaStream;
  console.log(mediaStream.getAudioTracks());

  const clientInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: mediaStream,
  });
  const channelSplitterNode = new ChannelSplitterNode(audioContext, {
    numberOfOutputs: 2,
  });
  clientInputNode.connect(channelSplitterNode);
  channelSplitterNode.connect(clientOutputNode, 0, 1);
  channelSplitterNode.connect(audioContext.destination, 1);
}

async function loadAudioBuffer(url) {
  console.log("Loading audio data from %s.", url);
  const response = await fetch(url);
  const audioData = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(audioData);
  return buffer;
}
