export function msToIndex(latencyInMs, defaultSampleRate) {
  return Math.round(((parseInt(latencyInMs) / 1000) * defaultSampleRate) / 128); //
}

export function indexToMs(index, defaultSampleRate) {
  return (index * 128000) / defaultSampleRate;
}


export async function urlToArrayBuffer(url) {
  console.log("Loading audio data from %s.", url);
  const response = await fetch(url);
  return response.arrayBuffer();
}
export async function arrayBufferDecode(arrayBuffer, audioContext) {
  return audioContext.decodeAudioData(arrayBuffer);
}


export async function initMediaDevice(selectBar) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    console.log("enumerateDevices() not supported.");
    return;
  }

  // List cameras and microphones.
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    devices.forEach(function (device) {
      if ("audioinput" !== device.kind.toString()) return;
      let option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label;
      selectBar.add(option);
      console.log(
        device.kind + ": " + device.label + " id = " + device.deviceId
      );
    });
  } catch (err) {
    console.log(err.name + ": " + err.message);
  }
}