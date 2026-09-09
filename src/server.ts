import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 5000;

app.listen(PORT, () => {
  // Foundation server startup listener
  console.log(`[Server]: Repository Foundation API running on port ${PORT}`);
});
