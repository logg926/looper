"use strict";

export const signalingServerUrl = "ws://localhost:8080/";
export const stunServerUrl = "stun:stun.l.google.com:19302";
export const skynetApiKey = "7e326bf9-2bca-411a-896d-670ba36cea21";
// export const PCMbufferSize = 128;
export const PCMbufferSize = 16384;
// export const MasterDelay = 10;
//This set the delay packets amount second*44100/128 ?

//3840
export const masterDelayBufferAmount = 2000;
export const clientSendBufferLength = 1280;
//default is reliable https://stackoverflow.com/questions/35394097/webrtc-rtcdatachannel-how-to-configure-to-be-reliable
// An unreliable channel is configured to either limit the number of retransmissions ( maxRetransmits ) or set a time during which transmissions (including retransmissions) are allowed ( maxPacketLifeTime ). These properties can not be used simultaneously and an attempt to do so will result in an error. Not setting any of these properties results in a reliable channel.

export const sendInterval = 2000;

export const dataChannelOptions = {
  // serialization: "json",
  dcInit: {
    ordered: false,
    // maxPacketLifeTime: 3000 // in milliseconds
  },
};

export const defaultSampleRate = 44100;

export const clientStreamConstrain = {
  audio: true,
  video: {
    width: 160,
    height: 90,
    facingMode: "user",
    frameRate: { ideal: 10 },
  },
};

export const serverStreamConstrain = {
  audio: true,
  video: {
    width: 160,
    height: 90,
    facingMode: "user",
    frameRate: { ideal: 10 },
  },
};

export const syncClientStreamConstrain = {
  echoCancellation: true,
  noiseSuppression: true,
  channelCount: 1,
};
