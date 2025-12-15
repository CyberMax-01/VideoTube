import mongoose from 'mongoose'
import {DB_NAME} from '../constants.js'

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`Connected to database successfully :)\n${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("Unable to connect to db !!! \n", error)
        process.exit(1)
    }
}

export default connectDB