import express from 'express';
import cors from 'cors';
import { recommendController } from './controller';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(cors())

app.get('/health', (req, res) => {
    res.send('Hello World!');
})


app.post('/recommend-drills', recommendController);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});