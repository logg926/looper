"use strict";

export const signalingServerUrl = "ws://localhost:8080/";
export const stunServerUrl = "stun:stun.l.google.com:19302";
export const skynetApiKey = "7e326bf9-2bca-411a-896d-670ba36cea21";
export const PCMbufferSize = 128;
// export const PCMbufferSize = 16384;
export const MasterDelay = 10;
export const masterDelayBufferAmount = 3840;
export const clientSendBufferLength = 1280;
//default is reliable https://stackoverflow.com/questions/35394097/webrtc-rtcdatachannel-how-to-configure-to-be-reliable 
// An unreliable channel is configured to either limit the number of retransmissions ( maxRetransmits ) or set a time during which transmissions (including retransmissions) are allowed ( maxPacketLifeTime ). These properties can not be used simultaneously and an attempt to do so will result in an error. Not setting any of these properties results in a reliable channel.

export const dataChannelOptions = {
  serialization: "json",
  dcInit: { ordered: false }
};
