import {
  defaultSampleRate,
  syncClientStreamConstrain,
  sendInterval,
} from "./constants.js";

import { urlToArrayBuffer, arrayBufferDecode } from "./helperFunctions.js";
export async function startStream(
  packetBuffer,
  link,
  sendFn,
  userDelayInBufferUnit = 0,
  testing = false,
  loop = true,
  myPreferredCameraDeviceId = null
) {
  // Create Web Audio
  // audioContext = new AudioContext({ sampleRate });

  const audioContext = new AudioContext({ sampleRate: defaultSampleRate });
  let songBuffer;

  async function changeAudioTrack(arrayBuffer) {
    // mutex lock
    songBuffer = await arrayBufferDecode(arrayBuffer, audioContext);
  }
  const arrayBuffer = await urlToArrayBuffer(link);
  await changeAudioTrack(arrayBuffer);

  await audioContext.audioWorklet.addModule("client-processor.js");
  const scriptProcessor = new AudioWorkletNode(
    audioContext,
    "client-processor",
    {
      processorOptions: {
        userDelayInBufferUnit,
      },
    }
  );
  console.log("AudioContext userDelayInBufferUnit", userDelayInBufferUnit);
  console.log("testing", testing);

  // work around it output nothing
  scriptProcessor.connect(audioContext.destination);

  const syncClientStreamConstrainHere = {
    audio: {
      ...syncClientStreamConstrain,
      deviceId: myPreferredCameraDeviceId,
    },
  };

  const userInputStream = await navigator.mediaDevices.getUserMedia(
    syncClientStreamConstrainHere
  );

  const userInputNode = new MediaStreamAudioSourceNode(audioContext, {
    mediaStream: userInputStream,
  });

  let refreshIntervalId;
  let playNode;
  const onServerStartCallBack = (dataConnection, startTime = 0) => {
    // mutex lock
    console.log("start");
    playNode = new AudioBufferSourceNode(audioContext, {
      buffer: songBuffer,
    });

    playNode.loop = loop;

    if (testing) {
      playNode.connect(scriptProcessor);
    } else {
      userInputNode.connect(scriptProcessor);
      playNode.connect(audioContext.destination);
    }

    playNode.start(audioContext.currentTime, startTime); //in second
    // playNode.onended = function (event) {};

    scriptProcessor.port.postMessage({ start: true });
    scriptProcessor.port.onmessage = (event) => {
      bufferPCMandSendToServer(event.data, packetBuffer);
    };
    refreshIntervalId = setInterval(function () {
      const length = packetBuffer.length;
      if (length) {
        const data = {
          type: "clientPCMPacket",
          PCMPacket: packetBuffer.splice(0, length),
        };
        sendFn(dataConnection, data);
      }
    }, sendInterval);
  };

  const onServerStopCallBack = () => {
    scriptProcessor.port.postMessage({ stop: true });
    playNode.stop();
    playNode.disconnect();
    clearInterval(refreshIntervalId);
    //empty buffer
    packetBuffer.length = 0;
  };
  return { onServerStartCallBack, onServerStopCallBack, changeAudioTrack };
}

async function bufferPCMandSendToServer(PCMPacket, packetBuffer) {
  packetBuffer.push(PCMPacket);
}
