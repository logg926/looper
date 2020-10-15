"use strict";

import Metronome from "./metronome.js";
import Correlator from "./correlator.js";
import Recorder from "./recorder.js";
import { signalingServerUrl, stunServerUrl } from "./constants.js";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import { initServer, initOTSession } from "./vonangeAPI.session.js";

var signalingChannel, ownId, sessionId; // for Websocket
var connection; // for RTC
var audioContext; // for Web Audio API
var clickBuffer; // click for latency detection
var delayNode, userLatency; // needs to be global to access from processAudio
var sampleRate;
var loopLength;
var recorder;

function handleError(error) {
  if (error) {
    alert(error.message);
  }
}

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
  var userInputStream,
    description,
    userInputNode,
    serverOutputNode,
    channelMergerNode,
    metronome,
    tempo,
    loopBeats;

  // Disable UI
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
  loopBeats = document.getElementById("loopBeats").value * 1;

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
  userInputStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      channelCount: 1,
    },
  });

  // TODO: Assign handler to userInputStream.oninactive

  // Create Web Audio
  audioContext = new AudioContext({ sampleRate });

  clickBuffer = await loadAudioBuffer("snd/Closed_Hat.wav");

  userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream,
  });
  delayNode = new DelayNode(audioContext, { maxDelayTime: loopLength });
  channelMergerNode = new ChannelMergerNode(audioContext, {
    numberOfInputs: 2,
  });
  serverOutputNode = new MediaStreamAudioDestinationNode(audioContext);
  metronome = new Metronome(
    audioContext,
    channelMergerNode,
    60,
    clickBuffer,
    1
  );

  userInputNode.connect(delayNode);
  delayNode.connect(channelMergerNode, 0, 0);
  channelMergerNode.connect(serverOutputNode);

  // delayNode.connect(serverOutputNode, 0, 0);

  metronome.start(-1);

  // TODO:Creating RTC connection

  const { session, token } = await initOTSession();
  console.log("session init", session);
  // const audioTrack = audioTracks[0];
  const audioTrack = serverOutputNode.stream.getAudioTracks()[0];

  // serverOutputNode.connect(audioContext.destination)

  sendAndRecieveFromServer(
    serverOutputNode.stream.getAudioTracks()[0],
    gotRemoteStream
  );
}

function sendAndRecieveFromServer(audioTracks, remoteStreamCallBack) {
  const pubOptions = {
    videoSource: null,
    audioSource: audioTracks,
    name: "clientStream",
  };
  const publisher = OT.initPublisher("publisher", pubOptions, handleError);
  session.connect(token, (error) => {
    // If the connection is successful, publish to the session
    if (error) {
      handleError(error);
    } else {
      session.publish(publisher, handleError);
    }
  });

  const videoElementCreated = (element) => {
    try {
      document.getElementById("subscriber").appendChild(element);
      console.log(element);
      element.muted = true;
      var videoStream = element.captureStream();
      remoteStreamCallBack(videoStream);
    } catch (e) {
      err(e);
    }
  };

  session.on("streamCreated", (event) => {
    console.log("geteventStream", event);
    // console.log('getPublisherForStream', event.target.getPublisherForStream())
    if (event.stream.name == "serverStream") {
      const subscriber = session.subscribe(
        event.stream,
        {
          insertDefaultUI: false,
          width: "100%",
          height: "100%",
        },
        handleError
      );
      subscriber.on("videoElementCreated", (event) => {
        console.log("videoElementCreated");
        videoElementCreated(event.element);
        console.log("videoElementCreated finished");
      });
    }
  });
}

function gotRemoteStream(stream) {
  var mediaStream, serverInputNode, channelSplitterNode;

  console.log("Got remote media stream.");
  mediaStream = stream;

  // Workaround for Chrome from https://stackoverflow.com/a/54781147
  new Audio().srcObject = mediaStream;

  console.log("Creating server input node.");
  serverInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream,
  });

  console.log("Creating channel splitter node.");
  channelSplitterNode = new ChannelSplitterNode(audioContext, {
    numberOfOutputs: 2,
  });
  serverInputNode.connect(channelSplitterNode);
  channelSplitterNode.connect(audioContext.destination, 0);

  console.log("Creating correlator");
  new Correlator(
    audioContext,
    channelSplitterNode,
    clickBuffer,
    updateDelayNode,
    1
  );

  console.log("Creating recorder");
  const recordingNode = new MediaStreamAudioDestinationNode(audioContext);
  channelSplitterNode.connect(recordingNode, 0);
  const downloadButton = document.getElementById("downloadButton");
  recorder = new Recorder(recordingNode.stream, downloadButton);
  recorder.start();

  document.getElementById("stopButton").disabled = false;
}

function updateDelayNode(networkLatency) {
  const totalLatency = userLatency + networkLatency;

  console.log(
    "Latency: %.2f ms (user) + %.2f ms (network) = %.2f ms.",
    1000 * userLatency,
    1000 * networkLatency,
    1000 * totalLatency
  );

  delayNode.delayTime.value = loopLength - totalLatency;
}

// function signal(message) {
//   message.from = ownId;
//   signalingChannel.send(JSON.stringify(message));
// }

async function loadAudioBuffer(url) {
  var response, audioData, buffer;

  console.log("Loading audio data from %s.", url);
  response = await fetch(url);
  audioData = await response.arrayBuffer();
  buffer = await audioContext.decodeAudioData(audioData);
  console.log("Loaded audio data from %s.", url);
  return buffer;
}

function stopStream() {
  document.getElementById("stopButton").disabled = true;
  console.log("Leaving the session");
  recorder.stop();
  connection.close();
}
