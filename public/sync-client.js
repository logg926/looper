let scriptNodeStartingTime;

export const processAudioToPCMFactory = (sendPCMToServerFn) => {
  const processAudioToPCM = (event) => {
    var array, i, networkLatency;
    var correspondingSecond, boundarySample, currentPlaybackTime;
    var playbackTimeAdjustment;

    array = event.inputBuffer.getChannelData(0);
    const startSecond = event.playbackTime;
    const bufferSize = event.inputBuffer.length;
    const bufferDuration = event.inputBuffer.duration;
    const endSecond = event.playbackTime + bufferDuration;
    if (!scriptNodeStartingTime) {
      scriptNodeStartingTime = startSecond;
    }
    const outputsample = {
      correspondingSecond: startSecond - scriptNodeStartingTime,
      pcm: array,
    };
    sendPCMToServerFn(outputsample);
  };

  return processAudioToPCM;
};
