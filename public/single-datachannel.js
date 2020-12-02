"use strict";
import "https://webrtc.github.io/adapter/adapter-latest.js";
import {
  passPCMPacketToServerProcessor,
  startServerNode,
  addParticipant,
  changeGain,
} from "./audioContext-server.js";

import { defaultSampleRate } from "./constants.js";
import { startStream } from "./audioContext-client.js";
import { msToIndex, initMediaDevice } from "./helperFunctions.js";

//piano plus ppl
const clientAmount = 3;
document.addEventListener("DOMContentLoaded", initDocument);

// We start by associating the event handlers to the frontend.
async function initDocument() {
  // Adding event handlers to DOM
  document.getElementById("startButton").onclick = startButton;
  document.getElementById("stopButton").onclick = stopStream;
  var selectBar = document.getElementById("audioSource");
  initMediaDevice(selectBar);
}

async function startButton() {
  document.getElementById("latency").disabled = true;
  document.getElementById("startButton").disabled = true;
  var source = document.getElementById("audioSource").value;
  const link =
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2FWhatsApp%20Audio%202020-11-29%20at%203.25.39%20PM.wav?v=1606634994964";

  const latencyInMs = document.getElementById("latency").value;

  const userDelayInBufferUnit = msToIndex(latencyInMs, defaultSampleRate);

  // const { onServerStartCallBack, onServerStopCallBack } = await startStream(
  //   packetCollector,
  //   link,
  //   mockDataConnectionSend,
  //   userDelayInBufferUnit,
  //   false,
  //   false,
  //   source
  // );

  const {
    onServerStartCallBack,
    onServerStopCallBack,
    changeAudioTrack,
  } = await startStream(
    packetCollector,
    link,
    mockDataConnectionSend1,
    0,
    true,
    false,
    source
  );
  const link2 =
    "https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2FWhatsApp%20Audio%202020-11-29%20at%203.25.39%20PM.wav?v=1606634994964";
  const fn2 = await startStream(
    packetCollector2,
    link2,
    mockDataConnectionSend2,
    0,
    true,
    false,
    source
  );
  const onServerStartCallBack2 = fn2.onServerStartCallBack;
  const onServerStopCallBack2 = fn2.onServerStopCallBack;
  const changeAudioTrack2 = fn2.changeAudioTrack;
  startServer(
    onServerStartCallBack,
    onServerStopCallBack,
    onServerStartCallBack2,
    onServerStopCallBack2,
    changeAudioTrack,
    changeAudioTrack2
  );
}

let packetCollector = [];
let packetCollector2 = [];

function stopStream() {
  document.getElementById("stopButton").disabled = true;
  console.log("Leaving the session");
}
function mockDataConnectionSend1(dataConnection, data) {
  passPCMPacketToServerProcessor(data, scriptProcessorEnd, "1");
}
function mockDataConnectionSend2(dataConnection, data) {
  passPCMPacketToServerProcessor(data, scriptProcessorEnd, "2");
}

function updateUITime(time) {
  document.getElementById("time").innerHTML = time;
}

let scriptProcessorEnd;
// let audioBlob
async function startServer(
  onServerStartCallBack,
  onServerStopCallBack,
  onServerStartCallBack2,
  onServerStopCallBack2,
  changeAudioTrack,
  changeAudioTrack2
) {
  async function publishBlob(blob) {
    const arrayBuffer = await blob.arrayBuffer();

    const serverSendTrack = async (event) => {
      const arrayBuffer2 = arrayBuffer.slice();
      changeAudioTrack(arrayBuffer);
      changeAudioTrack2(arrayBuffer2);
    };

    document.getElementById("sendTrack").onclick = serverSendTrack;
    document.querySelector("audio").src = URL.createObjectURL(blob);
  }
  const link =
"https://cdn.glitch.com/5174b6ca-0ae8-4220-8ac7-0e6f337f0c92%2FWhatsApp%20Audio%202020-11-29%20at%203.25.39%20PM.wav?v=1606634994964"
  const serverNode = await startServerNode(
    defaultSampleRate,
    clientAmount,
    updateUITime,
    publishBlob,
    link
  );
  scriptProcessorEnd = serverNode.scriptProcessorEnd;
  const onStop = serverNode.onStop;
  const onStart = serverNode.onStart;
  const mockdataConnection = null;

  addParticipant("1", scriptProcessorEnd);
  addParticipant("2", scriptProcessorEnd);

  const serverSendStartMock = (event) => {
    const startTime = document.getElementById("startSecond").value;
    onStart(startTime);
    onServerStartCallBack(mockdataConnection, parseFloat(startTime));
    onServerStartCallBack2(mockdataConnection, parseFloat(startTime));
  };

  const serverSendStopMock = (event) => {
    onStop();
    onServerStopCallBack(mockdataConnection);
    onServerStopCallBack2(mockdataConnection);
  };

  document.getElementById("play").onclick = serverSendStartMock;
  document.getElementById("stop").onclick = serverSendStopMock;

  function onChangeGainFor1(event) {
    const gain = event.target.value / 100;
    showVal1(gain);
    changeGain("1", scriptProcessorEnd, gain);
  }
  function onChangeGainFor2(event) {
    const gain = event.target.value / 100;
    showVal2(gain);
    changeGain("2", scriptProcessorEnd, gain);
  }

  document.getElementById("vol1").onchange = onChangeGainFor1;
  document.getElementById("vol2").onchange = onChangeGainFor2;
}

function showVal1(val) {
  document.getElementById("vol1Box").innerHTML = val;
}

function showVal2(val) {
  document.getElementById("vol2Box").innerHTML = val;
}
