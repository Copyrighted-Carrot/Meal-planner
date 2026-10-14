import { TextEncoder, TextDecoder } from 'util';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.IS_REACT_ACT_ENVIRONMENT = true;
// CRA's existing Jest cannot parse Axios's ESM entry; use its shipped CJS build.
jest.mock('axios', () => jest.requireActual('axios/dist/browser/axios.cjs'));
