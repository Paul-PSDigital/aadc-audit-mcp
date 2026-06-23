// (a) A regex literal whose // would previously blank the rest of the
// line. The real URL after it MUST still be flagged.
const re = /^https?:\/\//; const u = 'https://real-track.example.com';
export { re, u };
