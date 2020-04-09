"use strict";

import Metronome from "./metronome.js";

var signalingChannel, ownId; // for Websocket 
var connection = []; // For RTC
var audioContext, clientOutputNode, gainNode, delayNode, channelMergerNode,
  sampleRate, loopGain; // for Web Audio API

document.addEventListener("DOMContentLoaded", initDocument);

function initDocument()
{
  console.log("Adding event handlers to DOM.");
  document.getElementById("startServerButton").onclick = startServer;
}

async function startServer()
{
  var metronome, loopLength, loopBeats, tempo, metronomeGain;

  // Update UI
  document.getElementById("sampleRate")       .disabled = true;
  document.getElementById("loopBeats")        .disabled = true;
  document.getElementById("tempo")            .disabled = true;
  document.getElementById("loopGain")         .disabled = true;
  document.getElementById("metronomeGain")    .disabled = true;
  document.getElementById("startServerButton").disabled = true;

  // Get user input
  sampleRate    = document.getElementById("sampleRate")   .value;
  loopGain      = document.getElementById("loopGain")     .value;
  metronomeGain = document.getElementById("metronomeGain").value;
  tempo         = document.getElementById("tempo")        .value;
  loopBeats     = document.getElementById("loopBeats")    .value;

  // Adjust loop length and tempo according to the Web Audio API specification:
  // "If DelayNode is part of a cycle, then the value of the delayTime
  // attribute is clamped to a minimum of one render quantum."  We do this
  // explicitly here so we can sync the metronome.
  loopLength = 60/tempo*loopBeats;
  loopLength = Math.round(loopLength*sampleRate/128)*128/sampleRate;
  tempo      = 60/loopLength*loopBeats;
  console.log("Loop lengh is %.5f s, tempos is %.1f bpm.", loopLength, tempo);


  console.log("Creating Web Audio.");
  audioContext      = new AudioContext({sampleRate});
  gainNode          = new GainNode(audioContext, {gain: loopGain});
  delayNode         = new DelayNode(audioContext, {delayTime:    loopLength,
                                                   maxDelayTime: loopLength});
  channelMergerNode = new ChannelMergerNode(audioContext, {numberOfInputs: 2});
  clientOutputNode  = new MediaStreamAudioDestinationNode(audioContext);
  
  gainNode         .connect(delayNode);
  delayNode        .connect(gainNode);
  gainNode         .connect(channelMergerNode, 0, 0);
  channelMergerNode.connect(clientOutputNode);

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

  const clickBuffer = await loadAudioBuffer("snd/CYCdh_K1close_ClHat-07.wav");
  metronome = new Metronome(audioContext, channelMergerNode, tempo,
    clickBuffer, 0, metronomeGain);
  metronome.start();

  console.log("Creating connection to signaling server.");
  signalingChannel = new WebSocket(signalingServerUrl)
  signalingChannel.onmessage = receiveMessage;

  console.log("Waiting for offers.")
}

function receiveMessage(message)
{
  var data;

  data = JSON.parse(message.data);

  if (data.id)           receiveIdMessage(data);
  if (data.offer)        receiveOfferMessage(data);
  if (data.iceCandidate) receiveIceCandidateMessage(data);
}

function receiveIdMessage(data)
{
  ownId = data.id;
  console.log("Received own ID: %d.", ownId);
  document.getElementById("sessionId").innerHTML = ownId;
}

async function receiveOfferMessage(data)
{
  var description, clientId;

  clientId = data.from;
  
  console.log("Received offer %o from %s.", data.offer, clientId)

  connection[clientId] = new RTCPeerConnection({iceServers: [{urls: stunServerUrl}]});

  connection[clientId].onicecandidate = function (event)
                                        {
                                          if (event.candidate)
                                          {
                                            console.log("Sending ICE candidate %o to %s", event.candidate, clientId);
                                            signal({iceCandidate: event.candidate, to: clientId});
                                          }  
                                        };

  connection[clientId].onaddstream = gotRemoteStream;

  connection[clientId].onconnectionstatechange = function (event)
                                                 {
                                                   console.log("State of connection with %s: %s.",
                                                     clientId,
                                                     connection[clientId].connectionState);
                                                 }

  // Sending output to client
                      connection[clientId].addStream(clientOutputNode.stream);
                await connection[clientId].setRemoteDescription(data.offer);
  description = await connection[clientId].createAnswer();
                await connection[clientId].setLocalDescription(description);

  console.log("Sending answer %o to %s.", description, clientId);
  signal({answer: description, to: clientId});
}

function receiveIceCandidateMessage(data)
{
  const clientId = data.from;
  console.log("Received ICE candidate %o from %s.", data.iceCandidate, clientId);
  connection[clientId].addIceCandidate(data.iceCandidate);
}

function gotRemoteStream(event)
{
  console.log("Got remote media stream.")

  const mediaStream = event.stream;

  const clientInputNode     = new MediaStreamAudioSourceNode(audioContext, {mediaStream:     mediaStream});
  const channelSplitterNode = new ChannelSplitterNode       (audioContext, {numberOfOutputs: 2          });
  const clientGainNode      = new GainNode                  (audioContext, {gain:            0          });

  clientInputNode    .connect(channelSplitterNode);
  channelSplitterNode.connect(channelMergerNode, 1, 1);
  channelSplitterNode.connect(clientGainNode, 0);
  clientGainNode     .connect(gainNode);

  clientGainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.5);
  clientGainNode.gain.linearRampToValueAtTime(1, audioContext.currentTime + 1);
  // This is to get rid of the initial "click" when new clients connect.
  // New clients will be silenced for 0.5 seconds, then brought to full volume
  // for another 0.5 seconds. Does not really work. :-(
}

function signal(message)
{
  message.from = ownId;
  signalingChannel.send(JSON.stringify(message));
}

async function loadAudioBuffer(url)
{
  console.log("Loading audio data from %s.", url);

  const response  = await fetch(url);
  const audioData = await response.arrayBuffer();
  const buffer    = await audioContext.decodeAudioData(audioData);

  return buffer;
}
