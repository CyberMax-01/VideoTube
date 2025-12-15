import 'dotenv/config'
import connectDB from './db/index.js'
import { app } from './app.js'

const port = process.env.PORT || 3000
      
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Listening on port ${port}......`)
    })
}).catch((err) => console.log("MongoDB connection failed !!! \n", err))