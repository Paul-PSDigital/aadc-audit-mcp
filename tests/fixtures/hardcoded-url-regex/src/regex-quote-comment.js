// (b) A regex literal containing an apostrophe, followed by a trailing
// line comment that mentions a URL. The commented URL MUST NOT flag.
const re = /it's/; // see https://docs.example.com
export { re };
