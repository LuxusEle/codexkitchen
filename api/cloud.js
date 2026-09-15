// Vercel Node function. Credentials and database code stay server-side.
export {default} from '../server/cloud.js';
export const config={api:{bodyParser:false}};
