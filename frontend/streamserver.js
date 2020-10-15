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
  gainNode,
  delayNode,
  channelMergerNode,
  clientOutputNodeTwo,
  sampleRate,
  outputMediaStream,
  loopGain; // for Web Audio API

document.addEventListener("DOMContentLoaded", initDocument);

function handleError(error) {
  if (error) {
    alert(error.message);
  }
}

async function initDocument() {
  // Adding event handlers to DOM.
  document.getElementById("startServerButton").onclick = startServer;
}

async function startServer() {
  var metronome, loopLength, loopBeats, tempo, metronomeGain;

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
  // gainNode = new GainNode(audioContext, { gain: loopGain });
  // delayNode = new DelayNode(audioContext, {
  //   delayTime: loopLength,
  //   maxDelayTime: loopLength,
  // });
  // channelMergerNode = new ChannelMergerNode(audioContext, {
  //   numberOfInputs: 2,
  // });
  clientOutputNode = new MediaStreamAudioDestinationNode(audioContext);
  clientOutputNodeTwo = new MediaStreamAudioDestinationNode(audioContext);

  // gainNode.connect(delayNode);
  // delayNode.connect(gainNode);
  // gainNode.connect(channelMergerNode, 0, 0);
  // channelMergerNode.connect(clientOutputNodeOne);

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

  // const clickBuffer = await loadAudioBuffer("snd/sd2.wav");
  // metronome = new Metronome(audioContext, channelMergerNode, tempo,
  //   clickBuffer, 0, metronomeGain);
  // metronome = new Metronome(audioContext, clientOutputNode, tempo,
  //   clickBuffer, 0, metronomeGain);
  // metronome.start();

  const songBuffer = await loadAudioBuffer("snd/song.wav");

  function onclickstart(event) {
    const playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });
    // playNode.connect(clientOutputNode, 0, 0);
    playNode.loop = true;
    playNode.start();
  }

  document.getElementById("play").onclick = onclickstart;
  onclickstart();
  console.log("Waiting for offers.");

  // await sendAndRecievefromClientVonage(
  //   clientOutputNode.stream.getAudioTracks()[0],
  //   gotRemoteStream
  // );
  console.log("clientOutputNode", clientOutputNode.stream.getAudioTracks());

  outputMediaStream = new MediaStream();
  outputMediaStream.addTrack(clientOutputNode.stream.getAudioTracks()[0]);

  await sendAndRecievefromClientSkyway(outputMediaStream, gotRemoteStream);
}

async function sendAndRecievefromClientSkyway(
  audioMediaStream,
  remoteStreamCallBack
) {
  // OT
  //Peer作成
  const peer = new Peer({
    key: skynetApiKey,
    debug: 3,
  });

  console.log("sky net: new peer ");
  peer.on("open", () => {
    console.log("sky net: open ");
    document.getElementById("my-id").textContent = peer.id;
  });

  document.getElementById("make-call").onclick = () => {
    const theirID = document.getElementById("their-id").value;
    const mediaConnection = peer.call(theirID, audioMediaStream);
    mediaConnection.on("stream", (stream) => {
      // video要素にカメラ映像をセットして再生
      // const videoElm = document.getElementById("their-video");
      remoteStreamCallBack(stream);
      // videoElm.play();
    });
  };
  peer.on("error", (err) => {
    alert(err.message);
  });
}

function gotRemoteStream(streams) {
  console.log("Got remote media stream.");

  const mediaStream = streams;
  //const mediaStreamTrack = event.track;

  // Workaround for Chrome from https://stackoverflow.com/a/54781147
  new Audio().srcObject = mediaStream;
  console.log(mediaStream.getAudioTracks());

  const clientInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: mediaStream,
  });
  // clientInputNode.connect(clientOutputNode);

  const channelSplitterNode = new ChannelSplitterNode(audioContext, {
    numberOfOutputs: 2,
  });
  // const clientGainNode = new GainNode(audioContext, { gain: 0 });

  clientInputNode.connect(channelSplitterNode);
  // // clientInputNode.connect(audioContext.destination)

  channelSplitterNode.connect(clientOutputNode, 0);
  channelSplitterNode.connect(audioContext.destination, 1);

  // channelSplitterNode.connect(clientOutputNodeTwo, 1, 1);

  // //here
  // channelSplitterNode.connect(audioContext.destination, 0);

  // clientGainNode.connect(gainNode);

  // clientGainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.5);
  // clientGainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 1);
  // This is to get rid of the initial "click" when new clients connect.
  // New clients will be silenced for 0.5 seconds, then brought to full volume
  // for another 0.5 seconds. Does not really work. :-(
}

async function loadAudioBuffer(url) {
  console.log("Loading audio data from %s.", url);

  const response = await fetch(url);
  const audioData = await response.arrayBuffer();
  const buffer = await audioContext.decodeAudioData(audioData);

  return buffer;
}
