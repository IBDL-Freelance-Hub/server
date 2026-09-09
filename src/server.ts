import app from './app';
import { env } from './config/env.config';

app.listen(env.PORT, () => {
  console.log(`[Server]: IBDL Freelancers Hub API running on port ${env.PORT} [${env.NODE_ENV}]`);
});
