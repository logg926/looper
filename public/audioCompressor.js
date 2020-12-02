export function compressPCM(PCM) {
  return Int16Array.from(PCM.map(x => (x > 0 ? x * 0x7fff : x * 0x8000)));
}

export function decompressPCM(PCM) {
  const i16 = new Int16Array(PCM);

  const f32 = Float32Array.from(Float32Array.from(i16).map(x => x / 0x8000));
  return f32
}
